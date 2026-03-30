import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../config/database";

export async function addAttachment(input: {
  emailId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}) {
  const email = await prisma.email.findUnique({
    where: { id: input.emailId },
    include: { mailbox: true },
  });
  if (!email) throw new Error("NOT_FOUND");
  const projectedMb = email.mailbox.storageUsedMb + Math.ceil(input.sizeBytes / 1024 / 1024);
  if (projectedMb > email.mailbox.storageLimitMb) throw new Error("STORAGE_LIMIT_EXCEEDED");
  const attachment = await prisma.attachment.create({
    data: input,
  });
  await prisma.mailbox.update({
    where: { id: email.mailbox.id },
    data: { storageUsedMb: projectedMb },
  });
  return attachment;
}

export function getAttachment(attachmentId: string, emailId: string) {
  return prisma.attachment.findFirst({ where: { id: attachmentId, emailId } });
}

export async function deleteAttachment(attachmentId: string, emailId: string) {
  const attachment = await getAttachment(attachmentId, emailId);
  if (!attachment) throw new Error("NOT_FOUND");
  const email = await prisma.email.findUnique({ where: { id: emailId }, include: { mailbox: true } });
  if (email) {
    const freed = Math.ceil(attachment.sizeBytes / 1024 / 1024);
    await prisma.mailbox.update({
      where: { id: email.mailbox.id },
      data: { storageUsedMb: Math.max(0, email.mailbox.storageUsedMb - freed) },
    });
  }
  if (fs.existsSync(attachment.storagePath)) fs.unlinkSync(attachment.storagePath);
  await prisma.attachment.delete({ where: { id: attachment.id } });
  return { deleted: true };
}

export function attachmentPath(uploadRoot: string, workspaceId: string, mailboxId: string, emailId: string, filename: string) {
  const dir = path.join(uploadRoot, workspaceId, mailboxId, emailId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}
