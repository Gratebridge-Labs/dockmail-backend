import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { uploadPublic } from "./upload.storage";
import * as controller from "./upload.controller";

export const uploadRouter = Router();

uploadRouter.use(requireAuth);
uploadRouter.post("/", uploadPublic.single("file"), controller.uploadFile);

