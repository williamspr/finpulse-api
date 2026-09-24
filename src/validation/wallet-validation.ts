import {z} from 'zod';

export const createWalletSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Wallet name is required").max(100, "Wallet name must not exceed 100 characters"),
        currency: z.string().length(3, "Currency code must be exactly 3 characters (e.g. IDR, USD, EUR)"),
        balance: z.number({message: "Balance must be a number"}).min(0, "Initial balance cannot be negative").optional().default(0)
    })
});

export const walletIdParamSchema = z.object({
    params: z.object({
        id: z.uuid('Invalid wallet ID format')
    })
});

export const updateWalletSchema = z.object({
    params: z.object({
        id: z.uuid('Invalid wallet ID format')
    }),
    body: z.object({
        name: z.string().min(1, 'Wallet name must not be empty').max(100, 'Wallet name must not exceed 100 characters').optional(),
        currency: z.string().length(3, 'Currency code must be exactly 3 characters (e.g. IDR, USD, EUR)').optional(),
    }).refine(data => data.name !== undefined || data.currency !== undefined, {
        message: 'At least one field (name or currency) must be provided for update'
    })
});

export type CreateWalletInput = z.infer<typeof createWalletSchema>['body'];
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>['body'];