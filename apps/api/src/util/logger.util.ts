import winston from "winston";
import { trace } from "@opentelemetry/api";
import { config } from "../config";

const { combine, timestamp, json, colorize, simple } = winston.format;

const isProd = config.NODE_ENV === "production";

// Log<->trace correlation (OBSERVABILITY §3): if there's an active span, stamp
// each log record with trace_id/span_id so Loki↔Tempo can jump between them.
// Defensive no-op when no span is active or OTel isn't initialized.
// winston.format is itself the format factory; call it to build a custom format.
const traceContext = winston.format((info) => {
    const span = trace.getActiveSpan();
    if (span) {
        const ctx = span.spanContext();
        if (ctx?.traceId) {
            info["trace_id"] = ctx.traceId;
            info["span_id"] = ctx.spanId;
        }
    }
    return info;
});

const logger = winston.createLogger({
    level: config.LOG_LEVEL,
    format: isProd
        ? combine(traceContext(), timestamp(), json())
        : combine(traceContext(), colorize(), timestamp({ format: "HH:mm:ss" }), simple()),
    transports: [new winston.transports.Console()],
});

export default logger;
