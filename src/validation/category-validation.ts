import { z } from "zod";
import { TransactionType } from "@prisma/client";

export const createCategorySchema = z.object({
    body: z.object({
        name: z
            .string({ message: "Category name is required" })
            .trim()
            .min(2, { message: "Category name must be at least 2 characters long" })
            .max(100, { message: "Category name cannot exceed 100 characters" }),
        type: z.enum(
            Object.values(TransactionType) as [string, ...string[]],
            {
                message: "Category type must be 'INCOME', 'EXPENSE', or 'TRANSFER'",
            }
        )
    })
});

export const getCategoriesQuerySchema = z.object({
    query: z.object({
        type: z.enum(Object.values(TransactionType) as [string, ...string[]]).optional()
    })
});

export const categoryIdParamSchema = z.object({
    params: z.object({
        id: z.uuid({ message: "Invalid category ID format" })
    })
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
export type GetCategoriesQuery = z.infer<typeof getCategoriesQuerySchema>["query"];
export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>["params"];