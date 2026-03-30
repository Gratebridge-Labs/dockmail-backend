import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { workspaceRouter } from "./modules/workspace/workspace.routes";
import { domainRouter } from "./modules/domain/domain.routes";
import { mailboxRouter } from "./modules/mailbox/mailbox.routes";
import { emailRouter } from "./modules/email/email.routes";
import { trackingRouter } from "./modules/tracking/tracking.routes";
import { teamRouter, acceptInviteRouter } from "./modules/team/team.routes";
import { billingRouter } from "./modules/billing/billing.routes";
import { notificationRouter } from "./modules/notification/notification.routes";
import { settingsRouter } from "./modules/settings/settings.routes";
import { folderRouter } from "./modules/folder/folder.routes";
import { attachmentRouter } from "./modules/attachment/attachment.routes";

export const rootRouter = Router();

rootRouter.get("/health", (_req, res) => res.json({ success: true, data: { ok: true } }));

rootRouter.use("/v1/auth", authRouter);
rootRouter.use("/v1/auth", acceptInviteRouter);
rootRouter.use("/v1/workspaces", workspaceRouter);
rootRouter.use("/v1/workspaces/:workspaceId/domains", domainRouter);
rootRouter.use("/v1/workspaces/:workspaceId/mailboxes", mailboxRouter);
rootRouter.use("/v1/workspaces/:workspaceId/team", teamRouter);
rootRouter.use("/v1/workspaces/:workspaceId/billing", billingRouter);
rootRouter.use("/v1/mailboxes/:mailboxId/emails", emailRouter);
rootRouter.use("/v1/mailboxes/:mailboxId/folders", folderRouter);
rootRouter.use("/v1/mailboxes/:mailboxId/emails", attachmentRouter);
rootRouter.use("/v1/notifications", notificationRouter);
rootRouter.use("/v1/users/settings", settingsRouter);
rootRouter.use("/v1/track", trackingRouter);
