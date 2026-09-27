import { authenticatedRequest } from "./transaction.helper.js";

export interface CreateTestBudgetInput {
    categoryId: string;
    amount: number;
    month: number;
    year: number;
}

export async function createTestBudget(token: string, input: CreateTestBudgetInput) {
    const res = await authenticatedRequest(token).post("/api/v1/budgets", input);

    return res.body.data.budget;
}