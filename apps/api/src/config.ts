import dotenv from "dotenv";

dotenv.config({path:"./env"});

export const PORT = process.env.PORT || 8000;
export const JWT_SECRET = process.env.JWT_SECRET;
export const MONGODB_URL = process.env.MONGODB_URL;
export const API_PREFIX = process.env.API_PREFIX || "/api/v1";