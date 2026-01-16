import dotenv from "dotenv";

dotenv.config();

if (process.env.RZP_KEY_ID == undefined) {
    throw new Error("RZP_KEY_ID is not defined in environment variables");
}
export const RZP_KEY_ID = process.env.RZP_KEY_ID;

if (process.env.RZP_KEY_SECRET == undefined) {
    throw new Error("RZP_KEY_SECRET is not defined in environment variables");
}
export const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;

if (process.env.GOOGLE_CLIENT_ID == undefined) {
    throw new Error("GOOGLE_CLIENT_ID is not defined in environment variables");
}
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (process.env.GOOGLE_CLIENT_SECRET == undefined) {
    throw new Error("GOOGLE_CLIENT_SECRET is not defined in environment variables");
}
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (process.env.PORT == undefined) {
    throw new Error("PORT is not defined in environment variables");
}
export const PORT = process.env.PORT;

if (process.env.JWT_SECRET == undefined) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}
export const JWT_SECRET = process.env.JWT_SECRET;

if (process.env.MONGODB_URL == undefined) {
    throw new Error("MONGODB_URL is not defined in environment variables");
}
export const MONGODB_URL = process.env.MONGODB_URL;

if (process.env.API_PREFIX == undefined) {
    throw new Error("API_PREFIX is not defined in environment variables");
}
export const API_PREFIX = process.env.API_PREFIX || "";

if (process.env.EMAIL_USER == undefined) {
    throw new Error("EMAIL_USER is not defined in environment variables");
}
export const EMAIL_USER = process.env.EMAIL_USER || "";

if (process.env.EMAIL_APP_PASSWORD == undefined) {
    throw new Error("EMAIL_APP_PASSWORD is not defined in environment variables");
}
export const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

if (process.env.CLOUDINARY_API_KEY == undefined) {
    throw new Error("CLOUDINARY_API_KEY is not defined in environment variables");
}
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;

if (process.env.CLOUDINARY_API_SECRET == undefined) {
    throw new Error("CLOUDINARY_API_SECRET is not defined in environment variables");
}
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (process.env.CLOUDINARY_CLOUD_NAME == undefined) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not defined in environment variables");
}

if (process.env.MICROSERVICE_URL == undefined) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not defined in environment variables");
}

export const MICROSERVICE_BASE_URL = process.env.MICROSERVICE_URL;

export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

export interface JwtConfig {
    secret: string;
    expiresIn: string | number;
    algorithm: string;
}

// JWT Configuration
export const JWT_CONFIG = {
    secret: JWT_SECRET || "",
    expiresIn: '7d',
    algorithm: 'HS256'
};

// Password Reset Configuration
export const PASSWORD_RESET_CONFIG = {
    tokenExpiry: 1000 * 60 * 30, // 30 minutes
    tokenLength: 32,
};

// Email Configuration
export const EMAIL_CONFIG = {
    service: 'gmail',
    user: EMAIL_USER || "",
    pass: EMAIL_APP_PASSWORD || "",
};

export const CLOUDINARY_CONFIG = {
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
}

// Redis Configuration
// Redis Configuration
if (process.env.REDIS_HOST == undefined) {
    throw new Error("REDIS_HOST is not defined in environment variables");
}
export const REDIS_HOST = process.env.REDIS_HOST;

export const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;

if (process.env.REDIS_PASSWORD == undefined) {
    throw new Error("REDIS_PASSWORD is not defined in environment variables");
}
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;