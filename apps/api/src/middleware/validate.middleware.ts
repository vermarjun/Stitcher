import { Request, Response, NextFunction } from "express";
import { ZodTypeAny, z } from "zod";
import { AppError } from "../util/AppError";

interface ValidationSchemas {
    body?: ZodTypeAny;
    query?: ZodTypeAny;
    params?: ZodTypeAny;
}

/**
 * Middleware factory that validates request body/query/params against Zod schemas.
 * Replaces req.body / req.query / req.params with the parsed (coerced + stripped) values.
 * Throws an AppError(400, 'validation_error') listing all issues on failure.
 *
 * Usage (Phase B — not wired to any routes yet):
 *   router.post('/foo', validate({ body: myBodySchema }), myController)
 */
export function validate(schemas: ValidationSchemas) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const combinedSchema = z.object({
            ...(schemas.body ? { body: schemas.body } : {}),
            ...(schemas.query ? { query: schemas.query } : {}),
            ...(schemas.params ? { params: schemas.params } : {}),
        });

        const result = combinedSchema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        if (!result.success) {
            const issues = result.error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ");
            next(new AppError(400, issues, "validation_error"));
            return;
        }

        const data = result.data as {
            body?: unknown;
            query?: unknown;
            params?: unknown;
        };
        if (data.body !== undefined) req.body = data.body;
        if (data.query !== undefined) req.query = data.query as qs.ParsedQs;
        if (data.params !== undefined) req.params = data.params as Record<string, string>;

        next();
    };
}
