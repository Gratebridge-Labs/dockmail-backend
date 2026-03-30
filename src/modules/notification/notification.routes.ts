import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as controller from "./notification.controller";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);
notificationRouter.get("/", controller.listNotifications);
notificationRouter.patch("/:notificationId/read", controller.markRead);
notificationRouter.post("/read-all", controller.markAllRead);
notificationRouter.delete("/:notificationId", controller.deleteNotification);
notificationRouter.get("/count", controller.count);
