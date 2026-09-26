import { prisma } from "../config/prisma.js";
import {
    CreateTransactionInput,
    GetTransactionsQueryInput,
    UpdateTransactionInput
} from "../validation/transaction-validation.js";
import { AppError } from "../util/app-error.js";
import { TransactionType, Prisma } from "@prisma/client";

export class TransactionService {
    public static async createTransaction(userId: string, input: CreateTransactionInput) {
        const {walletId, targetWalletId, categoryId, type, amount, exchangeRate, note, date,} = input;

        return await prisma.$transaction(async (tx) => {
            // 1. Validate Source Wallet Ownership
            const sourceWallet = await tx.wallet.findUnique({
                where: { id: walletId }
            });

            if (!sourceWallet || sourceWallet.userId !== userId) throw new AppError("Source wallet not found", 404);

            const sourceBalanceNum = Number(sourceWallet.balance);

            // 2. Validate Category for INCOME or EXPENSE
            if (type === "INCOME" || type === "EXPENSE") {
                const category = await tx.category.findUnique({
                    where: { id: categoryId }
                });

                if (!category || category.userId !== userId) throw new AppError("Category not found", 404);

                if (category.type !== type) {
                    throw new AppError(`Category type mismatch. Expected ${type}, got ${category.type}`, 400);
                }
            }

            let calculatedExchangeRate = 1.0;
            let targetAmount = amount;

            // 3. Process Transaction Type & Update Balances
            if (type === "TRANSFER") {
                const targetWallet = await tx.wallet.findUnique({
                    where: { id: targetWalletId }
                });

                if (!targetWallet || targetWallet.userId !== userId) throw new AppError("Target wallet not found", 404);

                if (sourceBalanceNum < amount) throw new AppError("Insufficient wallet balance", 400);

                if (sourceWallet.currency !== targetWallet.currency) {
                    if (!exchangeRate) {
                        throw new AppError("Exchange rate is required for cross-currency transfers", 400);
                    }
                    calculatedExchangeRate = exchangeRate;
                    targetAmount = amount * exchangeRate;
                }

                // Deduct from Source Wallet
                await tx.wallet.update({
                    where: { id: walletId },
                    data: {
                        balance: {
                            decrement: new Prisma.Decimal(amount)
                        }
                    }
                });

                // Add to Target Wallet
                await tx.wallet.update({
                    where: { id: targetWalletId },
                    data: {
                        balance: {
                            increment: new Prisma.Decimal(targetAmount)
                        }
                    }
                });
            } else if (type === "EXPENSE") {
                if (sourceBalanceNum < amount) throw new AppError("Insufficient wallet balance", 400);

                await tx.wallet.update({
                    where: { id: walletId },
                    data: {
                        balance: {
                            decrement: new Prisma.Decimal(amount)
                        }
                    }
                });
            } else if (type === "INCOME") {
                await tx.wallet.update({
                    where: { id: walletId },
                    data: {
                        balance: {
                            increment: new Prisma.Decimal(amount)
                        }
                    }
                });
            }

            // 4. Create Transaction Record
            return await tx.transaction.create({
                data: {
                    walletId,
                    targetWalletId: type === "TRANSFER" ? targetWalletId : null,
                    categoryId: type !== "TRANSFER" ? categoryId : null,
                    type: type as TransactionType,
                    amount: new Prisma.Decimal(amount),
                    currency: sourceWallet.currency,
                    exchangeRate: new Prisma.Decimal(calculatedExchangeRate),
                    note: note || null,
                    date: date ? new Date(date) : new Date()
                }
            });
        });
    }

    public static async getTransactions(userId: string, query: GetTransactionsQueryInput) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;

        const { search, type, currency, startDate, endDate } = query;

        // Build Prisma dynamic filter condition
        const whereCondition: Prisma.TransactionWhereInput = {
            wallet: {userId}
        };

        if (type) whereCondition.type = type as TransactionType;
        if (currency) whereCondition.currency = currency;

        if (search) {
            whereCondition.note = {
                contains: search,
                mode: "insensitive"
            };
        }

        if (startDate || endDate) {
            whereCondition.date = {};
            if (startDate) whereCondition.date.gte = new Date(startDate);
            if (endDate) whereCondition.date.lte = new Date(endDate);
        }

