import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import crypto from "crypto";

// Config & logger — must be imported before anything that reads config
import { API_PREFIX, PORT, config } from "./config";
import logger from "./util/logger.util";

// DB & Redis
import connectDB from "./util/database.util";
import { initRedisSubscriber, redisSubscriber } from "./util/redis.util";

// Middleware
import { globalErrorHandler } from "./middleware/error.middleware";

// Import Routes
import userRoutes from "./router/user.router";
import projectRoutes from "./router/project.router";
import templateRoutes from "./router/templates.router";
import assetRoutes from "./router/asset.router";
import trackRoutes from "./router/track.router";
import editChatRoutes from "./router/editChat.router";
import generateChatRoutes from "./router/generateChat.router";
import timelineRoutes from "./router/timeline.router";
import userApiKeyRoutes from "./router/userapikeys.router";
import projectScriptRoutes from "./router/script.router";
import communityPostRoutes from "./router/communityPost.router";
import backpackRoutes from "./router/backpack.router";
import leaderboardRoutes from "./router/leaderboard.router";
import notificationRoutes from "./router/notification.router";
import paymentRoutes from "./router/payment.router";

// ─── CORS origins ─────────────────────────────────────────────────────────────
const allowedOrigins = config.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, Postman, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
    },
    credentials: true,
};

// ─── App & HTTP server ────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
export const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
    },
});

// ─── Request ID middleware ────────────────────────────────────────────────────
app.use((req: Request & { id?: string }, _res: Response, next: NextFunction) => {
    req.id = crypto.randomUUID();
    next();
});

// ─── Security & transport middleware ─────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// ─── Global rate limit ────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});
app.use(globalLimiter);

// Stricter limiters for auth endpoints
// TODO (Phase B): move these into user.router.ts instead of applying here
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});
app.use(`${API_PREFIX}/users/login`, authLimiter);
app.use(`${API_PREFIX}/users/signup`, authLimiter);

// ─── Socket.IO connection logic ───────────────────────────────────────────────
io.on("connection", (socket) => {
    logger.debug({ message: "Socket connected", socketId: socket.id });

    socket.on("join_chat", (chatId: unknown) => {
        if (chatId && typeof chatId === "string") {
            socket.join(chatId);
            logger.debug({ message: "Socket joined chat", socketId: socket.id, chatId });
        }
    });

    socket.on("disconnect", () => {
        logger.debug({ message: "Socket disconnected", socketId: socket.id });
    });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get(`${API_PREFIX}/health`, async (_req: Request, res: Response) => {
    let mongoStatus: "ok" | "fail" = "fail";
    let redisStatus: "ok" | "fail" = "fail";

    try {
        if (mongoose.connection.db) {
            await mongoose.connection.db.admin().ping();
            mongoStatus = "ok";
        }
    } catch (_err) {
        mongoStatus = "fail";
    }

    try {
        const pong = await redisSubscriber.ping();
        redisStatus = pong === "PONG" ? "ok" : "fail";
    } catch (_err) {
        redisStatus = "fail";
    }

    const allHealthy = mongoStatus === "ok" && redisStatus === "ok";
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
        status: allHealthy ? "ok" : "degraded",
        checks: {
            mongo: mongoStatus,
            redis: redisStatus,
            uptime: process.uptime(),
            version: process.env.npm_package_version ?? "0.1.0",
        },
    });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/project`, projectRoutes);
app.use(`${API_PREFIX}/template`, templateRoutes);
app.use(`${API_PREFIX}/asset`, assetRoutes);
app.use(`${API_PREFIX}/track`, trackRoutes);
app.use(`${API_PREFIX}/editchat`, editChatRoutes);
app.use(`${API_PREFIX}/generatechat`, generateChatRoutes);
app.use(`${API_PREFIX}/timeline`, timelineRoutes);
app.use(`${API_PREFIX}/apikeys`, userApiKeyRoutes);
app.use(`${API_PREFIX}/script`, projectScriptRoutes);
app.use(`${API_PREFIX}/community`, communityPostRoutes);
app.use(`${API_PREFIX}/backpack`, backpackRoutes);
app.use(`${API_PREFIX}/leaderboard`, leaderboardRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { message: "Route not found" } });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use(globalErrorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const server = httpServer.listen(PORT, async () => {
    try {
        await connectDB();
        logger.info({ message: `Server running`, port: PORT });
        await initRedisSubscriber(io);
    } catch (error) {
        logger.error({ message: "Failed to start services", error: String(error) });
    }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const SHUTDOWN_TIMEOUT_MS = 30_000;

async function shutdown(signal: string) {
    logger.info({ message: `Received ${signal}, shutting down gracefully...` });

    // Stop accepting new connections
    server.close(async () => {
        logger.info("HTTP server closed");

        const forceExit = setTimeout(() => {
            logger.error("Graceful shutdown timed out — forcing exit");
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        forceExit.unref();

        try {
            await mongoose.connection.close();
            logger.info("MongoDB connection closed");

            await redisSubscriber.quit();
            logger.info("Redis connection closed");

            clearTimeout(forceExit);
            logger.info("Shutdown complete");
            process.exit(0);
        } catch (err) {
            logger.error({ message: "Error during shutdown", error: String(err) });
            process.exit(1);
        }
    });
}

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void shutdown("SIGINT"); });
