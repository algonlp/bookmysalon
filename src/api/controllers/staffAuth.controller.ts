import type { Request, Response } from 'express';
import { z } from 'zod';
import { clientPlatformService } from '../../platform/clientPlatform.service';
import { verifyPassword } from '../../shared/hashToken';
import { clearStaffSessionCookie, setStaffSessionCookie } from '../../shared/http';
import { HttpError } from '../../shared/errors/httpError';

const staffLoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().trim().min(1, 'Password is required'),
  rememberMe: z.boolean().default(true)
});

const getClientId = (req: Request): string => {
  const clientId = req.params.clientId;

  if (!clientId) {
    throw new HttpError(400, 'clientId is required');
  }

  return clientId;
};

const getTeamMemberId = (req: Request): string => {
  const teamMemberId = req.params.teamMemberId;

  if (!teamMemberId) {
    throw new HttpError(400, 'teamMemberId is required');
  }

  return teamMemberId;
};

export const staffAuthController = {
  async loginStaff(req: Request, res: Response): Promise<void> {
    const input = staffLoginSchema.parse(req.body);
    const match = await clientPlatformService.findTeamMemberForLogin(input.username);

    if (!match || !verifyPassword(input.password, match.teamMember.passwordHash ?? '')) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const { client, teamMember, plainStaffToken } = await clientPlatformService.loginTeamMember(
      match.client.id,
      match.teamMember.id
    );

    setStaffSessionCookie(res, plainStaffToken, input.rememberMe);
    res.status(200).json({
      clientId: client.id,
      teamMemberId: teamMember.id,
      teamMemberName: teamMember.name,
      businessName: client.businessName
    });
  },

  async logoutStaff(req: Request, res: Response): Promise<void> {
    await clientPlatformService.logoutTeamMember(getClientId(req), getTeamMemberId(req));
    clearStaffSessionCookie(res);
    res.status(200).json({ success: true });
  }
};
