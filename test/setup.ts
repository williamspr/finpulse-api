import { beforeEach, afterEach, afterAll } from 'vitest';
import { prisma } from '../src/config/prisma.js';

const cleanDatabase = async () => {
    await prisma.wallet.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
};

beforeEach(async () => {
    await cleanDatabase();
});

afterEach(async () => {
    await cleanDatabase();
});

afterAll(async () => {
    await prisma.$disconnect();
});