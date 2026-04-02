import path from "node:path";
import { Request, Response } from "express";
import { env } from "../../config/env";
import { fail, ok } from "../../utils/response";

export async function uploadFile(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  if (!req.file) return fail(res, "VALIDATION_ERROR", "File is required", 400);

  const filename = path.basename(req.file.filename);
  const base = (env.API_URL || "").replace(/\/$/, "");
  const url = `${base}/uploads/${encodeURIComponent(filename)}`;

  return ok(
    res,
    {
      url,
      filename,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    },
    201,
  );
}

