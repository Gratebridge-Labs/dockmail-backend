import { Request, Response } from "express";
import { fail, ok } from "../../utils/response";
import * as service from "./email.service";

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
    const data = await service.sendDraft(String(req.params.mailboxId), String(req.params.emailId), req.body.scheduledAt);
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
