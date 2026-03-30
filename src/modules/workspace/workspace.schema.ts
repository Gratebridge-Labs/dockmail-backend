import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
  logoUrl: z.string().url().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional(),
  signature: z.string().optional(),
});
