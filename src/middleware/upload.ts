import multer from "multer";
import { env } from "../config/env";

export const upload = multer({
  dest: env.UPLOAD_DIR,
  limits: { fileSize: env.MAX_FILE_SIZE },
});
