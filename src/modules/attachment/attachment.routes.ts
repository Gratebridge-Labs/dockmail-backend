import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { upload } from "../../middleware/upload";
import * as controller from "./attachment.controller";

export const attachmentRouter = Router({ mergeParams: true });

attachmentRouter.use(requireAuth, requireRole("MEMBER", "ADMIN", "OWNER"));
attachmentRouter.post("/:emailId/attachments", upload.single("file"), controller.uploadAttachment);
attachmentRouter.get("/:emailId/attachments/:attachmentId", controller.downloadAttachment);
attachmentRouter.delete("/:emailId/attachments/:attachmentId", controller.deleteAttachment);
