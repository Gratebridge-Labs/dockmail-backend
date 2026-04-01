import { Router } from "express";
import * as controller from "./auth.controller";
import { validate } from "../../middleware/validate";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendVerifyEmailSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyRegisterOtpSchema,
} from "./auth.schema";
import { authForgotPasswordLimiter, authLoginLimiter, authRegisterLimiter } from "../../middleware/rateLimit";
import { requireAuth } from "../../middleware/auth";

export const authRouter = Router();

authRouter.post("/register", authRegisterLimiter, validate({ body: registerSchema }), controller.register);
authRouter.post(
  "/register/verify-otp",
  authRegisterLimiter,
  validate({ body: verifyRegisterOtpSchema }),
  controller.verifyRegisterOtp,
);
authRouter.post("/login", authLoginLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post("/refresh", validate({ body: refreshSchema }), controller.refresh);
authRouter.post("/logout", validate({ body: refreshSchema }), controller.logout);
authRouter.post("/logout-all", requireAuth, controller.logoutAll);
authRouter.get("/me", requireAuth, controller.me);
authRouter.post("/verify-email", validate({ body: verifyEmailSchema }), controller.verifyEmail);
authRouter.post(
  "/verify-email/resend",
  authRegisterLimiter,
  validate({ body: resendVerifyEmailSchema }),
  controller.resendVerifyEmail,
);
authRouter.post(
  "/forgot-password",
  authForgotPasswordLimiter,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword,
);
authRouter.post("/reset-password", authForgotPasswordLimiter, validate({ body: resetPasswordSchema }), controller.resetPassword);
