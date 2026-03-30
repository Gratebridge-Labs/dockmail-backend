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