        // Execute query and count simultaneously using Promise.all
        const [transactions, totalItems] = await Promise.all([
            prisma.transaction.findMany({
                where: whereCondition,
                orderBy: { date: "desc" },
                skip,
                take: limit,
                include: {
                    wallet: {
                        select: { id: true, name: true, currency: true }
                    },
                    targetWallet: {
                        select: { id: true, name: true, currency: true }
                    },
                    category: {
                        select: { id: true, name: true, type: true }
                    }
                }
            }),
            prisma.transaction.count({where: whereCondition})
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        return {
            transactions,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
    }

    public static async getTransactionById(userId: string, transactionId: string) {
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                wallet: {
                    select: { id: true, name: true, currency: true, userId: true }
                },
                targetWallet: {
                    select: { id: true, name: true, currency: true }
                },
                category: {
                    select: { id: true, name: true, type: true }
                }
            }
        });

        // Verify transaction existence & user ownership via source wallet
        if (!transaction || transaction.wallet.userId !== userId) throw new AppError("Transaction not found", 404);

        // Remove userId from wallet object before returning response
        const { userId: _, ...walletData } = transaction.wallet;

        return {
            ...transaction,
            wallet: walletData
        };
    }

    public static async updateTransaction(userId: string, transactionId: string, input: UpdateTransactionInput) {
        return await prisma.$transaction(async (tx) => {
            // 1. Fetch Existing Transaction & Verify User Ownership via Source Wallet
            const existingTx = await tx.transaction.findUnique({
                where: { id: transactionId },
                include: {
                    wallet: true,
                    targetWallet: true
                }
            });

            if (!existingTx || existingTx.wallet.userId !== userId) throw new AppError("Transaction not found", 404);

            // 2. Determine merged values for evaluation
            const newWalletId = input.walletId || existingTx.walletId;
            const newTargetWalletId = input.targetWalletId !== undefined ? input.targetWalletId : existingTx.targetWalletId;
            const newCategoryId = input.categoryId !== undefined ? input.categoryId : existingTx.categoryId;
            const newType = input.type || existingTx.type;
            const newAmount = input.amount !== undefined ? input.amount : Number(existingTx.amount);

            // 3. STEP A: REVERT OLD TRANSACTION BALANCE EFFECT
            const oldAmountNum = Number(existingTx.amount);
            const oldExchangeRateNum = Number(existingTx.exchangeRate);

            if (existingTx.type === "INCOME") {
                await tx.wallet.update({
                    where: { id: existingTx.walletId },
                    data: {
                        balance: {
                            decrement: new Prisma.Decimal(oldAmountNum)
                        }
                    }
                });
            } else if (existingTx.type === "EXPENSE") {
                await tx.wallet.update({
                    where: { id: existingTx.walletId },
                    data: {
                        balance: {
                            increment: new Prisma.Decimal(oldAmountNum)
                        }
                    }
                });
            } else if (existingTx.type === "TRANSFER" && existingTx.targetWalletId) {
                const oldTargetAmount = oldAmountNum * oldExchangeRateNum;
                await tx.wallet.update({
                    where: { id: existingTx.walletId },
                    data: {
                        balance: {
                            increment: new Prisma.Decimal(oldAmountNum)
                        }
                    }
                });
                await tx.wallet.update({
                    where: { id: existingTx.targetWalletId },
                    data: {
                        balance: {
                            decrement: new Prisma.Decimal(oldTargetAmount)
                        }
                    }
                });
            }

            // 4. Validate New Source Wallet
            const sourceWallet = await tx.wallet.findUnique({
                where: { id: newWalletId }
            });

            if (!sourceWallet || sourceWallet.userId !== userId) throw new AppError("Source wallet not found", 404);

            // 5. Validate Category if INCOME or EXPENSE
            if (newType === "INCOME" || newType === "EXPENSE") {
                if (!newCategoryId) throw new AppError(`Category is required for ${newType} type`, 400);
                const category = await tx.category.findUnique({
                    where: { id: newCategoryId }
                });

                if (!category || category.userId !== userId) throw new AppError("Category not found", 404);

                if (category.type !== newType) {
                    throw new AppError(`Category type mismatch. Expected ${newType}, got ${category.type}`, 400);
                }
            }

            let calculatedExchangeRate = 1.0;
            let targetAmount = newAmount;

            // 6. STEP B: APPLY NEW TRANSACTION BALANCE EFFECT
            const currentSourceBalanceNum = Number(sourceWallet.balance);

            if (newType === "TRANSFER") {
                if (!newTargetWalletId) throw new AppError("Target wallet is required for TRANSFER type", 400);
                if (newWalletId === newTargetWalletId) throw new AppError("Source and target wallets cannot be the same", 400);

                const targetWallet = await tx.wallet.findUnique({
                    where: { id: newTargetWalletId }
                });

                if (!targetWallet || targetWallet.userId !== userId) throw new AppError("Target wallet not found", 404);

                if (currentSourceBalanceNum < newAmount) throw new AppError("Insufficient wallet balance", 400);

                if (sourceWallet.currency !== targetWallet.currency) {
                    const rateToUse = input.exchangeRate || Number(existingTx.exchangeRate);
                    if (!rateToUse || rateToUse === 1.0) {
                        throw new AppError("Exchange rate is required for cross-currency transfers", 400);
                    }
                    calculatedExchangeRate = rateToUse;
                    targetAmount = newAmount * calculatedExchangeRate;
                }

                await tx.wallet.update({
                    where: { id: newWalletId },
                    data: {
                        balance: {
                            decrement: new Prisma.Decimal(newAmount)
                        }
                    }
                });

                await tx.wallet.update({
                    where: { id: newTargetWalletId },
                    data: {
                        balance: {
                            increment: new Prisma.Decimal(targetAmount)
                        }
                    }
                });
            } else if (newType === "EXPENSE") {
                if (currentSourceBalanceNum < newAmount) throw new AppError("Insufficient wallet balance", 400);

                await tx.wallet.update({
                    where: { id: newWalletId },
                    data: {
                        balance: {
                            decrement: new Prisma.Decimal(newAmount)
                        }
                    }
                });
            } else if (newType === "INCOME") {
                await tx.wallet.update({
                    where: { id: newWalletId },
                    data: {
                        balance: {
                            increment: new Prisma.Decimal(newAmount)
                        }
                    }
                });
            }

            // 7. Update Transaction Record
            return await tx.transaction.update({
                where: { id: transactionId },
                data: {
                    walletId: newWalletId,
                    targetWalletId: newType === "TRANSFER" ? newTargetWalletId : null,
                    categoryId: newType !== "TRANSFER" ? newCategoryId : null,
                    type: newType as TransactionType,
                    amount: new Prisma.Decimal(newAmount),
                    currency: sourceWallet.currency,
                    exchangeRate: new Prisma.Decimal(calculatedExchangeRate),
                    note: input.note !== undefined ? input.note : existingTx.note,
                    date: input.date ? new Date(input.date) : existingTx.date
                },
                include: {
                    wallet: { select: { id: true, name: true, currency: true } },
                    targetWallet: { select: { id: true, name: true, currency: true } },
                    category: { select: { id: true, name: true, type: true } }
                }
            });
        });
    }

    public static async deleteTransaction(userId: string, transactionId: string): Promise<boolean> {
        return await prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.findFirst({
                where: {
                    id: transactionId,
                    wallet: { userId }
                }
            });

            if (!transaction) throw new AppError("Transaction not found", 404);

            const amountNum = Number(transaction.amount);

            // Revert Wallet Balance by Transaction Type
            if (transaction.type === "EXPENSE") {
                await tx.wallet.update({
                    where: { id: transaction.walletId },
                    data: {
                        balance: {
                            increment: new Prisma.Decimal(amountNum)
                        }
                    }
                });
            } else if (transaction.type === "INCOME") {
                const wallet = await tx.wallet.findUnique({ where: { id: transaction.walletId } });
                if (Number(wallet?.balance) < amountNum) {
                    throw new AppError("Cannot delete transaction: wallet balance would become negative", 400);
                }

                await tx.wallet.update({
                    where: { id: transaction.walletId },
                    data: {
                        balance: {
                            decrement: new Prisma.Decimal(amountNum)
                        }
                    }
                });
            } else if (transaction.type === "TRANSFER") {
                if (!transaction.targetWalletId) throw new AppError("Invalid transfer transaction data", 400);

                const exchangeRateNum = Number(transaction.exchangeRate) || 1.0;
                const targetAmountNum = amountNum * exchangeRateNum;

                const targetWallet = await tx.wallet.findUnique({
                    where: { id: transaction.targetWalletId }
                });

                if (Number(targetWallet?.balance) < targetAmountNum) {
                    throw new AppError("Cannot delete transaction: target wallet balance would become negative", 400);
                }

                // Revert: Source Wallet (+), Target Wallet (-)
                await tx.wallet.update({
                    where: { id: transaction.walletId },
                    data: {
                        balance: {
                            increment: new Prisma.Decimal(amountNum)
                        }
                    }
                });

                await tx.wallet.update({
                    where: { id: transaction.targetWalletId },
                    data: {
                        balance: {
                            decrement: new Prisma.Decimal(targetAmountNum)
                        }
                    }
                });
            }

            await tx.transaction.delete({
                where: { id: transactionId }
            });

            return true;
        });
    }
}