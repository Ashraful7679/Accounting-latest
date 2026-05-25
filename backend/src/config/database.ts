import { PrismaClient } from '@prisma/client';

import { registerSoftDelete } from './prisma-middleware';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

registerSoftDelete(prisma);

export { prisma };
export default prisma;
