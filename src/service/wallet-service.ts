import {prisma} from "../config/prisma.js";
import {CreateWalletInput, UpdateWalletInput} from "../validation/wallet-validation.js";
import { AppError } from "../util/app-error.js";

export class WalletService {
    public static async createWallet(userId: string, input: CreateWalletInput){
        const wallet = await prisma.wallet.create({
            data: {
                name: input.name,
                currency: input.currency.toUpperCase(),
                balance: input.balance,
                userId
            }
        });

        return {
            ...wallet,
            balance: wallet.balance.toNumber()
        };
    }

    public static async getWalletsByUserId(userId: string){
        const wallets = await prisma.wallet.findMany({
            where : {userId},
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formattedWallets = wallets.map(wallet => ({
            ...wallet,
            balance: wallet.balance.toNumber()
        }));

        const totalWallets = formattedWallets.length;

        return {
            wallets: formattedWallets,
            summary : {totalWallets}
        };
    }

    public static async getWalletById(userId: string, walletId: string) {
        const wallet = await prisma.wallet.findFirst({
            where: {
                id: walletId,
                userId
            }
        });

        if (!wallet) throw new AppError('Wallet not found', 404);

        return {
            ...wallet,
            balance: wallet.balance.toNumber()
        };
    }

    public static async updateWallet(userId: string, walletId: string, input: UpdateWalletInput) {
        await this.getWalletById(userId, walletId);

        const updatedWallet = await prisma.wallet.update({
            where: { id: walletId },
            data: {
                ...(input.name && { name: input.name }),
                ...(input.currency && { currency: input.currency.toUpperCase() })
            }
        });

        return {
            ...updatedWallet,
            balance: updatedWallet.balance.toNumber()
        };
    }

    public static async deleteWallet(userId: string, walletId: string): Promise<void> {
        await this.getWalletById(userId, walletId);

        await prisma.wallet.delete({
            where: { id: walletId }
        });
    }
}