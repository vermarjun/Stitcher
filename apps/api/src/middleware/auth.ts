import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config';

// Extend the Request interface to include the userId property
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

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
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

export default auth;