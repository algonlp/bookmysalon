import { env } from '../config/env';
import { HttpError } from '../shared/errors/httpError';
import { logger } from '../shared/logger';

interface GoogleTokenInfoResponse {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  family_name?: string;
  given_name?: string;
  iss?: string;
  name?: string;
  sub?: string;
}

export interface VerifiedGoogleIdentity {
  email: string;
  issuer: string;
  name: string;
  subject: string;
}

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const VALID_GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const isVerifiedGoogleEmail = (value: GoogleTokenInfoResponse['email_verified']): boolean =>
  value === true || value === 'true';

const normalizeGoogleName = (payload: GoogleTokenInfoResponse): string => {
  if (typeof payload.name === 'string' && payload.name.trim()) {
    return payload.name.trim();
  }

  return [payload.given_name, payload.family_name]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();
};

export const googleIdentityService = {
  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const trimmedToken = typeof idToken === 'string' ? idToken.trim() : '';
    const configuredClientId = env.PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';

    if (!trimmedToken) {
      throw new HttpError(400, 'Google credential is required');
    }

    if (!configuredClientId) {
      throw new HttpError(503, 'Google sign-in is not configured for this environment');
    }

    let response: Response;

    try {
      const query = new URLSearchParams({ id_token: trimmedToken });
      response = await fetch(`${GOOGLE_TOKENINFO_URL}?${query.toString()}`, {
        headers: {
          Accept: 'application/json'
        }
      });
    } catch (error) {
      logger.error('Google token verification request failed', error);
      throw new HttpError(502, 'Google sign-in is temporarily unavailable');
    }

    if (!response.ok) {
      let payload: unknown = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      logger.error('Google token verification was rejected', {
        payload,
        status: response.status
      });
      throw new HttpError(401, 'Unable to verify Google sign-in');
    }

    const payload = (await response.json()) as GoogleTokenInfoResponse;
    const normalizedEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const issuer = typeof payload.iss === 'string' ? payload.iss.trim() : '';
    const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';

    if (payload.aud !== configuredClientId) {
      throw new HttpError(401, 'Google sign-in audience is invalid');
    }

    if (!VALID_GOOGLE_ISSUERS.has(issuer)) {
      throw new HttpError(401, 'Google sign-in issuer is invalid');
    }

    if (!normalizedEmail || !isVerifiedGoogleEmail(payload.email_verified)) {
      throw new HttpError(401, 'Google account email is not verified');
    }

    if (!subject) {
      throw new HttpError(401, 'Google sign-in subject is invalid');
    }

    return {
      email: normalizedEmail,
      issuer,
      name: normalizeGoogleName(payload),
      subject
    };
  }
};
