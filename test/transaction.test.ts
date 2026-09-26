import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { getAccessToken, TEST_USERS } from "./helpers/auth.helper.js";
import { prisma } from "../src/config/prisma.js";
import { beforeEach } from 'vitest';
import {createTestWallet, createTestCategory, authenticatedRequest, expectValidationError, expectNotFoundError} from "./helpers/transaction.helper.js";

describe("POST /api/v1/transactions", () => {
    describe("Happy Path", () => {
        it("should create INCOME transaction and increment wallet balance", async () => {
            const token = await getAccessToken();

            const wallet = await createTestWallet(token, { name: "Cash Wallet", balance: 1000000 });
            const category = await createTestCategory(token, { name: "Salary", type: "INCOME" });

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: wallet.id,
                categoryId: category.id,
                type: "INCOME",
                amount: 500000,
                note: "Monthly bonus"
            });

            expect(res.status).toBe(201);
            expect(res.body.status).toBe("success");
            expect(res.body.data.transaction).toHaveProperty("id");
            expect(res.body.data.transaction.type).toBe("INCOME");

            const updatedWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
            expect(Number(updatedWallet?.balance)).toBe(1500000);
        });

        it("should create EXPENSE transaction and decrement wallet balance", async () => {
            const token = await getAccessToken();

            const wallet = await createTestWallet(token, { name: "Bank Account", balance: 200000 });
            const category = await createTestCategory(token, { name: "Groceries", type: "EXPENSE" });

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: wallet.id,
                categoryId: category.id,
                type: "EXPENSE",
                amount: 50000
            });

            expect(res.status).toBe(201);

            const updatedWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
            expect(Number(updatedWallet?.balance)).toBe(150000);
        });

        it("should process TRANSFER between same currency wallets correctly", async () => {
            const token = await getAccessToken();

            const sourceWallet = await createTestWallet(token, { name: "Main Account", balance: 500000 });
            const targetWallet = await createTestWallet(token, { name: "Savings Account", balance: 100000 });

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: sourceWallet.id,
                targetWalletId: targetWallet.id,
                type: "TRANSFER",
                amount: 200000
            });

            expect(res.status).toBe(201);

            const updatedSource = await prisma.wallet.findUnique({ where: { id: sourceWallet.id } });
            const updatedTarget = await prisma.wallet.findUnique({ where: { id: targetWallet.id } });

            expect(Number(updatedSource?.balance)).toBe(300000);
            expect(Number(updatedTarget?.balance)).toBe(300000);
        });

        it("should process TRANSFER with cross-currency exchange rate calculation", async () => {
            const token = await getAccessToken();

            const sourceWallet = await createTestWallet(token, { name: "USD Account", balance: 100, currency: "USD" });
            const targetWallet = await createTestWallet(token, { name: "IDR Account", balance: 0, currency: "IDR" });

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: sourceWallet.id,
                targetWalletId: targetWallet.id,
                type: "TRANSFER",
                amount: 50,
                exchangeRate: 16000
            });

            expect(res.status).toBe(201);

            const updatedSource = await prisma.wallet.findUnique({ where: { id: sourceWallet.id } });
            const updatedTarget = await prisma.wallet.findUnique({ where: { id: targetWallet.id } });

            expect(Number(updatedSource?.balance)).toBe(50);
            expect(Number(updatedTarget?.balance)).toBe(800000);
        });
    });

    describe("Business Logic Failures", () => {
        it("should fail with 400 when EXPENSE exceeds source wallet balance", async () => {
            const token = await getAccessToken();

            const wallet = await createTestWallet(token, { name: "Small Wallet", balance: 10000 });
            const category = await createTestCategory(token, { name: "Shopping", type: "EXPENSE" });

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: wallet.id,
                categoryId: category.id,
                type: "EXPENSE",
                amount: 50000
            });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/insufficient wallet balance/i);
        });

        it("should fail with 400 when cross-currency TRANSFER missing exchange rate", async () => {
            const token = await getAccessToken();

            const sourceWallet = await createTestWallet(token, { name: "USD Wallet", balance: 500, currency: "USD" });
            const targetWallet = await createTestWallet(token, { name: "IDR Wallet", balance: 0, currency: "IDR" });

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: sourceWallet.id,
                targetWalletId: targetWallet.id,
                type: "TRANSFER",
                amount: 10
            });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/exchange rate is required/i);
        });

        it("should fail with 400 when category type does not match transaction type", async () => {
            const token = await getAccessToken();

            const wallet = await createTestWallet(token, { name: "Wallet", balance: 100000 });
            const category = await createTestCategory(token, { name: "Investment Return", type: "INCOME" });

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: wallet.id,
                categoryId: category.id,
                type: "EXPENSE",
                amount: 10000,
            });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/category type mismatch/i);
        });

        it("should fail with 404 when trying to use another user's wallet", async () => {
            const tokenA = await getAccessToken(TEST_USERS.userA);
            const tokenB = await getAccessToken(TEST_USERS.userB);

            const walletA = await createTestWallet(tokenA, { name: "User A Wallet", balance: 500000 });
            const categoryB = await createTestCategory(tokenB, { name: "Food", type: "EXPENSE" });

            const res = await authenticatedRequest(tokenB).post("/api/v1/transactions", {
                walletId: walletA.id,
                categoryId: categoryB.id,
                type: "EXPENSE",
                amount: 50000
            });

            expectNotFoundError(res, /source wallet not found/i);
        });
    });

    describe("Validation Failures", () => {
        it("should fail when TRANSFER type missing targetWalletId", async () => {
            const token = await getAccessToken();
            const validUuid = "00000000-0000-0000-0000-000000000000";

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: validUuid,
                type: "TRANSFER",
                amount: 10000
            });

            expectValidationError(res);
        });

        it("should fail when source and target wallets are identical", async () => {
            const token = await getAccessToken();
            const validUuid = "00000000-0000-0000-0000-000000000000";

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: validUuid,
                targetWalletId: validUuid,
                type: "TRANSFER",
                amount: 10000
            });

            expectValidationError(res);
        });

        it("should fail when amount is 0 or negative", async () => {
            const token = await getAccessToken();
            const validUuid = "00000000-0000-0000-0000-000000000000";

            const res = await authenticatedRequest(token).post("/api/v1/transactions", {
                walletId: validUuid,
                categoryId: validUuid,
                type: "INCOME",
                amount: -500
            });

            expectValidationError(res);
        });
    });

    describe("Security Failures", () => {
        it("should fail with 401 when token is missing", async () => {
            const res = await request(app).post("/api/v1/transactions").send({});

            expect(res.status).toBe(401);
            expect(res.body.message).toMatch(/unauthorized|token missing/i);
        });
    });
});

