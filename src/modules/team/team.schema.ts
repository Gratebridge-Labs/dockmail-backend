import { z } from "zod";

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  mailboxIds: z.array(z.string().cuid()).default([]),
  message: z.string().max(500).optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).optional(),
  fullName: z.string().min(2).optional(),
});

export const invitePreviewQuerySchema = z.object({
  token: z.string().min(1),
});

export const reviewMailboxRequestSchema = z.object({
  status: z.enum(["APPROVED", "DECLINED"]),
  reviewNote: z.string().max(500).optional(),
});
