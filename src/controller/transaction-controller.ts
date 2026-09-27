import { Request, Response, NextFunction } from "express";
import { TransactionService } from "../service/transaction-service.js";
import {GetTransactionByIdParamsInput, GetTransactionsQueryInput} from "../validation/transaction-validation.js";

export class TransactionController {
    public static async createTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const transaction = await TransactionService.createTransaction(userId, req.body);

            res.status(201).json({
                status: "success",
                message: "Transaction created successfully",
                data: { transaction }
            });
        } catch (error) {
            next(error);
        }
    }

    public static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const query = req.query as unknown as GetTransactionsQueryInput;

            const result = await TransactionService.getTransactions(userId, query);

            res.status(200).json({
                status: "success",
                message: "Transactions retrieved successfully",
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    public static async getTransactionById(req: Request<GetTransactionByIdParamsInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const { id } = req.params;

            const transaction = await TransactionService.getTransactionById(userId, id);

            res.status(200).json({
                status: "success",
                message: "Transaction retrieved successfully",
                data: { transaction }
            });
        } catch (error) {
            next(error);
        }
    }

    public static async updateTransaction(req: Request<{id: string}>, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const { id } = req.params;

            const transaction = await TransactionService.updateTransaction(userId, id, req.body);

            res.status(200).json({
                status: "success",
                message: "Transaction updated successfully",
                data: { transaction }
            });
        } catch (error) {
            next(error);
        }
    }

    public static async deleteTransaction(req: Request<GetTransactionByIdParamsInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const { id } = req.params;

            await TransactionService.deleteTransaction(userId, id);

            res.status(200).json({
                status: "success",
                message: "Transaction deleted successfully"
            });
        } catch (error) {
            next(error);
        }
    }
}