import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { getAccessToken, TEST_USERS } from "./helpers/auth.helper.js";

describe("POST /api/v1/categories", () => {
    describe("Happy Path", () => {
        it("should create a new category successfully with valid INCOME payload", async () => {
            const accessToken = await getAccessToken();

            const response = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Main Salary",
                type: "INCOME"
            });

            expect(response.status).toBe(201);
            expect(response.body.status).toBe("success");
            expect(response.body.message).toBe("Category created successfully");
            expect(response.body.data.category).toHaveProperty("id");
            expect(response.body.data.category.name).toBe("Main Salary");
            expect(response.body.data.category.type).toBe("INCOME");
            expect(response.body.data.category).toHaveProperty("userId");
            expect(response.body.data.category).toHaveProperty("createdAt");
        });

        it("should create a new category successfully with EXPENSE and TRANSFER types", async () => {
            const accessToken = await getAccessToken();

            const expenseRes = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Food & Beverages",
                type: "EXPENSE"
            });

            expect(expenseRes.status).toBe(201);
            expect(expenseRes.body.data.category.type).toBe("EXPENSE");

            const transferRes = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Interbank Transfer",
                type: "TRANSFER"
            });

            expect(transferRes.status).toBe(201);
            expect(transferRes.body.data.category.type).toBe("TRANSFER");
        });

        it("should allow two different users to create a category with the exact same name and type", async () => {
            const tokenA = await getAccessToken(TEST_USERS.userA);
            const tokenB = await getAccessToken(TEST_USERS.userB);

            const payload = { name: "Investment", type: "EXPENSE" };

            // User A creates category
            const resA = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${tokenA}`).send(payload);

            expect(resA.status).toBe(201);

            // User B creates category with same name
            const resB = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${tokenB}`).send(payload);

            expect(resB.status).toBe(201);
            expect(resB.body.data.category.id).not.toBe(resA.body.data.category.id);
        });
    });

    describe("Conflict & Business Logic Failures", () => {
        it("should fail with 400 when user creates a category with duplicate name and type (case-insensitive)", async () => {
            const accessToken = await getAccessToken();

            await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Groceries",
                type: "EXPENSE"
            });

            // Attempt to create duplicate with lowercase name
            const duplicateRes = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Groceries",
                type: "EXPENSE"
            });

            expect(duplicateRes.status).toBe(400);
            expect(duplicateRes.body.status).toBe("fail");
            expect(duplicateRes.body.message).toMatch(/already exists/i);
        });

        it("should allow same category name if the type is different (e.g. INCOME vs EXPENSE)", async () => {
            const accessToken = await getAccessToken();

            const incomeRes = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Bonus",
                type: "INCOME"
            });

            expect(incomeRes.status).toBe(201);

            // Expense Category with same name
            const expenseRes = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Bonus",
                type: "EXPENSE"
            });

            expect(expenseRes.status).toBe(201);
        });
    });

    describe("Validation Failures", () => {
        it("should fail when name is missing or empty", async () => {
            const accessToken = await getAccessToken();

            const response = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "   ",
                type: "EXPENSE",
            });

            expect(response.status).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toBe("Validation Error");
        });

        it("should fail when name is less than 2 characters", async () => {
            const accessToken = await getAccessToken();

            const response = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "A",
                type: "EXPENSE"
            });

            expect(response.status).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toBe("Validation Error");
        });

        it("should fail when type is invalid enum value", async () => {
            const accessToken = await getAccessToken();

            const response = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Delusional Category",
                type: "INVALID_TYPE"
            });

            expect(response.status).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toBe("Validation Error");
        });

        it("should fail when request body is completely empty", async () => {
            const accessToken = await getAccessToken();

            const response = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({});

            expect(response.status).toBe(400);
            expect(response.body.status).toBe("fail");
        });
    });

    describe("Security Failures", () => {
        it("should fail with 401 when Authorization header is missing", async () => {
            const response = await request(app).post("/api/v1/categories").send({
                name: "Water Bill",
                type: "EXPENSE"
            });

            expect(response.status).toBe(401);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toMatch(/unauthorized|token missing/i);
        });

        it("should fail with 401 when Bearer access token is invalid or malformed", async () => {
            const response = await request(app).post("/api/v1/categories").set("Authorization", "Bearer invalid_token_string").send({
                name: "Water Bill",
                type: "EXPENSE"
            });

            expect(response.status).toBe(401);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toMatch(/Invalid|expired/i);
        });
    });
});

