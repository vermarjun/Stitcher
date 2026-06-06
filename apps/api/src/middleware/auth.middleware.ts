import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config';
import logger from '../util/logger.util';
import User from '../model/user.model';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Throttle lastActive writes to once per 5 minutes per user to avoid hammering the DB.
const lastActiveCache = new Map<string, number>();
const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

const auth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
}

const token = authHeader.split(' ')[1];

try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret);
    if (typeof decoded === 'string' || !('userId' in decoded)) {
      return res.status(401).json({ message: 'Invalid token structure. Send userId with every request' });
    }
    req.userId = decoded.userId;

    const now = Date.now();
    const lastSeen = lastActiveCache.get(decoded.userId) ?? 0;
    if (now - lastSeen > LAST_ACTIVE_THROTTLE_MS) {
      lastActiveCache.set(decoded.userId, now);
      User.findByIdAndUpdate(decoded.userId, { lastActive: new Date() }).exec().catch(() => {});
    }

    next();
  } catch (err) {
    logger.warn({ message: 'Invalid JWT token', error: String(err) });
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

export default auth;