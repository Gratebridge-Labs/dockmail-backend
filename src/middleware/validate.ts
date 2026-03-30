import { NextFunction, Request, Response } from "express";
import { z, ZodTypeAny } from "zod";
import { fail } from "../utils/response";

type Schemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const checks: Array<[string, ZodTypeAny | undefined, unknown]> = [
      ["body", schemas.body, req.body],
      ["params", schemas.params, req.params],
      ["query", schemas.query, req.query],
    ];
    for (const [, schema, value] of checks) {
      if (!schema) continue;
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        return fail(res, "VALIDATION_ERROR", "Invalid request data", 400, z.treeifyError(parsed.error));
      }
    }
    return next();
  };
}
