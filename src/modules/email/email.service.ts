import crypto from "node:crypto";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { sendAppEmail } from "../../config/ses";
import { injectTrackingPixel } from "../../utils/tracking";
import { resolveThreadId } from "./threading";

export async function listEmails(mailboxId: string, folder?: string) {
  return prisma.email.findMany({
    where: { mailboxId, ...(folder ? { folder: folder as never } : {}) },
    include: { attachments: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createDraft(mailboxId: string, input: any) {
  const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId } });
  if (!mailbox) throw new Error("NOT_FOUND");
  const threadId = await resolveThreadId(mailboxId, input.inReplyTo, input.references ?? []);

  return prisma.email.create({
    data: {
      mailboxId,
      fromAddress: mailbox.email,
      fromName: mailbox.displayName ?? undefined,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      toAddresses: input.toAddresses,
      ccAddresses: input.ccAddresses,
      bccAddresses: input.bccAddresses,
      replyTo: input.replyTo,
      inReplyTo: input.inReplyTo,
      references: input.references,
      threadId,
      isDraft: true,
      status: "DRAFT",
      readReceiptEnabled: input.readReceiptEnabled,
    },
  });
}

export async function sendDraft(mailboxId: string, emailId: string, scheduledAt?: string) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, mailboxId },
    include: { mailbox: true },
  });
  if (!email) throw new Error("NOT_FOUND");
  if (!email.toAddresses.length || !email.subject) throw new Error("VALIDATION");

  const fromData = {
    fromAddress: email.mailbox.email,
    fromName: email.mailbox.displayName ?? undefined,
  };

  if (scheduledAt) {
    return prisma.email.update({
      where: { id: email.id },
      data: {
        status: "SCHEDULED",
        isScheduled: true,
        scheduledAt: new Date(scheduledAt),
        ...fromData,
      },
    });
  }

  return prisma.email.update({
    where: { id: email.id },
    data: { status: "QUEUED", isScheduled: false, ...fromData },
  });
}

export async function performSend(mailboxId: string, emailId: string) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, mailboxId },
    include: { mailbox: true },
  });
  if (!email) throw new Error("NOT_FOUND");
  if (!email.toAddresses.length || !email.subject) throw new Error("VALIDATION");
  const resolvedThreadId =
    email.threadId ?? (await resolveThreadId(mailboxId, email.inReplyTo ?? undefined, email.references ?? []));

  const trackingId = email.trackingId ?? crypto.randomUUID();
  const trackingUrl = `${env.TRACKING_PIXEL_URL}/${trackingId}`;
  const bodyHtml = injectTrackingPixel(email.bodyHtml, trackingUrl);

  const from = email.mailbox.email;
  let messageId: string | undefined;
  try {
    messageId = await sendAppEmail({
      from,
      to: email.toAddresses,
      subject: email.subject,
      html: bodyHtml,
      text: email.bodyText ?? undefined,
      replyTo: email.replyTo ?? undefined,
      smtpAuth: {
        user: email.mailbox.email,
        pass: email.mailbox.password,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`SES send failed mailbox=${mailboxId} email=${emailId} from=${from} — ${msg}`);
    throw e;
  }

  return prisma.email.update({
    where: { id: email.id },
    data: {
      status: "SENT",
      folder: "SENT",
      sentAt: new Date(),
      isDraft: false,
      fromAddress: from,
      fromName: email.mailbox.displayName ?? undefined,
      trackingId,
      messageId: messageId ?? undefined,
      threadId: resolvedThreadId,
    },
  });
}

export function moveToTrash(mailboxId: string, emailId: string) {
  return prisma.email.updateMany({
    where: { id: emailId, mailboxId },
    data: { folder: "TRASH", deletedAt: new Date() },
  });
}

export async function permanentDelete(mailboxId: string, emailId: string) {
  const email = await prisma.email.findFirst({ where: { id: emailId, mailboxId } });
  if (!email || email.folder !== "TRASH") throw new Error("NOT_FOUND");
  await prisma.attachment.deleteMany({ where: { emailId } });
  return prisma.email.delete({ where: { id: emailId } });
}

export async function bulkAction(
  mailboxId: string,
  input: { emailIds: string[]; action: string },
) {
  const map: Record<string, Record<string, unknown>> = {
    MARK_READ: { isRead: true },
    MARK_UNREAD: { isRead: false },
    STAR: { isStarred: true },
    UNSTAR: { isStarred: false },
    TRASH: { folder: "TRASH", deletedAt: new Date() },
    ARCHIVE: { folder: "ARCHIVE" },
    SPAM: { folder: "SPAM" },
    RESTORE: { folder: "INBOX", deletedAt: null },
  };
  if (input.action === "PERMANENT_DELETE") {
    await prisma.email.deleteMany({
      where: { id: { in: input.emailIds }, mailboxId, folder: "TRASH" },
    });
    return { affected: input.emailIds.length, emailIds: input.emailIds };
  }
  const data = map[input.action];
  const updated = await prisma.email.updateMany({
    where: { id: { in: input.emailIds }, mailboxId },
    data,
  });
  return { affected: updated.count, emailIds: input.emailIds };
}

export function moveEmail(mailboxId: string, emailId: string, folder: string) {
  return prisma.email.updateMany({
    where: { id: emailId, mailboxId },
    data: { folder: folder as never },
  });
}

export async function getThread(mailboxId: string, emailId: string) {
  const email = await prisma.email.findFirst({ where: { id: emailId, mailboxId } });
  if (!email) return null;
  if (!email.threadId) return [email];
  return prisma.email.findMany({
    where: { mailboxId, threadId: email.threadId },
    orderBy: { createdAt: "asc" },
  });
}

export function cancelSchedule(mailboxId: string, emailId: string) {
  return prisma.email.updateMany({
    where: { id: emailId, mailboxId, status: "SCHEDULED" },
    data: {
      status: "DRAFT",
      isScheduled: false,
      scheduledAt: null,
      isDraft: true,
      folder: "DRAFTS",
    },
  });
}
