import jwt, {Secret, SignOptions} from "jsonwebtoken";

interface TokenPayload {
    userId: string;
    role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
    const secret: Secret = process.env.JWT_ACCESS_SECRET || "fallback_access_secret";
    const options: SignOptions = {
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn']) || '15m'
    };

    return jwt.sign(payload, secret, options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    const secret: Secret = process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret";
    const options: SignOptions = {
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn']) || '7d'
    }

    return jwt.sign(payload, secret, options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
    const secret: Secret = process.env.JWT_ACCESS_SECRET || "fallback_access_secret";
    return jwt.verify(token, secret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
    const secret: Secret = process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret";
    return jwt.verify(token, secret) as TokenPayload;
};