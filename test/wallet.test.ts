import {describe, it, expect} from "vitest";
import request from "supertest";
import app from "../src/app";
import { TEST_USERS, getAccessToken } from './helpers/auth.helper.js';

describe("POST /api/v1/wallets", () => {
    const validWalletPayload = {
        name: "BCA utama",
        currency: "idr", //lowercase input to test auto-uppercase in service
        balance: 1000000
    };

    //1. HAPPY PATH SCENARIOS
    it("should create a new wallet successfully with explicit balance and uppercase currency code", async () => {
        const accessToken = await getAccessToken();

        const response = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send(validWalletPayload);

        expect(response.status).toBe(201);
        expect(response.body.status).toBe("success");
        expect(response.body.message).toBe("Wallet created successfully");

        // Verify created wallet properties
        const wallet = response.body.data.wallet;
        expect(wallet).toHaveProperty("id");
        expect(wallet.name).toBe(validWalletPayload.name);
        expect(wallet.currency).toBe("IDR");
        expect(wallet.balance).toBe(validWalletPayload.balance);
        expect(wallet).toHaveProperty("userId");
    });

    it("should create a new wallet with default balance of 0 when balance is omitted", async () => {
        const accessToken = await getAccessToken();

        const response = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "Cash Wallet",
            currency: "USD"
        });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe("success");
        expect(response.body.data.wallet.balance).toBe(0);
    });

    // 2. AUTHENTICATION & SECURITY FAILURES
    it("should fail when authorization header is missing", async () => {
        const response = await request(app).post("/api/v1/wallets").send(validWalletPayload);

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
    });

    it("should fail when access token is invalid or malformed", async () => {
        const response = await request(app).post("/api/v1/wallets").set("Authorization", "Bearer invalid_malformed_access_token").send(validWalletPayload);

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
    });

    // 3. VALIDATION FAILURES
    it("should fail when wallet name is missing or empty", async () => {
        const accessToken = await getAccessToken();
        const response = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "",
            currency: "IDR"
        });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    it("should fail when currency code is not exactly 3 characters", async () => {
        const accessToken = await getAccessToken();
        const response = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "Mandiri",
            currency: "IDRR"
        });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    it("should fail when balance is negative", async () => {
        const accessToken = await getAccessToken();
        const response = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "Savings",
            currency: "IDR",
            balance: -50000
        });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });
});

describe("GET /api/v1/wallets", () => {
    // 1. HAPPY PATH SCENARIOS
    it("should return an empty list of wallets when user has created no wallets", async () => {
        const accessToken = await getAccessToken();

        const response = await request(app).get("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.data.wallets).toEqual([]);
        expect(response.body.data.summary.totalWallets).toBe(0);
    });

    it("should return list of user's wallets and correct total summary", async () => {
        const accessToken = await getAccessToken();

        // Create 2 wallets for user A
        await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "BCA Utama",
            currency: "IDR",
            balance: 5000000
        });

        await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "PayPal",
            currency: "USD",
            balance: 200
        });

        const response = await request(app).get("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.data.wallets).toHaveLength(2);
        expect(response.body.data.summary.totalWallets).toBe(2);

        // Verify balance data type is number
        expect(typeof response.body.data.wallets[0].balance).toBe("number");
    });

    // 2. ISOLATION & DATA SECURITY SCENARIOS
    it("should only return wallets belonging to the authenticated user and not other users", async () => {
        const tokenA = await getAccessToken(TEST_USERS.userA);
        const tokenB = await getAccessToken(TEST_USERS.userB);

        // Create 1 wallet for User A
        await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${tokenA}`).send({
            name: "User A Wallet",
            currency: "IDR",
            balance: 100000
        });

        // Create 1 wallet for User B
        await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${tokenB}`).send({
            name: "User B Wallet",
            currency: "IDR",
            balance: 200000
        });

        // Fetch wallets for User A
        const responseA = await request(app).get("/api/v1/wallets").set("Authorization", `Bearer ${tokenA}`);

        expect(responseA.status).toBe(200);
        expect(responseA.body.data.wallets).toHaveLength(1);
        expect(responseA.body.data.wallets[0].name).toBe("User A Wallet");
    });

    // 3. AUTHENTICATION FAILURES
    it("should fail when authorization header is missing", async () => {
        const response = await request(app).get("/api/v1/wallets");

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
    });
});