describe("GET /api/v1/transactions", () => {
    let userAToken: string;
    let walletIdr: string;
    let walletUsd: string;
    let categoryExpense: string;
    let categoryIncome: string;

    beforeEach(async () => {
        userAToken = await getAccessToken(TEST_USERS.userA);
        const reqA = authenticatedRequest(userAToken);

        // 1. Setup Wallets for User A
        const walletIdrRes = await createTestWallet(userAToken, {
            name: "Rupiah Wallet",
            balance: 1000000,
            currency: "IDR"
        });
        walletIdr = walletIdrRes.id;

        const walletUsdRes = await createTestWallet(userAToken, {
            name: "Dollar Wallet",
            balance: 500,
            currency: "USD"
        });
        walletUsd = walletUsdRes.id;

        // 2. Setup Categories for User A
        const catExpenseRes = await createTestCategory(userAToken, {
            name: "Food & Dining",
            type: "EXPENSE"
        });
        categoryExpense = catExpenseRes.id;

        const catIncomeRes = await createTestCategory(userAToken, {
            name: "Freelance",
            type: "INCOME"
        });
        categoryIncome = catIncomeRes.id;

        // 3. Populate Sample Transactions
        // T1: EXPENSE - IDR - "Buying food at warung" - 2026-01-10
        await reqA.post("/api/v1/transactions", {
            walletId: walletIdr,
            categoryId: categoryExpense,
            type: "EXPENSE",
            amount: 25000,
            note: "Buying food at warung",
            date: "2026-01-10T10:00:00.000Z"
        });

        // T2: EXPENSE - USD - "Fast food lunch" - 2026-01-15
        await reqA.post("/api/v1/transactions", {
            walletId: walletUsd,
            categoryId: categoryExpense,
            type: "EXPENSE",
            amount: 15,
            note: "Fast food lunch",
            date: "2026-01-15T12:00:00.000Z"
        });

        // T3: INCOME - IDR - "Web design payment" - 2026-01-20
        await reqA.post("/api/v1/transactions", {
            walletId: walletIdr,
            categoryId: categoryIncome,
            type: "INCOME",
            amount: 500000,
            note: "Web design payment",
            date: "2026-01-20T08:00:00.000Z"
        });
    });

    describe("Happy Path & Filtering", () => {
        it("should retrieve all transactions belonging to authenticated user with pagination metadata", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/transactions");

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data.transactions).toHaveLength(3);
            expect(res.body.data.pagination).toEqual({
                page: 1,
                limit: 10,
                totalItems: 3,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false
            });
        });

        it("should paginate transactions correctly when page and limit parameters are set", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/transactions?page=1&limit=2");

            expect(res.status).toBe(200);
            expect(res.body.data.transactions).toHaveLength(2);
            expect(res.body.data.pagination).toEqual({
                page: 1,
                limit: 2,
                totalItems: 3,
                totalPages: 2,
                hasNextPage: true,
                hasPrevPage: false
            });
        });

        it("should filter transactions by search term in note (case-insensitive)", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/transactions?search=food");

            expect(res.status).toBe(200);
            expect(res.body.data.transactions).toHaveLength(2); // "Buying food..." & "Fast food..."
            expect(
                res.body.data.transactions.every((t: any) =>
                    t.note.toLowerCase().includes("food")
                )
            ).toBe(true);
        });

        it("should filter transactions by type", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/transactions?type=INCOME");

            expect(res.status).toBe(200);
            expect(res.body.data.transactions).toHaveLength(1);
            expect(res.body.data.transactions[0].type).toBe("INCOME");
        });

        it("should filter transactions by currency", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/transactions?currency=USD");

            expect(res.status).toBe(200);
            expect(res.body.data.transactions).toHaveLength(1);
            expect(res.body.data.transactions[0].currency).toBe("USD");
        });

        it("should filter transactions by date range (startDate & endDate)", async () => {
            const res = await authenticatedRequest(userAToken)
                .get("/api/v1/transactions?startDate=2026-01-12T00:00:00.000Z&endDate=2026-01-18T23:59:59.000Z");

            expect(res.status).toBe(200);
            expect(res.body.data.transactions).toHaveLength(1); // Only transaction on 2026-01-15
            expect(res.body.data.transactions[0].note).toBe("Fast food lunch");
        });
    });

    describe("Data Isolation & Security", () => {
        it("should isolate transaction data between different users", async () => {
            const userBToken = await getAccessToken(TEST_USERS.userB);

            const res = await authenticatedRequest(userBToken).get("/api/v1/transactions");

            expect(res.status).toBe(200);
            expect(res.body.data.transactions).toHaveLength(0);
            expect(res.body.data.pagination.totalItems).toBe(0);
        });

        it("should fail with 400 when invalid query parameter is provided", async () => {
            const res = await authenticatedRequest(userAToken).get("/api/v1/transactions?type=INVALID_TYPE");

            expectValidationError(res);
        });
    });
});

