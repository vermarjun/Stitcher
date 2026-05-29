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
import { API_PREFIX, PORT, config, JWT_CONFIG, ADMIN_DASHBOARD_ENABLED } from "./config";
import logger from "./util/logger.util";
import jwt from "jsonwebtoken";
import { canAccessProject } from "./util/projectAccess.util";

// DB & Redis
import connectDB from "./util/database.util";
import { initRedisSubscriber, redisSubscriber } from "./util/redis.util";
import { pubClient } from "./queue/connection";

// Observability: queue dashboard + queue-depth metrics sampler
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { generationQueue } from "./queue/generationQueue";
import { editQueue } from "./queue/editQueue";
import { startQueueDepthSampler, stopQueueDepthSampler } from "./util/metrics.util";
import auth from "./middleware/auth.middleware";
import GenerateChat from "./model/generateChat.model";
import User from "./model/user.model";
import { Types } from "mongoose";

// Middleware
import { globalErrorHandler } from "./middleware/error.middleware";
import { requireFeature } from "./middleware/feature.middleware";

// Queue workers — import after express setup so workers boot with the server
import { generationWorker } from "./queue/generationWorker";
import { editWorker } from "./queue/editWorker";

// Import Routes
import userRoutes from "./router/user.router";
import projectRoutes from "./router/project.router";
import templateRoutes from "./router/templates.router";
import assetRoutes from "./router/asset.router";
import trackRoutes from "./router/track.router";
import editChatRoutes from "./router/editChat.router";
import generateChatRoutes from "./router/generateChat.router";
import timelineRoutes from "./router/timeline.router";
import shareRoutes from "./router/share.router";
import userApiKeyRoutes from "./router/userapikeys.router";
import projectScriptRoutes from "./router/script.router";
import communityPostRoutes from "./router/communityPost.router";
import backpackRoutes from "./router/backpack.router";
import leaderboardRoutes from "./router/leaderboard.router";
import notificationRoutes from "./router/notification.router";
import paymentRoutes from "./router/payment.router";
import memoryRoutes from "./router/memory.router";
import collabRoutes from "./router/collab.router";
import adminLiveRoutes from "./router/adminLive.router";
import { isAdminUser } from "./middleware/admin.middleware";
import { initYjsServer } from "./collab/yjs.server";

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

// ─── Yjs real-time collaboration (attaches /yjs|<projectId> namespaces) ──────
initYjsServer(io);

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

// ─── Socket.IO auth middleware ────────────────────────────────────────────────
io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
        return next(new Error("Authentication required"));
    }

    try {
        const decoded = jwt.verify(token, JWT_CONFIG.secret);
        if (typeof decoded === "string" || !("userId" in decoded)) {
            return next(new Error("Invalid token structure"));
        }
        socket.data.userId = (decoded as { userId: string }).userId;
        next();
    } catch (err) {
        logger.warn({ message: "Socket auth failed", error: String(err) });
        next(new Error("Invalid token"));
    }
});

