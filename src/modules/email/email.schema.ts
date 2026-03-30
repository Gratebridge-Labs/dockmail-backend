import { z } from "zod";

export const createDraftSchema = z.object({
  toAddresses: z.array(z.string().email()).default([]),
  ccAddresses: z.array(z.string().email()).default([]),
  bccAddresses: z.array(z.string().email()).default([]),
  subject: z.string().max(998).default(""),
  bodyHtml: z.string(),
  bodyText: z.string().optional(),
  replyTo: z.string().email().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).default([]),
  isDraft: z.literal(true).default(true),
  readReceiptEnabled: z.boolean().default(true),
});

export const sendDraftSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
});

export const bulkActionSchema = z.object({
  emailIds: z.array(z.string().cuid()).min(1).max(100),
  action: z.enum([
    "MARK_READ",
    "MARK_UNREAD",
    "STAR",
    "UNSTAR",
    "TRASH",
    "ARCHIVE",
    "SPAM",
    "RESTORE",
    "PERMANENT_DELETE",
  ]),
  folderId: z.string().cuid().optional(),
});

export const moveEmailSchema = z.object({
  folder: z.enum(["INBOX", "SENT", "DRAFTS", "SPAM", "TRASH", "ARCHIVE"]).optional(),
  folderId: z.string().cuid().optional(),
});
