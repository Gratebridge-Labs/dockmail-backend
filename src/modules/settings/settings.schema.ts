import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  displayName: z.string().max(50).optional(),
  timezone: z.string().optional(),
  companyName: z.string().optional(),
});

export const updateNotificationPrefsSchema = z.object({
  workspaceId: z.string().cuid(),
  notifyEmailOpened: z.boolean().optional(),
  notifyNewEmail: z.boolean().optional(),
  notifyTeamActivity: z.boolean().optional(),
  notifyMailboxReq: z.boolean().optional(),
  notifyBilling: z.boolean().optional(),
});
