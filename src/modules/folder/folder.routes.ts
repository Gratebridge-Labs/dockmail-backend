import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import * as controller from "./folder.controller";
import { createFolderSchema, updateFolderSchema } from "./folder.schema";

export const folderRouter = Router({ mergeParams: true });

folderRouter.use(requireAuth, requireRole("MEMBER", "ADMIN", "OWNER"));
folderRouter.get("/", controller.listFolders);
folderRouter.post("/", validate({ body: createFolderSchema }), controller.createFolder);
folderRouter.patch("/:folderId", validate({ body: updateFolderSchema }), controller.updateFolder);
folderRouter.delete("/:folderId", controller.deleteFolder);
