import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function testDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL connected successfully via Prisma');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to database via Prisma:', error);
    return false;
  }
}
