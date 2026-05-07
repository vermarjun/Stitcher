/**
 * ServiceError — thrown by all HTTP service clients.
 *
 * Carries enough context for the BullMQ worker to decide retry policy:
 *   - `service`    : human-readable name ("rag" | "agent" | "render")
 *   - `status`     : HTTP status code, or 0 for network/timeout errors
 *   - `body`       : raw response body (parsed JSON if possible, else string)
 *   - `retryAfter` : seconds to wait before retry (from Retry-After header, 503s)
 *   - `traceId`    : propagated from the per-call traceId parameter
 *
 * Note on axios detection: TypeScript 5.9 changed how it infers `AxiosStatic`,
 * making `axios.isAxiosError` unavailable on the default export type. We use a
 * structural guard instead — an axios error always has `isAxiosError === true`
 * on the instance. This is identical to what axios.isAxiosError() does internally.
 */

export interface ServiceErrorContext {
    service: string;
    status: number;
    body: unknown;
    retryAfter?: number;
    traceId?: string;
}

export class ServiceError extends Error {
    readonly service: string;
    readonly status: number;
    readonly body: unknown;
    readonly retryAfter?: number;
    readonly traceId?: string;

    constructor(ctx: ServiceErrorContext) {
        super(
            `[${ctx.service}] HTTP ${ctx.status}` +
                (ctx.retryAfter != null ? ` — retry after ${ctx.retryAfter}s` : "")
        );
        this.name = "ServiceError";
        this.service = ctx.service;
        this.status = ctx.status;
        this.body = ctx.body;
        this.retryAfter = ctx.retryAfter;
        this.traceId = ctx.traceId;
    }
}

/** Minimal structural shape of an axios error — avoids importing axios types. */
interface AxiosLikeError {
    isAxiosError: true;
    response?: {
        status: number;
        data: unknown;
        headers: Record<string, string | undefined>;
    };
    message: string;
}

/** Type guard: true when `err` is an axios error instance. */
function isAxiosLikeError(err: unknown): err is AxiosLikeError {
    return (
        typeof err === "object" &&
        err !== null &&
        "isAxiosError" in err &&
        (err as Record<string, unknown>)["isAxiosError"] === true
    );
}

/**
 * Map an Axios error (or any other error) to a ServiceError.
 * Reads Retry-After header when status is 503.
 */
export function toServiceError(
    service: string,
    err: unknown,
    traceId?: string
): ServiceError {
    if (isAxiosLikeError(err)) {
        const status = err.response?.status ?? 0;
        const body: unknown = err.response?.data ?? err.message;

        let retryAfter: number | undefined;
        if (status === 503) {
            const header = err.response?.headers?.["retry-after"];
            if (header != null) {
                const parsed = Number(header);
                if (!Number.isNaN(parsed)) retryAfter = parsed;
            }
        }

        return new ServiceError({ service, status, body, retryAfter, traceId });
    }

    // Non-Axios error (e.g. stream parsing failure, network error)
    return new ServiceError({
        service,
        status: 0,
        body: err instanceof Error ? err.message : String(err),
        traceId,
    });
}
