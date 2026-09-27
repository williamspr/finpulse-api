import { describe, it, expect, beforeEach } from "vitest";
import {authenticatedRequest, createTestWallet, createTestCategory, expectValidationError} from "./helpers/transaction.helper.js";
import { TEST_USERS, getAccessToken } from "./helpers/auth.helper.js";
import request from "supertest";
import app from "../src/app";

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

    describe("Financial Aggregations & Calculations", () => {
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

        it("should support negative netCashFlow when expenses exceed income (-300000)", async () => {
            const reqA = authenticatedRequest(userAToken);

            // Create INCOME transaction (200.000)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryIncome,
                type: "INCOME",
                amount: 200000,
                date: "2026-01-05T10:00:00.000Z"
            });

            // Create EXPENSE transaction (500.000)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 500000,
                date: "2026-01-20T10:00:00.000Z"
            });

            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await reqA.get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data.summary.totalIncome).toBe(200000);
            expect(res.body.data.summary.totalExpense).toBe(500000);
            expect(res.body.data.summary.netCashFlow).toBe(-300000);
        });

        it("should return zeros if no transactions exist in period", async () => {
            const startDate = "2025-01-01T00:00:00.000Z";
            const endDate = "2025-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.body.data.summary).toEqual({
                totalIncome: 0,
                totalExpense: 0,
                netCashFlow: 0
            });
        });
    });

    describe("Date Filtering & Boundary Conditions", () => {
        it("should correctly handle exact boundary timestamps (gte & lte) and exclude outside timestamps", async () => {
            const reqA = authenticatedRequest(userAToken);

            const startDate = "2026-10-01T00:00:00.000Z";
            const endDate = "2026-10-31T23:59:59.999Z";

            // 1. Exactly 1ms BEFORE startDate -> Out of Range (Ignored)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 100000,
                date: "2026-09-30T23:59:59.999Z"
            });

            // 2. EXACT startDate boundary (gte test) -> In Range (Included)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryIncome,
                type: "INCOME",
                amount: 1000000,
                date: "2026-10-01T00:00:00.000Z"
            });

            // 3. Middle of the period -> In Range (Included)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 250000,
                date: "2026-10-15T12:00:00.000Z"
            });

            // 4. EXACT endDate boundary (lte test) -> In Range (Included)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 150000,
                date: "2026-10-31T23:59:59.999Z"
            });

            // 5. Exactly 1ms AFTER endDate -> Out of Range (Ignored)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 500000,
                date: "2026-11-01T00:00:00.000Z"
            });

            const res = await reqA.get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");

            // Calculation breakdown:
            // Total Income = 1.000.000 (Tx #2)
            // Total Expense = 250.000 (Tx #3) + 150.000 (Tx #4) = 400.000
            // Net Cash Flow = 1.000.000 - 400.000 = 600.000
            expect(res.body.data.summary).toEqual({
                totalIncome: 1000000,
                totalExpense: 400000,
                netCashFlow: 600000
            });
        });

        it("should only include transaction #2 (within range) and exclude transactions #1 and #3 (out of range)", async () => {
            const reqA = authenticatedRequest(userAToken);

            // Tx #1: 2025-12-31T23:59:59.999Z (Just below range) -> EXPENSE 100.000
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 100000,
                date: "2025-12-31T23:59:59.999Z"
            });

            // Tx #2: 2026-01-15T10:00:00.000Z (Inside range) -> INCOME 500.000
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryIncome,
                type: "INCOME",
                amount: 500000,
                date: "2026-01-15T10:00:00.000Z"
            });

            // Tx #3: 2026-02-01T00:00:00.000Z (Just above range) -> EXPENSE 200.000
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 200000,
                date: "2026-02-01T00:00:00.000Z"
            });

            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await reqA.get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data.summary).toEqual({
                totalIncome: 500000,
                totalExpense: 0,
                netCashFlow: 500000
            });
        });

        it("should pass validation and return 200 OK when valid ISO dates are provided", async () => {
            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data.period).toEqual({
                startDate,
                endDate
            });
        });
    });

    describe("Data Isolation & Authorization", () => {
        it("should only aggregate transactions belonging to User A and ignore User B's transactions", async () => {
            const userBToken = await getAccessToken(TEST_USERS.userB);

            // Setup Wallet & Categories for User B
            const walletB = await createTestWallet(userBToken, { balance: 5000000 });
            const categoryIncomeB = await createTestCategory(userBToken, { name: "Bonus", type: "INCOME" });
            const categoryExpenseB = await createTestCategory(userBToken, { name: "Bills", type: "EXPENSE" });

            // 1. User A Transactions (Income: 1.000.000, Expense: 300.000)
            await authenticatedRequest(userAToken).post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryIncome,
                type: "INCOME",
                amount: 1000000,
                date: "2026-01-10T10:00:00.000Z"
            });
            await authenticatedRequest(userAToken).post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 300000,
                date: "2026-01-15T10:00:00.000Z"
            });

            // 2. User B Transactions in the exact same date range (Income: 5.000.000, Expense: 2.000.000)
            await authenticatedRequest(userBToken).post("/api/v1/transactions", {
                walletId: walletB.id,
                categoryId: categoryIncomeB.id,
                type: "INCOME",
                amount: 5000000,
                date: "2026-01-10T10:00:00.000Z"
            });
            await authenticatedRequest(userBToken).post("/api/v1/transactions", {
                walletId: walletB.id,
                categoryId: categoryExpenseB.id,
                type: "EXPENSE",
                amount: 2000000,
                date: "2026-01-15T10:00:00.000Z"
            });

            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            // User A requests summary
            const resA = await authenticatedRequest(userAToken).get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(resA.status).toBe(200);
            expect(resA.body.data.summary).toEqual({
                totalIncome: 1000000,
                totalExpense: 300000,
                netCashFlow: 700000
            });

            // Verify User B summary independently
            const resB = await authenticatedRequest(userBToken).get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(resB.status).toBe(200);
            expect(resB.body.data.summary).toEqual({
                totalIncome: 5000000,
                totalExpense: 2000000,
                netCashFlow: 3000000
            });
        });

        it("should return 401 Unauthorized when request is sent without Authorization header", async () => {
            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await request(app).get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(401);
            expect(res.body.status).toBe("fail");
        });

        it("should return 401 Unauthorized when token is invalid or expired", async () => {
            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await request(app)
                .get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`)
                .set("Authorization", "Bearer invalid.token.here");

            expect(res.status).toBe(401);
            expect(res.body.status).toBe("fail");
        });
    });

    describe("Input & Query Validation", () => {
        it("should fail with 400 when query parameters are missing", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/reports/summary");

            expectValidationError(res);
        });

        it("should fail validation with 400 when startDate is not in full ISO 8601 format", async () => {
            const invalidStartDate = "2026-01-01"; // Missing time and timezone
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/summary?startDate=${invalidStartDate}&endDate=${endDate}`);

            expectValidationError(res);
        });

        it("should fail validation with 400 when startDate is a random non-date string", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/reports/summary?startDate=invalid-date&endDate=2026-01-31T23:59:59.999Z");

            expectValidationError(res);
        });

        it("should fail with 400 when startDate is after endDate", async () => {
            const startDate = "2026-10-31T00:00:00.000Z";
            const endDate = "2026-10-01T00:00:00.000Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/summary?startDate=${startDate}&endDate=${endDate}`);

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

    describe("CSV Export Functionality", () => {
        it("should successfully download financial report in CSV format", async () => {
            const reqA = authenticatedRequest(userAToken);

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

        it("should pass Zod validation and download CSV file successfully", async () => {
            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?format=csv&startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toContain("text/csv");
            expect(res.headers["content-disposition"]).toMatch(/attachment; filename="financial-report-.*\.csv"/);
        });

        it("should return 200 OK and CSV header only when no transactions exist in period", async () => {
            const startDate = "2025-01-01T00:00:00.000Z";
            const endDate = "2025-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?format=csv&startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toContain("text/csv");

            // CSV header should exist
            expect(res.text).toContain("Transaction ID,Date,Type,Amount,Currency");

            // Should contain no data rows (only header line)
            const lines = res.text.trim().split("\n");
            expect(lines.length).toBe(1);
        });
    });

    describe("PDF Export Functionality", () => {
        it("should successfully download financial report in PDF format", async () => {
            const reqA = authenticatedRequest(userAToken);

            const startDate = "2026-10-01T00:00:00.000Z";
            const endDate = "2026-10-31T23:59:59.999Z";

            const res = await reqA.get(`/api/v1/reports/export?format=pdf&startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toContain("application/pdf");
            expect(res.headers["content-disposition"]).toMatch(/attachment; filename="financial-report-.*\.pdf"/);
        });

        it("should pass Zod validation and download PDF file successfully", async () => {
            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?format=pdf&startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toContain("application/pdf");
            expect(res.headers["content-disposition"]).toMatch(/attachment; filename="financial-report-.*\.pdf"/);
        });

        it("should return 200 OK and valid PDF buffer without crashing when no transactions exist in period", async () => {
            const startDate = "2025-01-01T00:00:00.000Z";
            const endDate = "2025-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?format=pdf&startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toContain("application/pdf");
            expect(res.body).toBeDefined();
        });
    });

    describe("Data Isolation & Date Filtering", () => {
        it("should export CSV containing only User A's transactions and strictly exclude User B's data", async () => {
            const userBToken = await getAccessToken(TEST_USERS.userB);

            // Setup Wallet & Category for User B
            const walletB = await createTestWallet(userBToken, { balance: 5000000 });
            const categoryExpenseB = await createTestCategory(userBToken, { name: "Secret Bill", type: "EXPENSE" });

            // 1. Create Transaction for User A
            await authenticatedRequest(userAToken).post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 750000,
                note: "User A Shopping Tx",
                date: "2026-01-10T10:00:00.000Z"
            });

            // 2. Create Transaction for User B in the exact same date range
            await authenticatedRequest(userBToken).post("/api/v1/transactions", {
                walletId: walletB.id,
                categoryId: categoryExpenseB.id,
                type: "EXPENSE",
                amount: 9999999,
                note: "User B Confidential Tx",
                date: "2026-01-10T10:00:00.000Z"
            });

            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            // User A requests export
            const resA = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?format=csv&startDate=${startDate}&endDate=${endDate}`);

            expect(resA.status).toBe(200);
            expect(resA.headers["content-type"]).toContain("text/csv");

            // Must contain User A's transaction note & amount
            expect(resA.text).toContain("User A Shopping Tx");
            expect(resA.text).toContain("750000");

            // Must STRICTLY NOT contain User B's data
            expect(resA.text).not.toContain("User B Confidential Tx");
            expect(resA.text).not.toContain("9999999");
            expect(resA.text).not.toContain("Secret Bill");
        });

        it("should only include in-range boundary transactions and exclude out-of-range transactions in CSV export", async () => {
            const reqA = authenticatedRequest(userAToken);

            const startDate = "2026-10-01T00:00:00.000Z";
            const endDate = "2026-10-31T23:59:59.999Z";

            // 1. 1ms Before startDate (Out of Range)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 11111,
                note: "BEFORE_RANGE_NOTE",
                date: "2026-09-30T23:59:59.999Z"
            });

            // 2. Exact startDate boundary (gte - In Range)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 22222,
                note: "START_BOUNDARY_NOTE",
                date: "2026-10-01T00:00:00.000Z"
            });

            // 3. Exact endDate boundary (lte - In Range)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 33333,
                note: "END_BOUNDARY_NOTE",
                date: "2026-10-31T23:59:59.999Z"
            });

            // 4. 1ms After endDate (Out of Range)
            await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 44444,
                note: "AFTER_RANGE_NOTE",
                date: "2026-11-01T00:00:00.000Z"
            });

            const res = await reqA.get(`/api/v1/reports/export?format=csv&startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(200);

            // Check Included transactions
            expect(res.text).toContain("START_BOUNDARY_NOTE");
            expect(res.text).toContain("22222");
            expect(res.text).toContain("END_BOUNDARY_NOTE");
            expect(res.text).toContain("33333");

            // Check Excluded transactions
            expect(res.text).not.toContain("BEFORE_RANGE_NOTE");
            expect(res.text).not.toContain("11111");
            expect(res.text).not.toContain("AFTER_RANGE_NOTE");
            expect(res.text).not.toContain("44444");
        });
    });

    describe("Input & Authorization Validation", () => {
        it("should fail with 400 when format parameter is invalid", async () => {
            const startDate = "2026-10-01T00:00:00.000Z";
            const endDate = "2026-10-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?format=excel&startDate=${startDate}&endDate=${endDate}`);

            expectValidationError(res);
        });

        it("should fail validation with 400 when 'format' parameter is missing", async () => {
            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?startDate=${startDate}&endDate=${endDate}`);

            expectValidationError(res);
        });

        it("should fail validation with 400 when 'startDate' parameter is missing", async () => {
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?format=csv&endDate=${endDate}`);

            expectValidationError(res);
        });

        it("should fail validation with 400 when 'endDate' parameter is missing", async () => {
            const startDate = "2026-01-01T00:00:00.000Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?format=pdf&startDate=${startDate}`);

            expectValidationError(res);
        });

        it("should fail validation with 400 when startDate is after endDate", async () => {
            const startDate = "2026-01-31T23:59:59.999Z";
            const endDate = "2026-01-01T00:00:00.000Z";

            const res = await authenticatedRequest(userAToken).get(`/api/v1/reports/export?format=csv&startDate=${startDate}&endDate=${endDate}`);

            expectValidationError(res);

            const errorMessage = JSON.stringify(res.body.errors || res.body.message);
            expect(errorMessage).toMatch(/Start date must be less than or equal to End date/i);
        });

        it("should return 401 Unauthorized when request is sent without Authorization header", async () => {
            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await request(app).get(`/api/v1/reports/export?format=csv&startDate=${startDate}&endDate=${endDate}`);

            expect(res.status).toBe(401);
            expect(res.body.status).toBe("fail");
        });

        it("should return 401 Unauthorized when token is invalid or expired", async () => {
            const startDate = "2026-01-01T00:00:00.000Z";
            const endDate = "2026-01-31T23:59:59.999Z";

            const res = await request(app)
                .get(`/api/v1/reports/export?format=pdf&startDate=${startDate}&endDate=${endDate}`)
                .set("Authorization", "Bearer invalid.token.here");

            expect(res.status).toBe(401);
            expect(res.body.status).toBe("fail");
        });
    });
});