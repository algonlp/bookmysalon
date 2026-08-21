import { randomBytes } from 'crypto';
import { env } from '../config/env';
import { logger } from '../shared/logger';
import { hashAdminToken, verifyAdminToken } from '../shared/hashToken';
import { emailService, type EmailAttachment } from './email.service';
import { renderEmailLayout, BRAND_NAME, INK, MUTED } from './emailTemplate';
import type { EmailLogSource } from './emailLog.types';

export type PaymentVerificationKind = 'wallet_topup' | 'subscription_payment';

// How long an admin has to act on the emailed verification link before it
// expires and the request needs to be reviewed from the super-admin panel
// instead.
export const TOKEN_TTL_HOURS = 72;

export interface VerifiableRequest {
  id: string;
  businessId: string;
  status: 'pending_review' | 'approved' | 'rejected';
  verificationTokenHash?: string;
  verificationTokenExpiresAt?: string;
}

export interface PaymentVerificationDescription {
  businessName: string;
  businessEmail: string;
  kindLabel: string;
  amountLabel: string;
  proofUrl: string;
  extraLines: string[];
}

export interface PaymentVerificationAdapter<T extends VerifiableRequest> {
  kind: PaymentVerificationKind;
  getById(id: string): Promise<T | null>;
  // Must be idempotent (no-op if already decided) and must clear the token
  // fields on the saved record, mirroring walletService.approveTopup.
  approve(id: string, operator?: string): Promise<T>;
  reject(id: string, operator: string | undefined, reason: string): Promise<T>;
  // Async because it typically needs to look up the business name/email.
  describe(request: T): Promise<PaymentVerificationDescription>;
}

