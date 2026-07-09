import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { clientPlatformRepository } from '../../platform/clientPlatform.repository';
import { clearStaffSessionCookie, getCookieValue } from '../../shared/http';
import { verifyAdminToken } from '../../shared/hashToken';

const getStaffTokenFromRequest = (req: Request): string | undefined =>
  req.header('x-staff-token')?.trim() ??
  getCookieValue(req, env.STAFF_SESSION_COOKIE_NAME)?.trim();

const hasStaffAccess = async (
  clientId: string,
  teamMemberId: string,
  staffToken: string
): Promise<boolean> => {
  const client = await clientPlatformRepository.getClientById(clientId);
  const teamMember = client?.teamMembers.find((member) => member.id === teamMemberId);

  return !!teamMember && teamMember.isActive !== false && !!teamMember.staffToken &&
    verifyAdminToken(staffToken, teamMember.staffToken);
};

export const requireStaffAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const clientId = req.params.clientId;
  const teamMemberId = req.params.teamMemberId;
  const staffToken = getStaffTokenFromRequest(req);

  if (!clientId || !teamMemberId || !staffToken) {
    clearStaffSessionCookie(res);
    res.status(403).json({ error: 'Staff access is required' });
    return;
  }

  const isTokenValid = await hasStaffAccess(clientId, teamMemberId, staffToken);

  if (!isTokenValid) {
    clearStaffSessionCookie(res);
    res.status(403).json({ error: 'Staff access is required' });
    return;
  }

  next();
};

const getStaffPageParamsFromRequest = (
  req: Request
): { clientId?: string; teamMemberId?: string } => {
  const clientId = req.query.clientId;
  const teamMemberId = req.query.teamMemberId;

  return {
    clientId: typeof clientId === 'string' && clientId.trim().length > 0 ? clientId.trim() : undefined,
    teamMemberId:
      typeof teamMemberId === 'string' && teamMemberId.trim().length > 0 ? teamMemberId.trim() : undefined
  };
};

export const requireStaffPageAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { clientId, teamMemberId } = getStaffPageParamsFromRequest(req);
  const staffToken = getStaffTokenFromRequest(req);

  if (!clientId || !teamMemberId || !staffToken) {
    clearStaffSessionCookie(res);
    res.redirect('/barber-login');
    return;
  }

  const isTokenValid = await hasStaffAccess(clientId, teamMemberId, staffToken);

  if (!isTokenValid) {
    clearStaffSessionCookie(res);
    res.redirect('/barber-login');
    return;
  }

  next();
};
