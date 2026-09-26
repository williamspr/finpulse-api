import { prisma } from "../config/prisma.js";
import {CreateBudgetInput, GetBudgetStatusQueryInput} from "../validation/budget-validation.js";
import { AppError } from "../util/app-error.js";
import {Budget, Prisma} from "@prisma/client";

export class BudgetService {
    public static async createBudget(userId: string, input: CreateBudgetInput): Promise<Budget> {
        const { categoryId, amount, month, year } = input;

        // 1. Verify Category existence, ownership, and EXPENSE type
        const category = await prisma.category.findUnique({
            where: { id: categoryId }
        });

        if (!category || category.userId !== userId) throw new AppError("Category not found", 404);

        if (category.type !== "EXPENSE") throw new AppError("Budgets can only be set for EXPENSE categories", 400);

        // 2. Check if budget already exists for this category, month, and year
        const existingBudget = await prisma.budget.findFirst({
            where: {
                userId,
                categoryId,
                month,
                year
            }
        });

        if (existingBudget) throw new AppError("Budget for this category and period already exists", 400);

        // 3. Create Budget
        return await prisma.budget.create({
            data: {
                userId,
                categoryId,
                amount: new Prisma.Decimal(amount),
                month,
                year
            },
            include: {
                category: {
                    select: { id: true, name: true, type: true }
                }
            }
        });
    }

    public static async getBudgetStatus(userId: string, query: GetBudgetStatusQueryInput) {
        const month = Number(query.month);
        const year = Number(query.year);

        const budgets = await prisma.budget.findMany({
            where: {
                userId,
                month,
                year
            },
            include: {
                category: {
                    select: { id: true, name: true, type: true }
                }
            }
        });

        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        // Calculate the actual expenditure for each budget.
        const budgetStatusList = await Promise.all(
            budgets.map(async (budget) => {
                const expenseAggregate = await prisma.transaction.aggregate({
                    _sum: {
                        amount: true
                    },
                    where: {
                        wallet: { userId },
                        categoryId: budget.categoryId,
                        type: "EXPENSE",
                        date: {
                            gte: startDate,
                            lte: endDate
                        }
                    }
                });

                const budgetAmount = Number(budget.amount);
                const actualSpent = Number(expenseAggregate._sum.amount || 0);
                const remaining = budgetAmount - actualSpent;
                const usagePercentage = budgetAmount > 0 ? Number(((actualSpent / budgetAmount) * 100).toFixed(2)) : 0;
                const isOverBudget = actualSpent > budgetAmount;

                return {
                    budgetId: budget.id,
                    category: budget.category,
                    month: budget.month,
                    year: budget.year,
                    budgetAmount,
                    actualSpent,
                    remaining,
                    usagePercentage,
                    isOverBudget
                };
            })
        );

        // Total summary of the overall budget for that month.
        const totalBudget = budgetStatusList.reduce((acc, curr) => acc + curr.budgetAmount, 0);
        const totalSpent = budgetStatusList.reduce((acc, curr) => acc + curr.actualSpent, 0);

        return {
            period: { month, year },
            summary: {
                totalBudget,
                totalSpent,
                totalRemaining: totalBudget - totalSpent,
                overallUsagePercentage: totalBudget > 0 ? Number(((totalSpent / totalBudget) * 100).toFixed(2)) : 0,
                hasOverBudgetItems: budgetStatusList.some((item) => item.isOverBudget)
            },
            budgets: budgetStatusList
        };
    }
}