describe("GET /api/v1/transactions/:id", () => {
    it("should retrieve transaction detail successfully for valid owner", async () => {
        const token = await getAccessToken(TEST_USERS.userA);

        const wallet = await createTestWallet(token, { name: "Detail Wallet", balance: 100000 });
        const category = await createTestCategory(token, { name: "Bills", type: "EXPENSE" });

        const txRes = await authenticatedRequest(token).post("/api/v1/transactions", {
            walletId: wallet.id,
            categoryId: category.id,
            type: "EXPENSE",
            amount: 20000,
            note: "Internet bill"
        });

        const transactionId = txRes.body.data.transaction.id;

        const res = await authenticatedRequest(token).get(`/api/v1/transactions/${transactionId}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("success");
        expect(res.body.data.transaction.id).toBe(transactionId);
        expect(res.body.data.transaction.note).toBe("Internet bill");
        expect(res.body.data.transaction.wallet).toHaveProperty("name", "Detail Wallet");
        expect(res.body.data.transaction.category).toHaveProperty("name", "Bills");
    });

    it("should fail with 404 when transaction ID does not exist", async () => {
        const token = await getAccessToken();
        const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

        const res = await authenticatedRequest(token).get(`/api/v1/transactions/${nonExistentUuid}`);

        expectNotFoundError(res, /transaction not found/i);
    });

    it("should fail with 404 when user tries to access another user's transaction", async () => {
        const tokenA = await getAccessToken(TEST_USERS.userA);
        const tokenB = await getAccessToken(TEST_USERS.userB);

        const walletA = await createTestWallet(tokenA, { name: "User A Private Wallet", balance: 100000 });
        const categoryA = await createTestCategory(tokenA, { name: "Private Category", type: "INCOME" });

        const txRes = await authenticatedRequest(tokenA).post("/api/v1/transactions", {
            walletId: walletA.id,
            categoryId: categoryA.id,
            type: "INCOME",
            amount: 500000
        });

        const transactionId = txRes.body.data.transaction.id;

        // User B tries to get User A's transaction detail
        const res = await authenticatedRequest(tokenB).get(`/api/v1/transactions/${transactionId}`);

        expectNotFoundError(res, /transaction not found/i);
    });

    it("should fail with 400 when ID parameter is not a valid UUID", async () => {
        const token = await getAccessToken();

        const res = await authenticatedRequest(token).get("/api/v1/transactions/invalid-uuid-123");

        expectValidationError(res);
    });
});

describe("PATCH /api/v1/transactions/:id", () => {
    let userAToken: string;
    let walletAId: string;
    let walletBId: string;
    let categoryExpense: string;
    let categoryIncome: string;

    beforeEach(async () => {
        userAToken = await getAccessToken(TEST_USERS.userA);

        // Setup Wallets
        const wA = await createTestWallet(userAToken, {
            name: "Main IDR Wallet",
            balance: 500000,
            currency: "IDR"
        });
        walletAId = wA.id;

        const wB = await createTestWallet(userAToken, {
            name: "Savings IDR Wallet",
            balance: 100000,
            currency: "IDR"
        });
        walletBId = wB.id;

        // Setup Categories
        const cExp = await createTestCategory(userAToken, {
            name: "Food",
            type: "EXPENSE"
        });
        categoryExpense = cExp.id;

        const cInc = await createTestCategory(userAToken, {
            name: "Bonus",
            type: "INCOME"
        });
        categoryIncome = cInc.id;
    });

    describe("Happy Path & Balance Recalculation", () => {
        it("should update EXPENSE amount and correctly adjust wallet balance", async () => {
            const reqA = authenticatedRequest(userAToken);

            // 1. Create initial EXPENSE of 50,000
            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 50000,
                note: "Lunch"
            });
            const txId = txRes.body.data.transaction.id;

            // 2. Update EXPENSE amount to 100,000
            const res = await reqA.patch(`/api/v1/transactions/${txId}`, {
                amount: 100000,
                note: "Expensive Lunch"
            });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(Number(res.body.data.transaction.amount)).toBe(100000);
            expect(res.body.data.transaction.note).toBe("Expensive Lunch");

            // 3. Verify Wallet Balance (Initial 500k - Updated 100k = 400k)
            const wallet = await prisma.wallet.findUnique({ where: { id: walletAId } });
            expect(Number(wallet?.balance)).toBe(400000);
        });

        it("should handle type change from EXPENSE to INCOME and adjust balance accordingly", async () => {
            const reqA = authenticatedRequest(userAToken);

            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 50000
            });
            const txId = txRes.body.data.transaction.id;

            const res = await reqA.patch(`/api/v1/transactions/${txId}`, {
                type: "INCOME",
                categoryId: categoryIncome,
                amount: 50000
            });

            expect(res.status).toBe(200);
            expect(res.body.data.transaction.type).toBe("INCOME");

            const wallet = await prisma.wallet.findUnique({ where: { id: walletAId } });
            expect(Number(wallet?.balance)).toBe(550000);
        });

        it("should update TRANSFER amount across source and target wallets correctly", async () => {
            const reqA = authenticatedRequest(userAToken);

            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                targetWalletId: walletBId,
                type: "TRANSFER",
                amount: 100000
            });
            const txId = txRes.body.data.transaction.id;

            const res = await reqA.patch(`/api/v1/transactions/${txId}`, { amount: 200000 });

            expect(res.status).toBe(200);

            const walletA = await prisma.wallet.findUnique({ where: { id: walletAId } });
            const walletB = await prisma.wallet.findUnique({ where: { id: walletBId } });

            expect(Number(walletA?.balance)).toBe(300000);
            expect(Number(walletB?.balance)).toBe(300000);
        });
    });

    describe("Business Logic & Edge Case Failures", () => {
        it("should fail with 400 when updating EXPENSE amount exceeds available wallet balance", async () => {
            const reqA = authenticatedRequest(userAToken);

            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 50000
            });
            const txId = txRes.body.data.transaction.id;

            const res = await reqA.patch(`/api/v1/transactions/${txId}`, { amount: 600000 });

            expect(res.status).toBe(400);
            expect(res.body.status).toBe("fail");
            expect(res.body.message).toMatch(/insufficient wallet balance/i);
        });

        it("should fail with 400 when updating to mismatching category type", async () => {
            const reqA = authenticatedRequest(userAToken);

            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 20000
            });
            const txId = txRes.body.data.transaction.id;

            const res = await reqA.patch(`/api/v1/transactions/${txId}`, { categoryId: categoryIncome });

            expect(res.status).toBe(400);
            expect(res.body.status).toBe("fail");
            expect(res.body.message).toMatch(/category type mismatch/i);
        });

        it("should fail with 404 when transaction ID does not exist", async () => {
            const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

            const res = await authenticatedRequest(userAToken).patch(`/api/v1/transactions/${nonExistentUuid}`, { note: "Updated Note" });

            expectNotFoundError(res, /transaction not found/i);
        });

        it("should fail with 404 when user attempts to update another user's transaction", async () => {
            const userBToken = await getAccessToken(TEST_USERS.userB);

            const txRes = await authenticatedRequest(userAToken).post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 10000
            });
            const txId = txRes.body.data.transaction.id;

            // User B tries to update User A's transaction
            const res = await authenticatedRequest(userBToken).patch(`/api/v1/transactions/${txId}`, { note: "Hacked note" });

            expectNotFoundError(res, /transaction not found/i);
        });
    });

    describe("Validation Failures", () => {
        it("should fail with 400 when body payload is completely empty", async () => {
            const reqA = authenticatedRequest(userAToken);

            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 10000
            });
            const txId = txRes.body.data.transaction.id;

            const res = await reqA.patch(`/api/v1/transactions/${txId}`, {});

            expectValidationError(res);
        });

        it("should fail with 400 when amount is negative", async () => {
            const reqA = authenticatedRequest(userAToken);

            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 10000
            });
            const txId = txRes.body.data.transaction.id;

            const res = await reqA.patch(`/api/v1/transactions/${txId}`, { amount: -5000 });

            expectValidationError(res);
        });
    });
});

describe("DELETE /api/v1/transactions/:id", () => {
    let userAToken: string;
    let walletAId: string;
    let walletBId: string;
    let categoryExpense: string;
    let categoryIncome: string;

    beforeEach(async () => {
        userAToken = await getAccessToken(TEST_USERS.userA);

        const wA = await createTestWallet(userAToken, {
            name: "Main IDR Wallet",
            balance: 500000,
            currency: "IDR"
        });
        walletAId = wA.id;

        const wB = await createTestWallet(userAToken, {
            name: "Savings IDR Wallet",
            balance: 100000,
            currency: "IDR"
        });
        walletBId = wB.id;

        const cExp = await createTestCategory(userAToken, {
            name: "Food",
            type: "EXPENSE"
        });
        categoryExpense = cExp.id;

        const cInc = await createTestCategory(userAToken, {
            name: "Bonus",
            type: "INCOME"
        });
        categoryIncome = cInc.id;
    });

    describe("Happy Path & Balance Reversion", () => {
        it("should delete EXPENSE transaction and increment wallet balance back", async () => {
            const reqA = authenticatedRequest(userAToken);

            // 1. Create EXPENSE 50k (Balance: 500k - 50k = 450k)
            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 50000
            });
            const txId = txRes.body.data.transaction.id;

            let wallet = await prisma.wallet.findUnique({ where: { id: walletAId } });
            expect(Number(wallet?.balance)).toBe(450000);

            // 2. Delete Transaction
            const res = await reqA.delete(`/api/v1/transactions/${txId}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data).toBe("OK");
            expect(res.body.message).toBe("Transaction deleted successfully");

            // 3. Verify Wallet Balance restored to 500k
            wallet = await prisma.wallet.findUnique({ where: { id: walletAId } });
            expect(Number(wallet?.balance)).toBe(500000);
        });

        it("should delete INCOME transaction and decrement wallet balance back", async () => {
            const reqA = authenticatedRequest(userAToken);

            // 1. Create INCOME 100k (Balance: 500k + 100k = 600k)
            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryIncome,
                type: "INCOME",
                amount: 100000
            });
            const txId = txRes.body.data.transaction.id;

            let wallet = await prisma.wallet.findUnique({ where: { id: walletAId } });
            expect(Number(wallet?.balance)).toBe(600000);

            // 2. Delete Transaction
            const res = await reqA.delete(`/api/v1/transactions/${txId}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data).toBe("OK");

            // 3. Verify Wallet Balance restored to 500k
            wallet = await prisma.wallet.findUnique({ where: { id: walletAId } });
            expect(Number(wallet?.balance)).toBe(500000);
        });

        it("should delete TRANSFER transaction and revert both source and target balances", async () => {
            const reqA = authenticatedRequest(userAToken);

            // 1. Create TRANSFER 200k from Wallet A to Wallet B
            // Wallet A: 500k - 200k = 300k | Wallet B: 100k + 200k = 300k
            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                targetWalletId: walletBId,
                type: "TRANSFER",
                amount: 200000
            });
            const txId = txRes.body.data.transaction.id;

            let walletA = await prisma.wallet.findUnique({ where: { id: walletAId } });
            let walletB = await prisma.wallet.findUnique({ where: { id: walletBId } });

            expect(Number(walletA?.balance)).toBe(300000);
            expect(Number(walletB?.balance)).toBe(300000);

            // 2. Delete Transaction
            const res = await reqA.delete(`/api/v1/transactions/${txId}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data).toBe("OK");

            // 3. Verify Balances restored (A: 500k, B: 100k)
            walletA = await prisma.wallet.findUnique({ where: { id: walletAId } });
            walletB = await prisma.wallet.findUnique({ where: { id: walletBId } });

            expect(Number(walletA?.balance)).toBe(500000);
            expect(Number(walletB?.balance)).toBe(100000);
        });
    });

    describe("Business Logic Failures", () => {
        it("should fail with 400 when deleting INCOME transaction would cause negative wallet balance", async () => {
            const reqA = authenticatedRequest(userAToken);

            const lowWallet = await createTestWallet(userAToken, { name: "Low Balance", balance: 0 });

            // Create INCOME 100k (Balance becomes 100k)
            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: lowWallet.id,
                categoryId: categoryIncome,
                type: "INCOME",
                amount: 100000
            });
            const txId = txRes.body.data.transaction.id;

            // Spend 80k as EXPENSE (Balance becomes 20k)
            await reqA.post("/api/v1/transactions", {
                walletId: lowWallet.id,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 80000
            });

            // Attempting to delete the 100k INCOME would make balance 20k - 100k = -80k
            const res = await reqA.delete(`/api/v1/transactions/${txId}`);

            expect(res.status).toBe(400);
            expect(res.body.status).toBe("fail");
            expect(res.body.message).toMatch(/wallet balance would become negative/i);
        });

        it("should fail with 400 when deleting TRANSFER would cause negative target wallet balance", async () => {
            const reqA = authenticatedRequest(userAToken);

            const targetWallet = await createTestWallet(userAToken, { name: "Target Wallet", balance: 0 });

            // TRANSFER 100k to targetWallet (target balance becomes 100k)
            const txRes = await reqA.post("/api/v1/transactions", {
                walletId: walletAId,
                targetWalletId: targetWallet.id,
                type: "TRANSFER",
                amount: 100000
            });
            const txId = txRes.body.data.transaction.id;

            // Spend 90k from targetWallet (target balance becomes 10k)
            await reqA.post("/api/v1/transactions", {
                walletId: targetWallet.id,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 90000
            });

            // Reverting transfer requires deducting 100k from targetWallet (10k - 100k = -90k)
            const res = await reqA.delete(`/api/v1/transactions/${txId}`);

            expect(res.status).toBe(400);
            expect(res.body.status).toBe("fail");
            expect(res.body.message).toMatch(/target wallet balance would become negative/i);
        });
    });

    describe("Security & Validation Failures", () => {
        it("should fail with 404 when transaction ID does not exist", async () => {
            const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

            const res = await authenticatedRequest(userAToken).delete(`/api/v1/transactions/${nonExistentUuid}`);

            expectNotFoundError(res, /transaction not found/i);
        });

        it("should fail with 404 when user attempts to delete another user's transaction", async () => {
            const userBToken = await getAccessToken(TEST_USERS.userB);

            const txRes = await authenticatedRequest(userAToken).post("/api/v1/transactions", {
                walletId: walletAId,
                categoryId: categoryExpense,
                type: "EXPENSE",
                amount: 10000
            });
            const txId = txRes.body.data.transaction.id;

            // User B attempts to delete User A's transaction
            const res = await authenticatedRequest(userBToken).delete(`/api/v1/transactions/${txId}`);

            expectNotFoundError(res, /transaction not found/i);
        });

        it("should fail with 400 when ID parameter is not a valid UUID", async () => {
            const res = await authenticatedRequest(userAToken).delete("/api/v1/transactions/invalid-uuid-123");

            expectValidationError(res);
        });
    });
});