import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { validate } from "../../middleware/validate";
import * as controller from "./settings.controller";
import { updateNotificationPrefsSchema, updateProfileSchema } from "./settings.schema";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);
settingsRouter.get("/", controller.getSettings);
settingsRouter.patch("/profile", validate({ body: updateProfileSchema }), controller.updateProfile);
settingsRouter.post("/avatar", upload.single("avatar"), controller.uploadAvatar);
settingsRouter.delete("/avatar", controller.deleteAvatar);
settingsRouter.patch(
  "/notifications",
  validate({ body: updateNotificationPrefsSchema }),
  controller.updateNotificationPrefs,
);
settingsRouter.get("/sessions", controller.listSessions);
settingsRouter.delete("/sessions/:sessionId", controller.revokeSession);