describe("GET /api/v1/wallets/:id", () => {
    // 1. HAPPY PATH SCENARIOS
    it("should return detailed wallet information when valid ID and owner token are provided", async () => {
        const accessToken = await getAccessToken();

        const createRes = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "BCA Savings",
            currency: "IDR",
            balance: 2500000
        });

        const walletId = createRes.body.data.wallet.id;

        // Fetch details
        const response = await request(app).get(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.data.wallet.id).toBe(walletId);
        expect(response.body.data.wallet.name).toBe("BCA Savings");
        expect(response.body.data.wallet.balance).toBe(2500000);
        expect(typeof response.body.data.wallet.balance).toBe("number");
    });

    // 2. ISOLATION & SECURITY FAILURES
    it("should fail with 404 when user tries to access another user's wallet", async () => {
        const tokenA = await getAccessToken(TEST_USERS.userA);
        const tokenB = await getAccessToken(TEST_USERS.userB);

        const createRes = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${tokenA}`).send({
            name: "Private Wallet A",
            currency: "USD",
            balance: 100
        });

        const walletId = createRes.body.data.wallet.id;

        const response = await request(app).get(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${tokenB}`);

        expect(response.status).toBe(404);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/wallet not found/i);
    });

    // 3. VALIDATION & RESOURCE FAILURES
    it("should fail when wallet ID format is invalid UUID", async () => {
        const accessToken = await getAccessToken();

        const response = await request(app).get("/api/v1/wallets/invalid-uuid-123").set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    it("should fail with 404 when wallet ID does not exist in database", async () => {
        const accessToken = await getAccessToken();
        const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

        const response = await request(app).get(`/api/v1/wallets/${nonExistentUuid}`).set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(404);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/wallet not found/i);
    });

    it("should fail when authorization header is missing", async () => {
        const nonExistentUuid = "00000000-0000-0000-0000-000000000000";
        const response = await request(app).get(`/api/v1/wallets/${nonExistentUuid}`);

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
    });
});

describe("PATCH /api/v1/wallets/:id", () => {
    // 1. HAPPY PATH SCENARIOS
    it("should update wallet name successfully", async () => {
        const accessToken = await getAccessToken();

        const createRes = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "Old Wallet",
            currency: "IDR",
            balance: 100000
        });

        const walletId = createRes.body.data.wallet.id;

        const response = await request(app).patch(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${accessToken}`).send({ name: "New Wallet" });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.data.wallet.name).toBe("New Wallet");
        expect(response.body.data.wallet.currency).toBe("IDR");
    });

    it("should update wallet currency code and format it to uppercase", async () => {
        const accessToken = await getAccessToken();

        const createRes = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "Savings",
            currency: "USD",
            balance: 50
        });

        const walletId = createRes.body.data.wallet.id;

        const response = await request(app).patch(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${accessToken}`).send({ currency: "eur" });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.data.wallet.currency).toBe("EUR");
    });

    // 2. SECURITY & AUTHORIZATION FAILURES
    it("should fail with 404 when user tries to update another user's wallet", async () => {
        const tokenA = await getAccessToken(TEST_USERS.userA);
        const tokenB = await getAccessToken(TEST_USERS.userB);

        const createRes = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${tokenA}`).send({
            name: "User A Wallet",
            currency: "IDR"
        });

        const walletId = createRes.body.data.wallet.id;

        const response = await request(app).patch(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${tokenB}`).send({
            name: "Hacked Wallet Name"
        });

        expect(response.status).toBe(404);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/wallet not found/i);
    });

    // 3. VALIDATION FAILURES
    it("should fail when body payload is completely empty", async () => {
        const accessToken = await getAccessToken();

        const createRes = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "BCA",
            currency: "IDR"
        });

        const walletId = createRes.body.data.wallet.id;

        const response = await request(app).patch(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${accessToken}`).send({});

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    it("should fail when currency code length is invalid", async () => {
        const accessToken = await getAccessToken();

        const createRes = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "BCA",
            currency: "IDR"
        });

        const walletId = createRes.body.data.wallet.id;

        const response = await request(app).patch(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${accessToken}`).send({ currency: "IDRR" });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });
});

describe("DELETE /api/v1/wallets/:id", () => {
    // 1. HAPPY PATH SCENARIOS
    it("should delete wallet successfully and make it unretrievable", async () => {
        const accessToken = await getAccessToken();

        const createRes = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${accessToken}`).send({
            name: "Wallet to Delete",
            currency: "IDR",
            balance: 50000
        });

        const walletId = createRes.body.data.wallet.id;

        // Delete the wallet
        const response = await request(app).delete(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.message).toMatch(/deleted successfully/i);

        // Verify wallet is no longer accessible via GET /:id
        const getResponse = await request(app).get(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${accessToken}`);
        expect(getResponse.status).toBe(404);
    });

    // 2. SECURITY & AUTHORIZATION FAILURES
    it("should fail with 404 when user tries to delete another user's wallet", async () => {
        const tokenA = await getAccessToken(TEST_USERS.userA);
        const tokenB = await getAccessToken(TEST_USERS.userB);

        const createRes = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${tokenA}`).send({
            name: "User A Wallet",
            currency: "IDR"
        });

        const walletId = createRes.body.data.wallet.id;

        const response = await request(app).delete(`/api/v1/wallets/${walletId}`).set("Authorization", `Bearer ${tokenB}`);

        expect(response.status).toBe(404);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/wallet not found/i);
    });

    // 3. VALIDATION & RESOURCE FAILURES
    it("should fail when wallet ID is an invalid UUID format", async () => {
        const accessToken = await getAccessToken();

        const response = await request(app).delete("/api/v1/wallets/invalid-uuid-123").set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    it("should fail with 404 when wallet ID does not exist", async () => {
        const accessToken = await getAccessToken();
        const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

        const response = await request(app).delete(`/api/v1/wallets/${nonExistentUuid}`).set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(404);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/wallet not found/i);
    });
});