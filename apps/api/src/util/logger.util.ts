import winston from "winston";
import { config } from "../config";

const { combine, timestamp, json, colorize, simple } = winston.format;

const isProd = config.NODE_ENV === "production";

const logger = winston.createLogger({
    level: config.LOG_LEVEL,
    format: isProd
        ? combine(timestamp(), json())
        : combine(colorize(), timestamp({ format: "HH:mm:ss" }), simple()),
    transports: [new winston.transports.Console()],
});

export default logger;
