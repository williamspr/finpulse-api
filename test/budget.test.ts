import { describe, it, expect, beforeEach } from "vitest";
import {
    authenticatedRequest,
    createTestCategory,
    expectValidationError,
    expectNotFoundError,
    createTestWallet
} from "./helpers/transaction.helper.js";
import { createTestBudget } from "./helpers/budget.helper.js";
import { TEST_USERS, getAccessToken } from "./helpers/auth.helper.js";

describe("POST /api/v1/budgets", () => {
    let userAToken: string;
    let expenseCategoryId: string;
    let incomeCategoryId: string;

    beforeEach(async () => {
        userAToken = await getAccessToken(TEST_USERS.userA);

        const expCategory = await createTestCategory(userAToken, {
            name: "Groceries",
            type: "EXPENSE"
        });
        expenseCategoryId = expCategory.id;

        const incCategory = await createTestCategory(userAToken, {
            name: "Salary",
            type: "INCOME"
        });
        incomeCategoryId = incCategory.id;
    });

    describe("Happy Path", () => {
        it("should successfully create a budget for an EXPENSE category", async () => {
            const reqA = authenticatedRequest(userAToken);

            const payload = {
                categoryId: expenseCategoryId,
                amount: 1500000,
                month: 10,
                year: 2026
            };

            const res = await reqA.post("/api/v1/budgets", payload);

            expect(res.status).toBe(201);
            expect(res.body.status).toBe("success");
            expect(res.body.message).toBe("Budget set successfully");
            expect(res.body.data.budget).toBeDefined();
            expect(res.body.data.budget.categoryId).toBe(expenseCategoryId);
            expect(Number(res.body.data.budget.amount)).toBe(1500000);
            expect(res.body.data.budget.month).toBe(10);
            expect(res.body.data.budget.year).toBe(2026);
            expect(res.body.data.budget.category).toHaveProperty("name", "Groceries");
        });
    });

    describe("Business Logic Failures", () => {
        it("should fail with 400 when category type is INCOME", async () => {
            const reqA = authenticatedRequest(userAToken);

            const payload = {
                categoryId: incomeCategoryId,
                amount: 2000000,
                month: 10,
                year: 2026
            };

            const res = await reqA.post("/api/v1/budgets", payload);

            expect(res.status).toBe(400);
            expect(res.body.status).toBe("fail");
            expect(res.body.message).toMatch(/only be set for EXPENSE categories/i);
        });

        it("should fail with 400 when budget for the same category, month, and year already exists", async () => {
            const reqA = authenticatedRequest(userAToken);

            // Create initial budget using helper
            await createTestBudget(userAToken, {
                categoryId: expenseCategoryId,
                amount: 1000000,
                month: 10,
                year: 2026
            });

            // Attempt to create duplicate budget
            const res = await reqA.post("/api/v1/budgets", {
                categoryId: expenseCategoryId,
                amount: 2000000,
                month: 10,
                year: 2026
            });

            expect(res.status).toBe(400);
            expect(res.body.status).toBe("fail");
            expect(res.body.message).toMatch(/already exists/i);
        });
    });

    describe("Security & Ownership Failures", () => {
        it("should fail with 404 when user tries to set budget using another user's category", async () => {
            const userBToken = await getAccessToken(TEST_USERS.userB);

            // User B creates a category
            const userBCategory = await createTestCategory(userBToken, {
                name: "Rent",
                type: "EXPENSE"
            });

            // User A tries to use User B's category ID
            const res = await authenticatedRequest(userAToken)
                .post("/api/v1/budgets", {
                    categoryId: userBCategory.id,
                    amount: 5000000,
                    month: 10,
                    year: 2026
                });

            expectNotFoundError(res, /category not found/i);
        });

        it("should fail with 404 when category ID does not exist", async () => {
            const nonExistentId = "00000000-0000-0000-0000-000000000000";

            const res = await authenticatedRequest(userAToken)
                .post("/api/v1/budgets", {
                    categoryId: nonExistentId,
                    amount: 500000,
                    month: 10,
                    year: 2026
                });

            expectNotFoundError(res, /category not found/i);
        });
    });

    describe("Validation Failures", () => {
        it("should fail with 400 when required fields are missing", async () => {
            const res = await authenticatedRequest(userAToken).post("/api/v1/budgets", {});

            expectValidationError(res);
        });

        it("should fail with 400 when month is out of valid range (1-12)", async () => {
            const res = await authenticatedRequest(userAToken)
                .post("/api/v1/budgets", {
                    categoryId: expenseCategoryId,
                    amount: 500000,
                    month: 13,
                    year: 2026
                });

            expectValidationError(res);
        });

        it("should fail with 400 when amount is negative or zero", async () => {
            const res = await authenticatedRequest(userAToken)
                .post("/api/v1/budgets", {
                    categoryId: expenseCategoryId,
                    amount: -100,
                    month: 10,
                    year: 2026
                });

            expectValidationError(res);
        });
    });
});

