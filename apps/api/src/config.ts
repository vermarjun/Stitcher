import dotenv from "dotenv";

dotenv.config();

if (process.env.PORT == undefined){
    throw new Error("PORT is not defined in environment variables");
}
export const PORT = process.env.PORT;

if (process.env.JWT_SECRET == undefined){
    throw new Error("JWT_SECRET is not defined in environment variables");
}
export const JWT_SECRET = process.env.JWT_SECRET;

if (process.env.MONGODB_URL == undefined){
    throw new Error("MONGODB_URL is not defined in environment variables");
}
export const MONGODB_URL = process.env.MONGODB_URL;

if (process.env.API_PREFIX == undefined){
    throw new Error("API_PREFIX is not defined in environment variables");
}
export const API_PREFIX = process.env.API_PREFIX || "";

if (process.env.EMAIL_USER == undefined){
    throw new Error("EMAIL_USER is not defined in environment variables");
}
export const EMAIL_USER = process.env.EMAIL_USER || "";

if (process.env.EMAIL_APP_PASSWORD == undefined){
    throw new Error("EMAIL_APP_PASSWORD is not defined in environment variables");
}
export const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

if (process.env.CLOUDINARY_API_KEY == undefined){
    throw new Error("CLOUDINARY_API_KEY is not defined in environment variables");
}
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;

if (process.env.CLOUDINARY_API_SECRET == undefined){
    throw new Error("CLOUDINARY_API_SECRET is not defined in environment variables");
}
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (process.env.CLOUDINARY_CLOUD_NAME == undefined){
    throw new Error("CLOUDINARY_CLOUD_NAME is not defined in environment variables");
}
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

console.log(CLOUDINARY_API_KEY)
console.log(CLOUDINARY_API_SECRET)
console.log(CLOUDINARY_CLOUD_NAME)

export const CLOUDINARY_CONFIG = {
    CLOUDINARY_CLOUD_NAME: CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: CLOUDINARY_API_SECRET
}