// ─── Socket.IO connection logic ───────────────────────────────────────────────
io.on("connection", (socket) => {
    logger.debug({ message: "Socket connected", socketId: socket.id });

    socket.on("join_chat", async (chatId: unknown) => {
        if (!chatId || typeof chatId !== "string") return;

        const userId = socket.data.userId as string | undefined;
        if (!userId) {
            logger.warn({ message: "Socket join_chat denied: no userId on socket", socketId: socket.id });
            return;
        }

        try {
            const chat = await GenerateChat.findById(chatId).select("userId projectId").lean();
            if (!chat) {
                logger.warn({ message: "Socket join_chat denied: chat not found", chatId, socketId: socket.id });
                return;
            }

            // Check ownership: direct chat.userId match or project membership
            let authorized = false;

            if (chat.userId && chat.userId.toString() === userId) {
                authorized = true;
            } else {
                const owner = await User.exists({
                    _id: new Types.ObjectId(userId),
                    projects: chat.projectId,
                });
                authorized = !!owner;
            }

            if (!authorized) {
                logger.warn({ message: "Socket join_chat denied: ownership check failed", chatId, socketId: socket.id, userId });
                return;
            }

            socket.join(chatId);
            logger.debug({ message: "Socket joined chat", socketId: socket.id, chatId });
        } catch (err) {
            logger.error({ message: "Socket join_chat error", error: String(err), socketId: socket.id });
        }
    });

    socket.on("join_project", async (projectId: unknown) => {
        if (!projectId || typeof projectId !== "string") return;

        const userId = socket.data.userId as string | undefined;
        if (!userId) {
            logger.warn({ message: "Socket join_project denied: no userId on socket", socketId: socket.id });
            socket.emit("error", { message: "unauthorized" });
            return;
        }

        try {
            const ok = await canAccessProject(userId, projectId);
            if (!ok) {
                logger.warn({ message: "Socket join_project denied: access check failed", projectId, socketId: socket.id, userId });
                socket.emit("error", { message: "forbidden" });
                return;
            }

            socket.join(`project:${projectId}`);
            socket.emit("project_joined", { projectId });
            logger.debug({ message: "Socket joined project", socketId: socket.id, projectId });
        } catch (err) {
            logger.error({ message: "Socket join_project error", error: String(err), socketId: socket.id });
            socket.emit("error", { message: "internal error" });
        }
    });

    // ── Admin live "god view" firehose (OBSERVABILITY §5) ───────────────────
    // An admin joins the `admin:live` room to receive `admin_update` events for
    // EVERY in-flight job (relayed in redis.util.ts). Gated with the SAME policy
    // as bull-board: ADMIN_DASHBOARD_ENABLED + valid JWT + admin role. The
    // socket already passed the io.use() JWT middleware, so socket.data.userId
    // is trustworthy here.
    socket.on("join_admin_live", async () => {
        const userId = socket.data.userId as string | undefined;
        const ok = await isAdminUser(userId);
        if (!ok) {
            logger.warn({ message: "join_admin_live denied", socketId: socket.id, userId });
            socket.emit("admin_live_denied", { message: "Admin access required" });
            return;
        }
        socket.join("admin:live");
        socket.emit("admin_live_joined");
        logger.info({ message: "Socket joined admin:live", socketId: socket.id, userId });
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
        // node-redis subscriber is in pSubscribe mode and can't ping;
        // use the ioredis pubClient (also used by BullMQ) as the health probe.
        const pong = await pubClient.ping();
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
app.use(`${API_PREFIX}/share`, shareRoutes); // public — no auth
app.use(`${API_PREFIX}/apikeys`, userApiKeyRoutes);
app.use(`${API_PREFIX}/script`, projectScriptRoutes);
// Community surface — gated behind FEATURE_COMMUNITY (off for v1 relaunch).
// When disabled, requireFeature("community") makes every route here 404.
app.use(`${API_PREFIX}/community`, requireFeature("community"), communityPostRoutes);
app.use(`${API_PREFIX}/backpack`, requireFeature("community"), backpackRoutes);
app.use(`${API_PREFIX}/leaderboard`, requireFeature("community"), leaderboardRoutes);
app.use(`${API_PREFIX}/notifications`, requireFeature("community"), notificationRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/memory`, memoryRoutes);
app.use(`${API_PREFIX}/collab`, collabRoutes);
// Admin live "god view" (OBSERVABILITY §5) — internal ops surface, NOT a
// community feature, so it is intentionally outside the requireFeature("community")
// block above. Each route is gated by auth + requireAdmin (see the router); when
// ADMIN_DASHBOARD_ENABLED=false every route here 404s.
app.use(`${API_PREFIX}/admin/live`, adminLiveRoutes);

// ─── bull-board queue dashboard (OBSERVABILITY §6) ───────────────────────────
// Instant queue/job/step visibility at ${API_PREFIX}/admin/queues.
//
// Gating: this surface exposes job payloads and controls, so it is only mounted
// when ADMIN_DASHBOARD_ENABLED=true AND the request passes JWT auth.
// TODO (RBAC): the env flag + plain JWT auth is a stopgap. Replace with a proper
// admin role check (e.g. user.role === "admin") once an admin/RBAC concept
// exists, so any authenticated user can no longer reach the dashboard.
if (ADMIN_DASHBOARD_ENABLED) {
    const bullBoardPath = `${API_PREFIX}/admin/queues`;
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(bullBoardPath);

    createBullBoard({
        queues: [new BullMQAdapter(generationQueue), new BullMQAdapter(editQueue)],
        serverAdapter,
    });

    app.use(bullBoardPath, auth, serverAdapter.getRouter());
    logger.info({ message: "bull-board mounted (auth-gated)", path: bullBoardPath });
}

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

        // OBSERVABILITY §3d: periodically sample BullMQ job counts into the
        // stitcher.queue.depth{queue,state} gauge. Best-effort; never throws.
        startQueueDepthSampler([
            { queue: generationQueue, label: "video-generation" },
            { queue: editQueue, label: "video-edit" },
        ]);
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
            stopQueueDepthSampler();

            await generationWorker.close();
            await editWorker.close();
            logger.info("BullMQ workers closed");

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
