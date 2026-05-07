import { Request, Response, NextFunction } from "express";
import { AppError } from "../util/AppError";
import logger from "../util/logger.util";
import { config } from "../config";

export function globalErrorHandler(
    err: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction
): void {
    const traceId = (req as Request & { id?: string }).id ?? "unknown";

    if (err instanceof AppError && err.isOperational) {
        logger.warn({
            message: err.message,
            statusCode: err.statusCode,
            code: err.code,
            traceId,
            path: req.path,
        });

        res.status(err.statusCode).json({
            error: {
                message: err.message,
                ...(err.code ? { code: err.code } : {}),
                traceId,
            },
        });
        return;
    }

    // Programmer / unexpected error — log full details, hide from client in prod
    logger.error({
        message: "Unexpected error",
        error: err.message,
        stack: err.stack,
        traceId,
        path: req.path,
    });

    const message =
        config.NODE_ENV === "production"
            ? "An unexpected error occurred"
            : err.message;

    res.status(500).json({
        error: {
            message,
            traceId,
        },
    });
}
