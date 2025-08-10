import express, {Request, Response} from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./util/database";

// Config
import { API_PREFIX, PORT } from "./config";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

// Routes
// app.use("/api/coding-stats", );

app.get(`${API_PREFIX}/health`, (req: Request, res: Response): Response => {
    return res.status(200).json({
        message: "I eat apple everyday :)",
        success: true
    });
});

// Start the server
app.listen(PORT, async () => {
    try {
        await connectDB();
        console.log(`Server running on port ${PORT}`);
    } catch (error){
        console.error('Failed to connect to database:', error);
    }
});


