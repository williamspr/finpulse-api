import { beforeEach } from 'vitest';
import { prisma } from '../src/config/prisma.js';

beforeEach(async () => {
    // Clear refresh tokens and users before each test
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
});