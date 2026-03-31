import { z } from "zod";

export const createDomainSchema = z.object({
  domain: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/),
});

export const resetDomainSchema = z.object({
  confirm: z.string().transform((v) => v === "true"),
});
