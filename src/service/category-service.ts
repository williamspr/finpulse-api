import { prisma } from "../config/prisma.js";
import {CreateCategoryInput, GetCategoriesQuery} from "../validation/category-validation.js";
import { AppError } from "../util/app-error.js";
import {TransactionType} from "@prisma/client";

export class CategoryService {
    public static async createCategory(userId: string, input: CreateCategoryInput) {
        const existingCategory = await prisma.category.findFirst({
            where: {
                userId,
                type: input.type as TransactionType,
                name: {
                    equals: input.name,
                    mode: "insensitive"
                }
            }
        });

        if (existingCategory) throw new AppError( "Category with this name and type already exists", 400);

        return await prisma.category.create({
            data: {
                userId,
                name: input.name,
                type: input.type as TransactionType
            },
            select: {
                id: true,
                name: true,
                type: true,
                userId: true,
                createdAt: true,
            }
        });
    }

    public static async getCategories(userId: string, query: GetCategoriesQuery) {
        return await prisma.category.findMany({
            where: {
                userId,
                ...(query.type && { type: query.type as TransactionType })
            },
            select: {
                id: true,
                name: true,
                type: true,
                userId: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: "desc",
            }
        });
    }

    public static async deleteCategory(userId: string, categoryId: string) {
        const category = await prisma.category.findUnique({
            where: { id: categoryId }
        });

        if (!category) throw new AppError("Category not found", 404);

        if (category.userId !== userId) throw new AppError("You do not have permission to delete this category", 403);

        await prisma.category.delete({
            where: { id: categoryId }
        });

        return category;
    }
}