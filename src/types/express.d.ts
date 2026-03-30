import { Role } from "@prisma/client";

export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
      };
      workspaceId?: string;
      workspaceMember?: {
        role: Role;
      };
    }
  }
}
