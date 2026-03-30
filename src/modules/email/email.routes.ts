import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import * as controller from "./email.controller";
import { bulkActionSchema, createDraftSchema, moveEmailSchema, sendDraftSchema } from "./email.schema";

export const emailRouter = Router({ mergeParams: true });

emailRouter.use(requireAuth, requireRole("MEMBER", "ADMIN", "OWNER"));
emailRouter.get("/", controller.listEmails);
emailRouter.post("/", validate({ body: createDraftSchema }), controller.createDraft);
emailRouter.post("/:emailId/send", validate({ body: sendDraftSchema }), controller.sendDraft);
emailRouter.delete("/:emailId", controller.deleteEmail);
emailRouter.delete("/:emailId/permanent", controller.permanentDeleteEmail);
emailRouter.post("/bulk", validate({ body: bulkActionSchema }), controller.bulkAction);
emailRouter.patch("/:emailId/move", validate({ body: moveEmailSchema }), controller.moveEmail);
emailRouter.get("/:emailId/thread", controller.thread);
emailRouter.post("/:emailId/cancel-schedule", controller.cancelSchedule);
