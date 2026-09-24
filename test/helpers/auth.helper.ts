import request from 'supertest';
import app from '../../src/app.js';

export const TEST_USERS = {
    userA: {
        name: 'User Alpha',
        email: 'alpha@example.com',
        password: 'Password123!'
    },
    userB: {
        name: 'User Beta',
        email: 'beta@example.com',
        password: 'Password123!'
    }
};

export const getAccessToken = async (customUser?: { name: string; email: string; password: string }): Promise<string> => {
    const uniqueId = Date.now() + Math.random().toString(36).substring(2, 7);

    const userPayload = customUser || {
        name: 'Test User',
        email: `test_${uniqueId}@example.com`,
        password: 'SecretPassword123'
    };

    await request(app).post('/api/v1/auth/register').send(userPayload);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: userPayload.email,
        password: userPayload.password,
    });

    if (!loginRes.body?.data?.accessToken) {
        throw new Error(`Failed to get access token from helper: ${JSON.stringify(loginRes.body)}`);
    }

    return loginRes.body.data.accessToken;
};