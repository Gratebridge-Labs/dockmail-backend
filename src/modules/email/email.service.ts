import crypto from "node:crypto";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { sendAppEmail } from "../../config/ses";
import { injectTrackingPixel } from "../../utils/tracking";

export async function listEmails(mailboxId: string, folder?: string) {
  return prisma.email.findMany({
    where: { mailboxId, ...(folder ? { folder: folder as never } : {}) },
    include: { attachments: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createDraft(mailboxId: string, input: any) {
  return prisma.email.create({
    data: {
      mailboxId,
      fromAddress: "",
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      toAddresses: input.toAddresses,
      ccAddresses: input.ccAddresses,
      bccAddresses: input.bccAddresses,
      replyTo: input.replyTo,
      inReplyTo: input.inReplyTo,
      references: input.references,
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

  if (scheduledAt) {
    return prisma.email.update({
      where: { id: email.id },
      data: { status: "SCHEDULED", isScheduled: true, scheduledAt: new Date(scheduledAt) },
    });
  }

  return prisma.email.update({
    where: { id: email.id },
    data: { status: "QUEUED", isScheduled: false },
  });
}

export async function performSend(mailboxId: string, emailId: string) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, mailboxId },
    include: { mailbox: true },
  });
  if (!email) throw new Error("NOT_FOUND");
  if (!email.toAddresses.length || !email.subject) throw new Error("VALIDATION");

  const trackingId = email.trackingId ?? crypto.randomUUID();
  const trackingUrl = `${env.TRACKING_PIXEL_URL}/${trackingId}`;
  const bodyHtml = injectTrackingPixel(email.bodyHtml, trackingUrl);

  const messageId = await sendAppEmail({
    from: email.mailbox.email,
    to: email.toAddresses,
    subject: email.subject,
    html: bodyHtml,
    text: email.bodyText ?? undefined,
    replyTo: email.replyTo ?? undefined,
  });

  return prisma.email.update({
    where: { id: email.id },
    data: {
      status: "SENT",
      folder: "SENT",
      sentAt: new Date(),
      isDraft: false,
      trackingId,
      messageId: messageId ?? undefined,
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
