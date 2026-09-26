import { z } from "zod";

export const createBudgetSchema = z.object({
    body: z.object({
        categoryId: z.uuid("Invalid Category ID format"),
        amount: z.number({message: "Amount is required"}).positive("Amount must be greater than 0"),
        month: z.number({message: "Month is required"}).int().min(1, "Month must be between 1 and 12").max(12, "Month must be between 1 and 12"),
        year: z.number({message: "Year is required"}).int().min(2000, "Year must be 2000 or later")
    })
});

export const getBudgetStatusQuerySchema = z.object({
    query: z.object({
        month: z.coerce.number({ message: "Month query parameter is required" }).int().min(1, "Month must be between 1 and 12").max(12, "Month must be between 1 and 12"),
        year: z.coerce.number({ message: "Year query parameter is required" }).int().min(2000, "Year must be 2000 or later")
    })
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>["body"];
export type GetBudgetStatusQueryInput = z.infer<typeof getBudgetStatusQuerySchema>["query"];