import { z } from "zod";
import { TransactionType } from "@prisma/client";

export const createTransactionSchema = z
    .object({
        body: z.object({
            walletId: z.uuid({ message: "Invalid wallet ID format" }),
            targetWalletId: z.uuid({ message: "Invalid target wallet ID format" }).optional(),
            categoryId: z.uuid({ message: "Invalid category ID format" }).optional(),
            type: z.enum(Object.values(TransactionType) as [string, ...string[]], { message: "Invalid transaction type" }),
            amount: z.number({ message: "Amount must be a number" }).positive({ message: "Amount must be greater than 0" }),
            exchangeRate: z.number({ message: "Exchange rate must be a number" }).positive({ message: "Exchange rate must be greater than 0" }).optional(),
            note: z.string().trim().max(500).optional(),
            date: z.iso.datetime({ message: "Date must be a valid ISO string" }).optional()
        }),
    })
    .superRefine((data, ctx) => {
        const { type, targetWalletId, categoryId, walletId } = data.body;

        if (type === "TRANSFER") {
            if (!targetWalletId) {
                ctx.addIssue({
                    code: "custom",
                    message: "Target wallet ID is required for TRANSFER type",
                    path: ["body", "targetWalletId"]
                });
            }
            if (walletId === targetWalletId) {
                ctx.addIssue({
                    code: "custom",
                    message: "Source and target wallets cannot be the same",
                    path: ["body", "targetWalletId"]
                });
            }
        } else {
            if (!categoryId) {
                ctx.addIssue({
                    code: "custom",
                    message: "Category ID is required for INCOME and EXPENSE types",
                    path: ["body", "categoryId"]
                });
            }
        }
    });

export const getTransactionsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1, { message: "Page must be at least 1" }).default(1),
        limit: z.coerce.number().int().min(1, { message: "Limit must be at least 1" }).max(100, { message: "Limit cannot exceed 100" }).default(10),
        search: z.string().trim().optional(),
        type: z.enum(Object.values(TransactionType) as [string, ...string[]], {message: "Invalid transaction type",}).optional(),
        currency: z.string().toUpperCase().length(3, { message: "Currency must be a 3-character ISO code" }).optional(),
        startDate: z.iso.datetime({ message: "startDate must be a valid ISO string" }).optional(),
        endDate: z.iso.datetime({ message: "endDate must be a valid ISO string" }).optional()
    })
});

export const getTransactionByIdParamsSchema = z.object({
    params: z.object({
        id: z.uuid({ message: "Invalid transaction ID format" })
    })
});

export const updateTransactionSchema = z.object({
    params: z.object({
        id: z.uuid({ message: "Invalid transaction ID format" })
    }),
    body: z.object({
        walletId: z.uuid({ message: "Invalid wallet ID format" }).optional(),
        targetWalletId: z.uuid({ message: "Invalid target wallet ID format" }).optional(),
        categoryId: z.uuid({ message: "Invalid category ID format" }).optional(),
        type: z.enum(Object.values(TransactionType) as [string, ...string[]], {message: "Invalid transaction type",}).optional(),
        amount: z.number({ message: "Amount must be a number" }).positive({ message: "Amount must be greater than 0" }).optional(),
        exchangeRate: z.number({ message: "Exchange rate must be a number" }).positive({ message: "Exchange rate must be greater than 0" }).optional(),
        note: z.string().trim().max(500).optional(),
        date: z.iso.datetime({ message: "Date must be a valid ISO string" }).optional()}
    )
    .refine((body) => Object.keys(body).length > 0, {
        message: "At least one field must be provided for update"
    })
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>["body"];
export type GetTransactionsQueryInput = z.infer<typeof getTransactionsQuerySchema>["query"];
export type GetTransactionByIdParamsInput = z.infer<typeof getTransactionByIdParamsSchema>["params"];
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>["body"];