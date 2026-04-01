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

export const mailboxRequestSchema = z.object({
  localPart: z.string().min(1).max(64),
  domainId: z.string().cuid(),
  reason: z.string().max(500).optional(),
});

export const reviewMailboxRequestSchema = z.object({
  status: z.enum(["APPROVED", "DECLINED"]),
  reviewNote: z.string().max(500).optional(),
});

export const patchMailboxSchema = z.object({
  /** Set to `null` or empty string to clear. */
  displayName: z
    .union([z.string().max(100), z.null()])
    .transform((v) => (v === "" || v === null ? null : v)),
});
