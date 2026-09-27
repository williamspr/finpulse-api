import { beforeEach, afterEach, afterAll } from 'vitest';
import { prisma } from '../src/config/prisma.js';

const cleanDatabase = async () => {
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