describe("GET /api/v1/budgets/status", () => {
    let userAToken: string;
    let walletAId: string;
    let categoryExpense1: string;
    let categoryExpense2: string;

    beforeEach(async () => {
        userAToken = await getAccessToken(TEST_USERS.userA);

        const wallet = await createTestWallet(userAToken, { balance: 5000000 });
        walletAId = wallet.id;

        const cat1 = await createTestCategory(userAToken, { name: "Food", type: "EXPENSE" });
        categoryExpense1 = cat1.id;

        const cat2 = await createTestCategory(userAToken, { name: "Transport", type: "EXPENSE" });
        categoryExpense2 = cat2.id;
    });

    describe("Happy Path & Calculations", () => {
        it("should return correct budget status and calculation metrics including alert when over budget", async () => {
            const reqA = authenticatedRequest(userAToken);

            // 1. Set Budget: Food (1.000.000), Transport (500.000) for Oct 2026
            await createTestBudget(userAToken, {
                categoryId: categoryExpense1,
                amount: 1000000,
                month: 10,
                year: 2026
            });

            await createTestBudget(userAToken, {
                categoryId: categoryExpense2,
                amount: 500000,
                month: 10,
                year: 2026
            });

            // 2. Add Transactions in Oct 2026
            // Food: 1.200.000 (Over budget)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense1,
                type: "EXPENSE",
                amount: 1200000,
                date: "2026-10-15T10:00:00.000Z"
            });

            // Transport: 300.000 (Under budget)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense2,
                type: "EXPENSE",
                amount: 300000,
                date: "2026-10-20T10:00:00.000Z"
            });

            // 3. Request Budget Status for Oct 2026
            const res = await reqA.get("/api/v1/budgets/status?month=10&year=2026");

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data.period).toEqual({ month: 10, year: 2026 });

            const { summary, budgets } = res.body.data;

            // Summary checks
            expect(summary.totalBudget).toBe(1500000);
            expect(summary.totalSpent).toBe(1500000);
            expect(summary.totalRemaining).toBe(0);
            expect(summary.hasOverBudgetItems).toBe(true);

            // Item checks
            const foodBudget = budgets.find((b: any) => b.categoryId === categoryExpense1 || b.category.name === "Food");
            expect(foodBudget.budgetAmount).toBe(1000000);
            expect(foodBudget.actualSpent).toBe(1200000);
            expect(foodBudget.remaining).toBe(-200000);
            expect(foodBudget.usagePercentage).toBe(120);
            expect(foodBudget.isOverBudget).toBe(true);

            const transportBudget = budgets.find((b: any) => b.categoryId === categoryExpense2 || b.category.name === "Transport");
            expect(transportBudget.budgetAmount).toBe(500000);
            expect(transportBudget.actualSpent).toBe(300000);
            expect(transportBudget.remaining).toBe(200000);
            expect(transportBudget.usagePercentage).toBe(60);
            expect(transportBudget.isOverBudget).toBe(false);
        });

        it("should return empty budget list if no budget set for the requested month", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/budgets/status?month=11&year=2026");

            expect(res.status).toBe(200);
            expect(res.body.data.budgets).toHaveLength(0);
            expect(res.body.data.summary.totalBudget).toBe(0);
        });
    });

    describe("Validation Failures", () => {
        it("should fail with 400 when query parameters month or year are missing", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/budgets/status");

            expectValidationError(res);
        });

        it("should fail with 400 when month parameter is invalid", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/budgets/status?month=15&year=2026");

            expectValidationError(res);
        });
    });
});