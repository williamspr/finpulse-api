import request from "supertest";
import app from "../../src/app.js";
import { expect } from "vitest";

export interface CreateWalletOptions {
    name?: string;
    balance?: number;
    currency?: string;
}

export interface CreateCategoryOptions {
    name?: string;
    type?: "INCOME" | "EXPENSE";
}

export async function createTestWallet(token: string, options: CreateWalletOptions = {}) {
    const res = await request(app).post("/api/v1/wallets").set("Authorization", `Bearer ${token}`).send({
        name: options.name || "Test Wallet",
        balance: options.balance ?? 1000000,
        currency: options.currency || "IDR"
    });

    return res.body.data.wallet;
}

export async function createTestCategory(token: string, options: CreateCategoryOptions = {}) {
    const res = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${token}`).send({
        name: options.name || "Test Category",
        type: options.type || "EXPENSE"
    });

    return res.body.data.category;
}

export function authenticatedRequest(token: string) {
    return {
        get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
        post: (url: string, body: object) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body),
        patch: (url: string, body: object) => request(app).patch(url).set("Authorization", `Bearer ${token}`).send(body),
        delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${token}`)
    };
}

export function expectValidationError(res: any) {
    expect(res.status).toBe(400);
    expect(res.body.status).toBe("fail");
    expect(res.body.message).toBe("Validation Error");
}

export function expectNotFoundError(res: any, messagePattern = /not found/i) {
    expect(res.status).toBe(404);
    expect(res.body.status).toBe("fail");
    expect(res.body.message).toMatch(messagePattern);
}