// Most email clients (Gmail included) strip inline data: URIs from <img
// src="data:...">, so the proof image can't be embedded inline in the
// email body itself - only as a real file attachment, which every client
// supports.
const proofUrlToAttachment = (proofUrl: string): EmailAttachment | undefined => {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(proofUrl.trim());

  if (!match) {
    return undefined;
  }

  const [, contentType, contentBase64] = match;
  const extension = contentType.split('/')[1]?.split('+')[0] || 'bin';

  return {
    filename: `payment-proof.${extension}`,
    contentBase64,
    contentType
  };
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const issueVerificationToken = (): {
  plainToken: string;
  tokenHash: string;
  expiresAt: string;
} => {
  const plainToken = randomBytes(32).toString('hex');
  return {
    plainToken,
    tokenHash: hashAdminToken(plainToken),
    expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString()
  };
};

export const buildConfirmUrl = (
  origin: string,
  kind: PaymentVerificationKind,
  id: string,
  plainToken: string
): string => `${origin}/api/payments/verify/${kind}/${id}?token=${plainToken}`;

type TokenValidation = 'ok' | 'invalid' | 'expired' | 'consumed';

const validateToken = (request: VerifiableRequest, plainToken: string | undefined): TokenValidation => {
  if (request.status !== 'pending_review' || !request.verificationTokenHash) {
    return 'consumed';
  }

  if (!plainToken || !verifyAdminToken(plainToken, request.verificationTokenHash)) {
    return 'invalid';
  }

  if (
    request.verificationTokenExpiresAt &&
    new Date(request.verificationTokenExpiresAt).getTime() < Date.now()
  ) {
    return 'expired';
  }

  return 'ok';
};

export const sendAdminVerificationEmail = async <T extends VerifiableRequest>(
  adapter: PaymentVerificationAdapter<T>,
  request: T,
  plainToken: string,
  origin: string
): Promise<void> => {
  try {
    const description = await adapter.describe(request);
    const confirmUrl = buildConfirmUrl(origin, adapter.kind, request.id, plainToken);
    const extraLinesHtml = description.extraLines
      .map((line) => `<p style="margin:4px 0">${escapeHtml(line)}</p>`)
      .join('');

    const attachment = proofUrlToAttachment(description.proofUrl);

    const html = renderEmailLayout({
      preheader: `${description.kindLabel} awaiting verification - ${description.amountLabel}`,
      eyebrow: 'Payment verification needed',
      heading: `${description.kindLabel} - ${description.amountLabel}`,
      bodyHtml: `
        <p style="margin:0 0 4px"><strong style="color:${INK}">Business:</strong> ${escapeHtml(description.businessName)}</p>
        <p style="margin:0 0 4px"><strong style="color:${INK}">Type:</strong> ${escapeHtml(description.kindLabel)}</p>
        <p style="margin:0 0 4px"><strong style="color:${INK}">Amount:</strong> ${escapeHtml(description.amountLabel)}</p>
        ${extraLinesHtml}
        ${attachment ? `<p style="margin:16px 0 0;color:${MUTED}">Payment proof is attached to this email (${escapeHtml(attachment.filename)}).</p>` : ''}
        <p style="margin:8px 0 0;color:${MUTED}">Click below to approve or reject this payment. The link expires in ${TOKEN_TTL_HOURS} hours.</p>
      `,
      button: { label: 'Review & verify payment', url: confirmUrl }
    });

    const text = `${description.kindLabel} awaiting verification\nBusiness: ${description.businessName}\nAmount: ${description.amountLabel}${attachment ? `\nPayment proof attached: ${attachment.filename}` : ''}\nReview & verify: ${confirmUrl}`;

    const to = env.PLATFORM_PAYMENTS_ADMIN_EMAIL?.trim() || env.PUBLIC_SUPPORT_EMAIL?.trim() || '';

    await emailService.sendEmail(
      {
        to,
        subject: `[Verify] ${description.kindLabel} - ${description.amountLabel} - ${description.businessName}`,
        text,
        html,
        attachments: attachment ? [attachment] : undefined
      },
      'admin',
      { businessId: request.businessId, source: 'manual_payment_admin_notice' as EmailLogSource }
    );
  } catch (error) {
    // Best-effort: a failed admin notification must never block the buyer's
    // payment submission - the request itself is already saved, and the
    // super-admin panel is always available as a fallback review path.
    logger.error('Failed to send manual-payment admin verification email', {
      error: error instanceof Error ? error.message : String(error),
      requestId: request.id,
      kind: adapter.kind
    });
  }
};

export const sendBuyerDecisionEmail = async <T extends VerifiableRequest>(
  adapter: PaymentVerificationAdapter<T>,
  request: T,
  decision: 'approved' | 'rejected',
  reason?: string
): Promise<void> => {
  try {
    const description = await adapter.describe(request);

    if (!description.businessEmail.trim()) {
      return;
    }

    const heading =
      decision === 'approved'
        ? `Your ${description.kindLabel.toLowerCase()} is confirmed`
        : `We couldn't verify your ${description.kindLabel.toLowerCase()}`;

    const bodyHtml =
      decision === 'approved'
        ? `<p style="margin:0">Amount: <strong style="color:${INK}">${escapeHtml(description.amountLabel)}</strong></p>` +
          description.extraLines.map((line) => `<p style="margin:8px 0 0">${escapeHtml(line)}</p>`).join('')
        : `<p style="margin:0">Amount: <strong style="color:${INK}">${escapeHtml(description.amountLabel)}</strong></p>
           <p style="margin:8px 0 0">Reason: ${escapeHtml(reason?.trim() || 'Payment could not be confirmed.')}</p>
           <p style="margin:8px 0 0;color:${MUTED}">If you believe this is a mistake, please contact support with your transaction reference.</p>`;

    const html = renderEmailLayout({
      preheader: heading,
      eyebrow: description.kindLabel,
      heading,
      bodyHtml
    });

    const text = `${heading}\nAmount: ${description.amountLabel}${decision === 'rejected' ? `\nReason: ${reason?.trim() || 'Payment could not be confirmed.'}` : ''}`;

    await emailService.sendEmail(
      { to: description.businessEmail, subject: heading, text, html },
      'customer',
      { businessId: request.businessId, source: 'manual_payment_confirmation' as EmailLogSource }
    );
  } catch (error) {
    logger.error('Failed to send manual-payment buyer decision email', {
      error: error instanceof Error ? error.message : String(error),
      requestId: request.id,
      kind: adapter.kind,
      decision
    });
  }
};

const pageShell = (title: string, bodyHtml: string): string => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(title)} - ${BRAND_NAME}</title>
  </head>
  <body style="margin:0;padding:32px 16px;background:#f7efe7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:18px;padding:32px;box-shadow:0 16px 38px rgba(81, 60, 55, 0.12)">
      <p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6c4cf5">${BRAND_NAME}</p>
      ${bodyHtml}
    </div>
  </body>
