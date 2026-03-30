import { Router } from "express";
import * as controller from "./auth.controller";
import { validate } from "../../middleware/validate";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schema";
import { authForgotPasswordLimiter, authLoginLimiter, authRegisterLimiter } from "../../middleware/rateLimit";
import { requireAuth } from "../../middleware/auth";

export const authRouter = Router();

authRouter.post("/register", authRegisterLimiter, validate({ body: registerSchema }), controller.register);
authRouter.post("/login", authLoginLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post("/refresh", validate({ body: refreshSchema }), controller.refresh);
authRouter.post("/logout", validate({ body: refreshSchema }), controller.logout);
authRouter.post("/logout-all", requireAuth, controller.logoutAll);
authRouter.get("/me", requireAuth, controller.me);
authRouter.post("/forgot-password", authForgotPasswordLimiter, (_req, res) =>
  res.json({ success: true, data: { message: "If email exists, reset was sent." } }),
);
