import {Request, Response, NextFunction} from "express";
import {AuthService} from "../service/auth-service.js";

export class AuthController {
    //POST /api/v1/auth/register
    public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        try{
            const user = await AuthService.register(req.body);
            res.status(201).json({
               status: "success",
               message: "User registered successfully",
               data: {user}
            });
        }catch(error){
            next(error);
        }
    }

    // POST /api/v1/auth/login
    public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { user, accessToken, refreshToken } = await AuthService.login(req.body);

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Hari
            });

            res.status(200).json({
                status: 'success',
                message: 'Logged in successfully',
                data: { user, accessToken },
            });
        } catch (error) {
            next(error);
        }
    }

    // POST /api/v1/auth/refresh-token
    public static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const refreshToken = req.cookies?.refreshToken;
            const result = await AuthService.refreshToken(refreshToken);

            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            res.status(200).json({
                status: 'success',
                message: 'Token refreshed successfully',
                data: {
                    accessToken: result.accessToken,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    // POST /api/v1/auth/logout
    public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const refreshToken = req.cookies?.refreshToken;
            await AuthService.logout(refreshToken);

            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
            });

            res.status(200).json({
                status: 'success',
                message: 'Logged out successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/auth/me
    public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.userId;
            const user = await AuthService.getProfile(userId!);

            res.status(200).json({
                status: 'success',
                data: { user },
            });
        } catch (error){
            next(error);
        }
    }
}