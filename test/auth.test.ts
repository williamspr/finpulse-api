import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { getAccessToken, TEST_USERS } from './helpers/auth.helper.js';

describe("POST /api/v1/auth/register", () => {
    // 1. HAPPY PATH
    it("should register a new user successfully with valid input", async () => {
        const response = await request(app)
            .post("/api/v1/auth/register")
            .send(TEST_USERS.userA);

        expect(response.status).toBe(201);
        expect(response.body.status).toBe("success");
        expect(response.body.data.user).toHaveProperty("id");
        expect(response.body.data.user.name).toBe(TEST_USERS.userA.name);
        expect(response.body.data.user.email).toBe(TEST_USERS.userA.email);
        expect(response.body.data.user).not.toHaveProperty("password");
    });

    // 2. VALIDATION FAILURES
    it("should fail when name is too short", async () => {
        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({
                ...TEST_USERS.userA,
                name: "A",
            });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    it("should fail when email format is invalid", async () => {
        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({
                ...TEST_USERS.userA,
                email: "invalid-email-format",
            });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    it("should fail when password is too short", async () => {
        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({
                ...TEST_USERS.userA,
                password: "123",
            });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    it("should fail when request body is empty", async () => {
        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
    });

    // 3. CONFLICT / DUPLICATE EMAIL
    it("should fail when email is already registered", async () => {
        await request(app).post("/api/v1/auth/register").send(TEST_USERS.userA);

        const response = await request(app)
            .post("/api/v1/auth/register")
            .send(TEST_USERS.userA);

        expect(response.status).toBe(409);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/already registered|already exists/i);
    });
});

describe("POST /api/v1/auth/login", () => {
    // 1. HAPPY PATH
    it("should login successfully, return access token, and set refresh token cookie", async () => {
        await request(app).post("/api/v1/auth/register").send(TEST_USERS.userA);

        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: TEST_USERS.userA.email,
                password: TEST_USERS.userA.password,
            });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.message).toBe("Logged in successfully");

        // Verify the data response structure.
        expect(response.body.data).toHaveProperty("accessToken");
        expect(response.body.data.user).toHaveProperty("id");
        expect(response.body.data.user.email).toBe(TEST_USERS.userA.email);
        expect(response.body.data.user).not.toHaveProperty("password");

        // Refresh Token Cookie Verification
        const cookies = response.headers["set-cookie"];
        expect(cookies).toBeDefined();
        expect(cookies[0]).toContain("refreshToken=");
        expect(cookies[0]).toContain("HttpOnly");
    });

    // 2. VALIDATION FAILURES
    it("should fail login when email format is invalid", async () => {
        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "not-an-email",
                password: "SecretPassword123",
            });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    it("should fail login when password field is missing", async () => {
        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: TEST_USERS.userA.email,
            });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toBe("Validation Error");
    });

    // 3. AUTHENTICATION FAILURES
    it("should fail login when email is not registered", async () => {
        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "unregistered@gmail.com",
                password: "SecretPassword123",
            });

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/invalid email or password/i);
    });

    it("should fail login when password is incorrect", async () => {
        await request(app).post("/api/v1/auth/register").send(TEST_USERS.userA);

        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: TEST_USERS.userA.email,
                password: "WrongPassword999",
            });

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/invalid email or password/i);
    });
});

