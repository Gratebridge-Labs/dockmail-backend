import { z } from "zod";

export const createMailboxSchema = z.object({
  localPart: z.string().min(1).max(64).regex(/^[a-zA-Z0-9._+-]+$/),
  domainId: z.string().cuid(),
  displayName: z.string().max(100).optional(),
  assignToUserId: z.string().cuid().optional(),
  storageLimitMb: z.number().min(512).max(102400).default(5120),
});

export const mailboxAssignSchema = z.object({
  userId: z.string().cuid(),
});
