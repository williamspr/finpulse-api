import { describe, it, expect, beforeEach } from "vitest";
import {authenticatedRequest, createTestWallet, createTestCategory, expectValidationError} from "./helpers/transaction.helper.js";
import { TEST_USERS, getAccessToken } from "./helpers/auth.helper.js";

describe("GET /api/v1/reports/summary", () => {
    let userAToken: string;
    let walletAId: string;
    let categoryExpense: string;
    let categoryIncome: string;

    beforeEach(async () => {
        userAToken = await getAccessToken(TEST_USERS.userA);

        const wallet = await createTestWallet(userAToken, { balance: 10000000 });
        walletAId = wallet.id;

        const cExp = await createTestCategory(userAToken, { name: "Shopping", type: "EXPENSE" });
        categoryExpense = cExp.id;

        const cInc = await createTestCategory(userAToken, { name: "Freelance", type: "INCOME" });
        categoryIncome = cInc.id;
    });

    describe("Happy Path & Financial Calculations", () => {
        it("should calculate correct Total Income, Total Expense, and Net Cash Flow for date range", async () => {
            const reqA = authenticatedRequest(userAToken);

            // 1. Create INCOME: 3.000.000 on 2026-10-05
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryIncome,
                type: "INCOME",
                amount: 3000000,
                date: "2026-10-05T10:00:00.000Z"
            });

            // 2. Create EXPENSE: 1.000.000 on 2026-10-10
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 1000000,
                date: "2026-10-10T10:00:00.000Z"
            });

            // 3. Create EXPENSE: 500.000 on 2026-10-12
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 500000,
                date: "2026-10-12T10:00:00.000Z"
            });

            // 4. Create EXPENSE outside the period (2026-11-01) - Should be ignored
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 2000000,
                date: "2026-11-01T10:00:00.000Z"
            });

            const startDate = "2026-10-01T00:00:00.000Z";
            const endDate = "2026-10-31T23:59:59.999Z";

            const res = await reqA.get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data.summary.totalIncome).toBe(3000000);
            expect(res.body.data.summary.totalExpense).toBe(1500000);
            expect(res.body.data.summary.netCashFlow).toBe(1500000); // 3m - 1.5m
        });

        it("should return zeros if no transactions exist in period", async () => {
            const startDate = "2025-01-01T00:00:00.000Z";
            const endDate = "2025-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken)
                .get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.body.data.summary).toEqual({
                totalIncome: 0,
                totalExpense: 0,
                netCashFlow: 0
            });
        });
    });

    describe("Validation Failures", () => {
        it("should fail with 400 when query parameters are missing", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/reports/summary");

            expectValidationError(res);
        });

        it("should fail with 400 when startDate is after endDate", async () => {
            const startDate = "2026-10-31T00:00:00.000Z";
            const endDate = "2026-10-01T00:00:00.000Z";

            const res = await authenticatedRequest(userAToken)
                .get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expectValidationError(res);
        });
    });
});

describe("GET /api/v1/reports/export", () => {
    let userAToken: string;
    let walletAId: string;
    let categoryExpense: string;

    beforeEach(async () => {
        userAToken = await getAccessToken(TEST_USERS.userA);

        const wallet = await createTestWallet(userAToken, { balance: 10000000 });
        walletAId = wallet.id;

        const cExp = await createTestCategory(userAToken, { name: "Shopping", type: "EXPENSE" });
        categoryExpense = cExp.id;
    });

    it("should successfully download financial report in CSV format", async () => {
        const reqA = authenticatedRequest(userAToken);

        // Create a test transaction
        await reqA.post("/api/v1/transactions", {
            walletId: walletAId,
            categoryId: categoryExpense,
            type: "EXPENSE",
            amount: 150000,
            date: "2026-10-10T10:00:00.000Z"
        });

        const startDate = "2026-10-01T00:00:00.000Z";
        const endDate = "2026-10-31T23:59:59.999Z";

        const res = await reqA.get(`/api/v1/reports/export?format=csv&startDate=${startDate}&endDate=${endDate}`);

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("text/csv");
        expect(res.headers["content-disposition"]).toMatch(/attachment; filename="financial-report-.*\.csv"/);
        expect(res.text).toContain("Transaction ID,Date,Type,Amount,Currency");
        expect(res.text).toContain("EXPENSE");
        expect(res.text).toContain("150000");
    });

    it("should successfully download financial report in PDF format", async () => {
        const reqA = authenticatedRequest(userAToken);

        const startDate = "2026-10-01T00:00:00.000Z";
        const endDate = "2026-10-31T23:59:59.999Z";

        const res = await reqA.get(`/api/v1/reports/export?format=pdf&startDate=${startDate}&endDate=${endDate}`);

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("application/pdf");
        expect(res.headers["content-disposition"]).toMatch(/attachment; filename="financial-report-.*\.pdf"/);
    });

    it("should fail with 400 when format parameter is invalid", async () => {
        const startDate = "2026-10-01T00:00:00.000Z";
        const endDate = "2026-10-31T23:59:59.999Z";

        const res = await authenticatedRequest(userAToken)
            .get(`/api/v1/reports/export?format=excel&startDate=${startDate}&endDate=${endDate}`);

        expectValidationError(res);
    });
});