</html>
`;

export const renderConfirmPage = async <T extends VerifiableRequest>(
  adapter: PaymentVerificationAdapter<T>,
  request: T,
  plainToken: string
): Promise<string> => {
  const description = await adapter.describe(request);
  const extraLinesHtml = description.extraLines
    .map((line) => `<p style="margin:4px 0;color:${MUTED}">${escapeHtml(line)}</p>`)
    .join('');
  // proofUrl is a data: URL (the proof image uploaded by the buyer), so it's
  // embedded directly as an <img> rather than linked - a data: URL in an
  // email's href would be stripped by most clients, but this page is
  // server-rendered on our own domain, not sent as an email.
  const proofHtml = description.proofUrl
    ? `<img src="${description.proofUrl}" alt="Payment proof" style="max-width:100%;border-radius:10px;margin:12px 0;border:1px solid #e5ded8" />`
    : '';

  return pageShell(
    'Verify payment',
    `
      <h1 style="margin:0 0 14px;font-size:1.3rem">${escapeHtml(description.kindLabel)}</h1>
      <p style="margin:0 0 4px"><strong>Business:</strong> ${escapeHtml(description.businessName)}</p>
      <p style="margin:0 0 4px"><strong>Amount:</strong> ${escapeHtml(description.amountLabel)}</p>
      ${extraLinesHtml}
      ${proofHtml}
      <form method="POST" action="/api/payments/verify/${adapter.kind}/${request.id}" style="margin-top:12px">
        <input type="hidden" name="token" value="${escapeHtml(plainToken)}" />
        <label style="display:block;margin:0 0 6px;font-size:13px;color:${MUTED}">Your name (optional, for the audit trail)</label>
        <input type="text" name="operator" placeholder="e.g. Ayesha" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e5ded8;border-radius:10px;margin-bottom:14px" />
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="submit" name="decision" value="approve" style="flex:1;padding:12px 18px;border:none;border-radius:999px;background:linear-gradient(135deg, #6c4cf5, #5636e8);color:#fff;font-weight:700;cursor:pointer">Approve</button>
          <button type="submit" name="decision" value="reject" style="flex:1;padding:12px 18px;border:1px solid #e5ded8;border-radius:999px;background:#fff;color:${INK};font-weight:700;cursor:pointer">Reject</button>
        </div>
        <label style="display:block;margin:14px 0 6px;font-size:13px;color:${MUTED}">Rejection reason (required if rejecting)</label>
        <input type="text" name="reason" placeholder="e.g. Amount does not match" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e5ded8;border-radius:10px" />
      </form>
    `
  );
};

const renderMessagePage = (title: string, message: string): string =>
  pageShell(title, `<h1 style="margin:0 0 12px;font-size:1.2rem">${escapeHtml(title)}</h1><p style="margin:0;color:${MUTED}">${escapeHtml(message)}</p>`);

export const handleVerificationGet = async <T extends VerifiableRequest>(
  adapter: PaymentVerificationAdapter<T>,
  id: string,
  token: string | undefined
): Promise<{ status: number; html: string }> => {
  const request = await adapter.getById(id);

  if (!request) {
    return { status: 404, html: renderMessagePage('Not found', 'This payment request no longer exists.') };
  }

  const validation = validateToken(request, token);

  if (validation === 'consumed') {
    return {
      status: 200,
      html: renderMessagePage(
        'Already reviewed',
        `This payment request has already been ${request.status === 'approved' ? 'approved' : request.status === 'rejected' ? 'rejected' : 'reviewed'}.`
      )
    };
  }

  if (validation === 'expired') {
    return {
      status: 410,
      html: renderMessagePage('Link expired', 'This verification link has expired. Please review this request from the platform-admin panel instead.')
    };
  }

  if (validation === 'invalid') {
    return { status: 403, html: renderMessagePage('Invalid link', 'This verification link is invalid.') };
  }

  return { status: 200, html: await renderConfirmPage(adapter, request, token as string) };
};

export const handleVerificationPost = async <T extends VerifiableRequest>(
  adapter: PaymentVerificationAdapter<T>,
  id: string,
  token: string | undefined,
  decision: 'approve' | 'reject',
  reason: string | undefined,
  operator: string | undefined
): Promise<{ status: number; html: string }> => {
  const request = await adapter.getById(id);

  if (!request) {
    return { status: 404, html: renderMessagePage('Not found', 'This payment request no longer exists.') };
  }

  const validation = validateToken(request, token);

  if (validation === 'consumed') {
    return {
      status: 200,
      html: renderMessagePage(
        'Already reviewed',
        `This payment request has already been ${request.status === 'approved' ? 'approved' : request.status === 'rejected' ? 'rejected' : 'reviewed'}.`
      )
    };
  }

  if (validation === 'expired') {
    return {
      status: 410,
      html: renderMessagePage('Link expired', 'This verification link has expired. Please review this request from the platform-admin panel instead.')
    };
  }

  if (validation === 'invalid') {
    return { status: 403, html: renderMessagePage('Invalid link', 'This verification link is invalid.') };
  }

  if (decision === 'reject' && !reason?.trim()) {
    return { status: 200, html: await renderConfirmPage(adapter, request, token as string) };
  }

  // adapter.approve/reject delegate to the same wallet/billing service
  // functions the super-admin panel calls directly, and those functions are
  // responsible for sending the buyer decision email - so it is not sent
  // again here, which would otherwise double-email on the email-link path.
  if (decision === 'approve') {
    await adapter.approve(id, operator?.trim() || 'email-link');
  } else {
    await adapter.reject(id, operator?.trim() || 'email-link', reason?.trim() ?? '');
  }

  return {
    status: 200,
    html: renderMessagePage(
      decision === 'approve' ? 'Payment approved' : 'Payment rejected',
      decision === 'approve'
        ? 'The payment has been approved and the business has been notified.'
        : 'The payment has been rejected and the business has been notified.'
    )
  };
};
