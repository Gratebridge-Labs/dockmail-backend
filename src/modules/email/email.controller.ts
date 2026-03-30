import { Request, Response } from "express";
import { fail, ok } from "../../utils/response";
import * as service from "./email.service";
import { queueScheduledSend, queueSend } from "./email.queue";

export async function listEmails(req: Request, res: Response) {
  const data = await service.listEmails(String(req.params.mailboxId), req.query.folder as string | undefined);
  return ok(res, data);
}

export async function createDraft(req: Request, res: Response) {
  const data = await service.createDraft(String(req.params.mailboxId), req.body);
  return ok(res, data, 201);
}

export async function sendDraft(req: Request, res: Response) {
  try {
    const mailboxId = String(req.params.mailboxId);
    const emailId = String(req.params.emailId);
    const data = await service.sendDraft(mailboxId, emailId, req.body.scheduledAt);
    if (req.body.scheduledAt) {
      await queueScheduledSend(mailboxId, emailId, new Date(req.body.scheduledAt));
    } else {
      await queueSend(mailboxId, emailId);
    }
    return ok(res, data);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return fail(res, "NOT_FOUND", "Email not found", 404);
    }
    if (error instanceof Error && error.message === "VALIDATION") {
      return fail(res, "VALIDATION_ERROR", "Draft requires recipients and subject", 400);
    }
    return fail(res, "INTERNAL_ERROR", "Failed to send draft", 500);
  }
}

export async function deleteEmail(req: Request, res: Response) {
  await service.moveToTrash(String(req.params.mailboxId), String(req.params.emailId));
  return ok(res, { deleted: true });
}

export async function permanentDeleteEmail(req: Request, res: Response) {
  try {
    await service.permanentDelete(String(req.params.mailboxId), String(req.params.emailId));
    return ok(res, { deleted: true });
  } catch {
    return fail(res, "NOT_FOUND", "Email not found in trash", 404);
  }
}

export async function bulkAction(req: Request, res: Response) {
  const data = await service.bulkAction(String(req.params.mailboxId), req.body);
  return ok(res, data);
}

export async function moveEmail(req: Request, res: Response) {
  const folder = req.body.folder || "INBOX";
  await service.moveEmail(String(req.params.mailboxId), String(req.params.emailId), folder);
  return ok(res, { moved: true });
}

export async function thread(req: Request, res: Response) {
  const data = await service.getThread(String(req.params.mailboxId), String(req.params.emailId));
  if (!data) return fail(res, "NOT_FOUND", "Email not found", 404);
  return ok(res, data);
}

export async function cancelSchedule(req: Request, res: Response) {
  await service.cancelSchedule(String(req.params.mailboxId), String(req.params.emailId));
  return ok(res, { cancelled: true });
}
