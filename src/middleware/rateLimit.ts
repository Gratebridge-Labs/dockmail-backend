import rateLimit from "express-rate-limit";

export const authLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 });
export const authRegisterLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 3 });
export const authForgotPasswordLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 3 });
export const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 200 });