describe("GET /api/v1/categories", () => {
    describe("Happy Path", () => {
        it("should return empty list when user has no categories", async () => {
            const accessToken = await getAccessToken();

            const response = await request(app).get("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.message).toBe("Categories retrieved successfully");
            expect(Array.isArray(response.body.data.categories)).toBe(true);
            expect(response.body.data.categories.length).toBe(0);
        });

        it("should return all categories belonging to the authenticated user", async () => {
            const accessToken = await getAccessToken();

            await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Main Salary",
                type: "INCOME"
            });

            await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Groceries",
                type: "EXPENSE"
            });

            const response = await request(app).get("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.categories.length).toBe(2);
        });

        it("should filter categories by type when query parameter is provided", async () => {
            const accessToken = await getAccessToken();

            await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Side Business",
                type: "INCOME"
            });

            await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Electricity Bill",
                type: "EXPENSE"
            });

            const response = await request(app).get("/api/v1/categories?type=INCOME").set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.categories.length).toBe(1);
            expect(response.body.data.categories[0].name).toBe("Side Business");
            expect(response.body.data.categories[0].type).toBe("INCOME");
        });

        it("should isolate data between different users", async () => {
            const tokenA = await getAccessToken(TEST_USERS.userA);
            const tokenB = await getAccessToken(TEST_USERS.userB);

            await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${tokenA}`).send({
                name: "User A Salary",
                type: "INCOME"
            });

            await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${tokenB}`).send({
                name: "User B Investment",
                type: "INCOME"
            });

            const resA = await request(app).get("/api/v1/categories").set("Authorization", `Bearer ${tokenA}`);

            expect(resA.status).toBe(200);
            expect(resA.body.data.categories.length).toBe(1);
            expect(resA.body.data.categories[0].name).toBe("User A Salary");
        });
    });

    describe("Validation Failures", () => {
        it("should fail when type query parameter is invalid", async () => {
            const accessToken = await getAccessToken();

            const response = await request(app).get("/api/v1/categories?type=INVALID_TYPE").set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toBe("Validation Error");
        });
    });

    describe("Security Failures", () => {
        it("should fail with 401 when Authorization header is missing", async () => {
            const response = await request(app).get("/api/v1/categories");

            expect(response.status).toBe(401);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toMatch(/unauthorized|token missing/i);
        });
    });
});

describe("DELETE /api/v1/categories/:id", () => {
    describe("Happy Path", () => {
        it("should delete category successfully when valid ID and owner token are provided", async () => {
            const accessToken = await getAccessToken();

            const createRes = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`).send({
                name: "Temporary Category",
                type: "EXPENSE"
            });

            const categoryId = createRes.body.data.category.id;

            const deleteRes = await request(app).delete(`/api/v1/categories/${categoryId}`).set("Authorization", `Bearer ${accessToken}`);

            expect(deleteRes.status).toBe(200);
            expect(deleteRes.body.status).toBe("success");
            expect(deleteRes.body.message).toBe("Category deleted successfully");

            // Verify deletion
            const getRes = await request(app).get("/api/v1/categories").set("Authorization", `Bearer ${accessToken}`);

            const exists: boolean = getRes.body.data.categories.some((c: any) => c.id === categoryId);
            expect(exists).toBe(false);
        });
    });

    describe("Business Logic & Authorization Failures", () => {
        it("should fail with 404 when category ID does not exist", async () => {
            const accessToken = await getAccessToken();
            const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

            const response = await request(app).delete(`/api/v1/categories/${nonExistentUuid}`).set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(404);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toMatch(/category not found/i);
        });

        it("should fail with 403 when trying to delete another user's category", async () => {
            const tokenA = await getAccessToken(TEST_USERS.userA);
            const tokenB = await getAccessToken(TEST_USERS.userB);

            const createRes = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${tokenA}`).send({
                name: "User A Private Category",
                type: "INCOME"
            });

            const categoryId = createRes.body.data.category.id;

            // User B tries to delete User A's category
            const deleteRes = await request(app).delete(`/api/v1/categories/${categoryId}`).set("Authorization", `Bearer ${tokenB}`);

            expect(deleteRes.status).toBe(403);
            expect(deleteRes.body.status).toBe("fail");
            expect(deleteRes.body.message).toMatch(/permission|not have permission/i);
        });
    });

    describe("Validation Failures", () => {
        it("should fail with 400 when category ID is not a valid UUID format", async () => {
            const accessToken = await getAccessToken();

            const response = await request(app).delete("/api/v1/categories/invalid-uuid-format").set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toBe("Validation Error");
        });
    });

    describe("Security Failures", () => {
        it("should fail with 401 when Authorization header is missing", async () => {
            const dummyUuid = "00000000-0000-0000-0000-000000000000";

            const response = await request(app).delete(`/api/v1/categories/${dummyUuid}`);

            expect(response.status).toBe(401);
            expect(response.body.status).toBe("fail");
            expect(response.body.message).toMatch(/unauthorized|token missing/i);
        });
    });
});