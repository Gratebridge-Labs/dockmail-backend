import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { env } from "../../config/env";

function safeBasename(name: string) {
  // Drop path parts and keep a conservative filename (avoid control chars).
  const base = path.basename(name).replace(/[^\w.\-()+\s]/g, "_").trim();
  return base || "file";
}

function ensurePublicDir() {
  const dir = path.resolve(env.UPLOAD_DIR, "public");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const uploadPublic = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, ensurePublicDir());
    },
    filename(_req, file, cb) {
      const original = safeBasename(file.originalname);
      const ext = path.extname(original);
      const stem = ext ? original.slice(0, -ext.length) : original;
      const id = crypto.randomBytes(16).toString("hex");
      const finalName = `${stem.slice(0, 60)}-${id}${ext}`.replace(/\s+/g, "-");
      cb(null, finalName);
    },
  }),
  limits: { fileSize: env.MAX_FILE_SIZE },
});

