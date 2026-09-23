import { Request, Response, NextFunction } from 'express';
import { AppError } from '../util/app-error.js';
import { verifyAccessToken } from '../util/jwt.js';

declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                role: string;
            };
        }
    }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError('Unauthorized access. Token missing.', 401));
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = verifyAccessToken(token);
        next();
    } catch (_error) {
        return next(new AppError('Invalid or expired access token', 401));
    }
};