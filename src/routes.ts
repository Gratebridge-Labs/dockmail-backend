import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { workspaceRouter } from "./modules/workspace/workspace.routes";
import { domainRouter } from "./modules/domain/domain.routes";
import { mailboxRouter } from "./modules/mailbox/mailbox.routes";
import { emailRouter } from "./modules/email/email.routes";
import { trackingRouter } from "./modules/tracking/tracking.routes";

export const rootRouter = Router();

rootRouter.get("/health", (_req, res) => res.json({ success: true, data: { ok: true } }));

rootRouter.use("/v1/auth", authRouter);
rootRouter.use("/v1/workspaces", workspaceRouter);
rootRouter.use("/v1/workspaces/:workspaceId/domains", domainRouter);
rootRouter.use("/v1/workspaces/:workspaceId/mailboxes", mailboxRouter);
rootRouter.use("/v1/mailboxes/:mailboxId/emails", emailRouter);
rootRouter.use("/v1/track", trackingRouter);
