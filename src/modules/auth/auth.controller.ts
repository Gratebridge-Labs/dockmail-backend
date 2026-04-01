import { Request, Response } from "express";
import { fail, ok } from "../../utils/response";
import * as service from "./auth.service";

function mapAuthError(res: Response, error: unknown) {
  const msg = error instanceof Error ? error.message : "Unknown error";
  if (msg === "INVALID_CREDENTIALS") return fail(res, "INVALID_CREDENTIALS", "Invalid credentials", 401);
  if (msg === "UNAUTHORIZED") return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  if (msg === "OTP_INVALID") return fail(res, "OTP_INVALID", "Invalid OTP", 400);
  if (msg === "OTP_EXPIRED") return fail(res, "OTP_EXPIRED", "OTP expired", 400);
  if (msg.startsWith("CONFLICT")) return fail(res, "CONFLICT", msg.split(":")[1] || "Conflict", 409);
  return fail(res, "INTERNAL_ERROR", "Something went wrong", 500);
}

export async function register(req: Request, res: Response) {
  try {
    const data = await service.registerUser(req.body);
    return ok(res, data, 201);
  } catch (error) {
    return mapAuthError(res, error);
  }
}

export async function verifyRegisterOtp(req: Request, res: Response) {
  try {
    const data = await service.verifyRegisterOtp(req.body);
    return ok(res, data);
  } catch (error) {
    return mapAuthError(res, error);
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = await service.loginUser(req.body);
    return ok(res, data);
  } catch (error) {
    return mapAuthError(res, error);
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const data = await service.refreshAuthToken(req.body.refreshToken);
    return ok(res, { tokens: data });
  } catch (error) {
    return mapAuthError(res, error);
  }
}

export async function logout(req: Request, res: Response) {
  await service.logoutByRefreshToken(req.body.refreshToken);
  return ok(res, { loggedOut: true });
}

export async function logoutAll(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  await service.logoutAll(req.user.id);
  return ok(res, { loggedOut: true });
}

export async function me(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.me(req.user.id);
  return ok(res, data);
}
