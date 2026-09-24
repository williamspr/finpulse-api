import {Request, Response, NextFunction} from "express";
import {WalletService} from "../service/wallet-service.js";

export class WalletController {
    public static async createWallet(req: Request, res: Response, next: NextFunction): Promise<void>{
        try{
            const userId = req.user!.userId;
            const wallet = await WalletService.createWallet(userId, req.body);

            res.status(201).json({
                status: "success",
                message: "Wallet created successfully",
                data: {wallet}
            });
        }catch(error){
            next(error);
        }
    }

    public static async getWallets(req: Request, res: Response, next: NextFunction): Promise<void>{
        try{
            const userId = req.user!.userId;
            const result = await WalletService.getWalletsByUserId(userId);

            res.status(200).json({
                status: "success",
                message: "Wallets retrieved successfully",
                data: result
            });
        }catch (error){
            next(error);
        }
    }

    public static async getWalletById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const walletId = req.params.id as string;
            const wallet = await WalletService.getWalletById(userId, walletId);

            res.status(200).json({
                status: 'success',
                message: 'Wallet retrieved successfully',
                data: { wallet }
            });
        } catch (error) {
            next(error);
        }
    }

    public static async updateWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const walletId = req.params.id as string;
            const wallet = await WalletService.updateWallet(userId, walletId, req.body);

            res.status(200).json({
                status: 'success',
                message: 'Wallet updated successfully',
                data: { wallet }
            });
        } catch (error) {
            next(error);
        }
    }

    public static async deleteWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const walletId = req.params.id as string;
            await WalletService.deleteWallet(userId, walletId);

            res.status(200).json({
                status: 'success',
                message: 'Wallet deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}