import { Request, Response, NextFunction } from "express";
import { BudgetService } from "../service/budget-service.js";
import {GetBudgetStatusQueryInput} from "../validation/budget-validation.js";

export class BudgetController {
    public static async createBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const budget = await BudgetService.createBudget(userId, req.body);

            res.status(201).json({
                status: "success",
                message: "Budget set successfully",
                data: { budget }
            });
        } catch (error) {
            next(error);
        }
    }

    public static async getBudgetStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const query = req.query as unknown as GetBudgetStatusQueryInput;

            const result = await BudgetService.getBudgetStatus(userId, query);

            res.status(200).json({
                status: "success",
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}