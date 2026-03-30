import jwt from "jsonwebtoken";
import { env } from "../config/env";

export function signAccessToken(payload: object) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: object) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken<T = jwt.JwtPayload>(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as T;
}

export function verifyRefreshToken<T = jwt.JwtPayload>(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as T;
}
