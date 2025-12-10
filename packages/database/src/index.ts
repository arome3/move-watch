import { PrismaClient } from '../generated/prisma';

// Export the Prisma client instance
export { PrismaClient };

// Export all generated types
export * from '../generated/prisma';

// Create a singleton instance for the Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