describe("POST /api/v1/auth/refresh-token", () => {
    // Helper for time delay
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // 1. HAPPY PATH & TOKEN ROTATION
    it("should refresh access token successfully and rotate refresh token in database & cookie", async () => {
        await request(app).post("/api/v1/auth/register").send(TEST_USERS.userA);
        const loginRes = await request(app).post("/api/v1/auth/login").send({
            email: TEST_USERS.userA.email,
            password: TEST_USERS.userA.password,
        });

        const oldCookies = loginRes.headers["set-cookie"];
        const oldAccessToken = loginRes.body.data.accessToken;

        await sleep(1000);

        const response = await request(app)
            .post("/api/v1/auth/refresh-token")
            .set("Cookie", oldCookies);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.message).toBe("Token refreshed successfully");

        expect(response.body.data).toHaveProperty("accessToken");
        const newAccessToken = response.body.data.accessToken;
        expect(newAccessToken).not.toBe(oldAccessToken);

        const newCookies = response.headers["set-cookie"];
        expect(newCookies).toBeDefined();
        expect(newCookies[0]).toContain("refreshToken=");
        expect(newCookies[0]).not.toBe(oldCookies[0]);
    });

    // 2. SECURITY & VALIDATION FAILURES
    it("should fail when refresh token cookie is missing", async () => {
        const response = await request(app).post("/api/v1/auth/refresh-token");

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/refresh token is required/i);
    });

    it("should fail when refresh token is malformed or invalid JWT signature", async () => {
        const response = await request(app)
            .post("/api/v1/auth/refresh-token")
            .set("Cookie", ["refreshToken=invalid_malformed_jwt_token_string"]);

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/invalid or expired refresh token/i);
    });

    it("should fail when refresh token is valid JWT format but not found in database (revoked)", async () => {
        const fakeTokenPayload = { userId: "fake-uuid-123", role: "USER" };
        const { generateRefreshToken } = await import("../src/util/jwt.js");
        const validJwtButNotSavedInDb = generateRefreshToken(fakeTokenPayload);

        const response = await request(app)
            .post("/api/v1/auth/refresh-token")
            .set("Cookie", [`refreshToken=${validJwtButNotSavedInDb}`]);

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/refresh token not found or revoked/i);
    });
});

describe("POST /api/v1/auth/logout", () => {
    // 1. HAPPY PATH
    it("should logout successfully, delete refresh token from database, and clear cookie", async () => {
        await request(app).post("/api/v1/auth/register").send(TEST_USERS.userA);

        const loginRes = await request(app).post("/api/v1/auth/login").send({
            email: TEST_USERS.userA.email,
            password: TEST_USERS.userA.password,
        });

        const cookies = loginRes.headers["set-cookie"];

        const response = await request(app)
            .post("/api/v1/auth/logout")
            .set("Cookie", cookies);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.message).toMatch(/logged out successfully/i);

        const logoutCookies = response.headers["set-cookie"];
        expect(logoutCookies).toBeDefined();
        expect(logoutCookies[0]).toContain("refreshToken=;");
    });

    // 2. MISSING COOKIE FAILURE
    it("should fail logout when refresh token cookie is missing", async () => {
        const response = await request(app).post("/api/v1/auth/logout");

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/refresh token is required/i);
    });

    // 3. INVALID TOKEN FAILURE
    it("should fail logout when refresh token cookie is malformed or invalid", async () => {
        const response = await request(app)
            .post("/api/v1/auth/logout")
            .set("Cookie", ["refreshToken=invalid_malformed_token_string"]);

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/invalid or expired refresh token/i);
    });
});

describe("GET /api/v1/auth/me", () => {
    // 1. HAPPY PATH
    it("should return user profile when valid bearer access token is provided", async () => {
        await request(app).post("/api/v1/auth/register").send(TEST_USERS.userA);
        const loginRes = await request(app).post("/api/v1/auth/login").send({
            email: TEST_USERS.userA.email,
            password: TEST_USERS.userA.password,
        });

        const accessToken = loginRes.body.data.accessToken;

        const response = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.data.user).toHaveProperty("id");
        expect(response.body.data.user.email).toBe(TEST_USERS.userA.email);
        expect(response.body.data.user.name).toBe(TEST_USERS.userA.name);
        expect(response.body.data.user).not.toHaveProperty("password");
    });

    // 2. SECURITY & AUTHORIZATION FAILURES
    it("should fail when authorization header is missing", async () => {
        const response = await request(app).get("/api/v1/auth/me");

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/unauthorized|token missing/i);
    });

    it("should fail when authorization scheme is not Bearer", async () => {
        const response = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", "Basic some_invalid_base64_string");

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
    });

    it("should fail when access token is malformed or invalid", async () => {
        const response = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", "Bearer invalid_malformed_access_token");

        expect(response.status).toBe(401);
        expect(response.body.status).toBe("fail");
        expect(response.body.message).toMatch(/invalid or expired access token/i);
    });
});