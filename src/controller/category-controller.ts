import { Request, Response, NextFunction } from "express";
import { CategoryService } from "../service/category-service.js";

export class CategoryController {
    public static async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const category = await CategoryService.createCategory(userId, req.body);

            res.status(201).json({
                status: "success",
                message: "Category created successfully",
                data: { category }
            });
        } catch (error) {
            next(error);
        }
    }

    public static async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const categories = await CategoryService.getCategories(userId, req.query);

            res.status(200).json({
                status: "success",
                message: "Categories retrieved successfully",
                data: { categories }
            });
        } catch (error) {
            next(error);
        }
    }

    public static async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const id = req.params.id as string;

            await CategoryService.deleteCategory(userId, id);

            res.status(200).json({
                status: "success",
                message: "Category deleted successfully"
            });
        } catch (error) {
            next(error);
        }
    }
}