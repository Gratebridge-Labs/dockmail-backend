import fs from "node:fs";
import { Request, Response } from "express";
import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { fail, ok } from "../../utils/response";
import * as service from "./attachment.service";

export async function uploadAttachment(req: Request, res: Response) {
  if (!req.file) return fail(res, "VALIDATION_ERROR", "Attachment is required", 400);
  const email = await prisma.email.findUnique({
    where: { id: String(req.params.emailId) },
    include: { mailbox: true },
  });
  if (!email || email.mailbox.id !== String(req.params.mailboxId)) {
    return fail(res, "NOT_FOUND", "Email not found", 404);
  }
  const storagePath = service.attachmentPath(
    env.UPLOAD_DIR,
    email.mailbox.workspaceId,
    email.mailbox.id,
    email.id,
    req.file.originalname,
  );
  fs.renameSync(req.file.path, storagePath);
  try {
    const data = await service.addAttachment({
      emailId: email.id,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storagePath,
    });
    return ok(res, data, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "STORAGE_LIMIT_EXCEEDED") {
      return fail(res, "STORAGE_LIMIT_EXCEEDED", "Mailbox storage exceeded", 409);
    }
    return fail(res, "INTERNAL_ERROR", "Failed to upload attachment", 500);
  }
}

export async function downloadAttachment(req: Request, res: Response) {
  const attachment = await service.getAttachment(String(req.params.attachmentId), String(req.params.emailId));
  if (!attachment) return fail(res, "NOT_FOUND", "Attachment not found", 404);
  return res.download(attachment.storagePath, attachment.filename);
}

export async function deleteAttachment(req: Request, res: Response) {
  try {
    const data = await service.deleteAttachment(String(req.params.attachmentId), String(req.params.emailId));
    return ok(res, data);
  } catch {
    return fail(res, "NOT_FOUND", "Attachment not found", 404);
  }
}
