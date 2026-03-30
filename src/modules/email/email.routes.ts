import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import * as controller from "./email.controller";
import { createDraftSchema, sendDraftSchema } from "./email.schema";

export const emailRouter = Router({ mergeParams: true });

emailRouter.use(requireAuth, requireRole("MEMBER", "ADMIN", "OWNER"));
emailRouter.get("/", controller.listEmails);
emailRouter.post("/", validate({ body: createDraftSchema }), controller.createDraft);
emailRouter.post("/:emailId/send", validate({ body: sendDraftSchema }), controller.sendDraft);
