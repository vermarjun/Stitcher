import express, {Request, Response} from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./util/database.util";
import { createServer } from "http";
import { Server } from "socket.io";

// Import Routes
import userRoutes from "./router/user.router"
import projectRoutes from "./router/project.router"
import searchRoutes from "./router/searchBar.router"
import templateRoutes from "./router/templates.router"
import assetRoutes from "./router/asset.router"
import trackRoutes from "./router/track.router"

// Config
import { API_PREFIX, PORT } from "./config";

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with the HTTP server
export const io = new Server(httpServer);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

// Health check endpoint
app.get(`${API_PREFIX}/health`, (req: Request, res: Response): Response => {
    return res.status(200).json({
        message: "I eat apple everyday :)",
        success: true
    });
});

// API Routes
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/project`, projectRoutes);
app.use(`${API_PREFIX}/template`, templateRoutes);
app.use(`${API_PREFIX}/search`, searchRoutes);
app.use(`${API_PREFIX}/asset`, assetRoutes);
app.use(`${API_PREFIX}/track`, trackRoutes);

// app.use(`${API_PREFIX}/chat`, chatRoutes);

// Start the server
httpServer.listen(PORT, async () => {
    try {
        await connectDB();
        console.log(`Server running on port ${PORT}`);
        console.log(`Socket.IO server is ready for connections`);
    } catch (error) {
        console.error('Failed to connect to database:', error);
    }
});


