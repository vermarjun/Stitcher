import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT || 8000;
export const JWT_SECRET = process.env.JWT_SECRET;
export const MONGODB_URL = process.env.MONGODB_URL;
export const API_PREFIX = process.env.API_PREFIX || "/api/v1";
export const EMAIL_USER = process.env.EMAIL_USER || "/api/v1";
export const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD || "/api/v1";


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