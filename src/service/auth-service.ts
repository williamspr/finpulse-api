import bcrypt from 'bcrypt';
import {prisma} from "../config/prisma.js";
import {AppError} from "../util/app-error.js";
import {generateAccessToken, generateRefreshToken, verifyRefreshToken} from "../util/jwt.js";
import {RegisterInput, LoginInput} from "../validation/auth-validation.js";

export class AuthService {
    public static async register(input: RegisterInput) {
        const existingUser = await prisma.user.findUnique({
            where: { email: input.email }
        });

        if(existingUser) throw new AppError("Email is already registered", 409);

        const hashedPassword = await bcrypt.hash(input.password, 12);

        return await prisma.user.create({
            data : {
                name : input.name,
                email : input.email,
                password: hashedPassword
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            }
        });
    }

    public static async login(input: LoginInput) {
        const user = await prisma.user.findUnique({
            where: { email: input.email }
        });

        if(!user) throw new AppError("Invalid email or password", 401);

        const isPasswordValid = await bcrypt.compare(input.password, user.password);
        if(!isPasswordValid) throw new AppError("Invalid email or password", 401);

        const tokenPayload = {
            userId: user.id,
            role: user.role
        };
        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.refreshToken.create({
            data : {
                token: refreshToken,
                userId: user.id,
                expiresAt
            }
        });

        return {
            user : {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            accessToken, refreshToken
        }
    }

    public static async refreshToken(token: string) {
        if (!token) throw new AppError('Refresh token is required', 401);

        let payload;
        try {
            payload = verifyRefreshToken(token);
        } catch (_err) {
            throw new AppError('Invalid or expired refresh token', 401);
        }

        const savedToken = await prisma.refreshToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!savedToken) throw new AppError('Refresh token not found or revoked', 401);

        if (new Date() > savedToken.expiresAt) {
            await prisma.refreshToken.delete({ where: { id: savedToken.id } });
            throw new AppError('Refresh token has expired', 401);
        }

        await prisma.refreshToken.delete({ where: { id: savedToken.id } });

        const tokenPayload = { userId: savedToken.user.id, role: savedToken.user.role };
        const newAccessToken = generateAccessToken(tokenPayload);
        const newRefreshToken = generateRefreshToken(tokenPayload);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.refreshToken.create({
            data: {
                token: newRefreshToken,
                userId: savedToken.user.id,
                expiresAt
            },
        });

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };
    }

    public static async logout(token: string | undefined): Promise<void> {
        if (!token) throw new AppError('Refresh token is required', 401);

        try {
            verifyRefreshToken(token);
        } catch (_err) {
            throw new AppError('Invalid or expired refresh token', 401);
        }

        const savedToken = await prisma.refreshToken.findUnique({
            where: { token },
        });

        if (!savedToken) throw new AppError('Refresh token not found or revoked', 401);

        await prisma.refreshToken.delete({
            where: { id: savedToken.id },
        });
    }

    public static async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) throw new AppError('User not found', 404);
        return user;
    }
}