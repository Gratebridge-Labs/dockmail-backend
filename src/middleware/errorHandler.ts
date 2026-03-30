import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { fail } from "../utils/response";
import { logger } from "../config/logger";

export function notFound(_req: Request, res: Response) {
  return fail(res, "NOT_FOUND", "Route not found", 404);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  logger.error("Unhandled error", err);
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return fail(res, "CONFLICT", "Resource already exists", 409);
    if (err.code === "P2025") return fail(res, "NOT_FOUND", "Resource not found", 404);
  }
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return fail(res, "VALIDATION_ERROR", "FILE_TOO_LARGE", 400);
  }
  return fail(res, "INTERNAL_ERROR", "An unexpected error occurred", 500);
}
