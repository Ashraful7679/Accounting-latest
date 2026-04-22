import { PrismaClient } from '@prisma/client';

import { registerSoftDelete } from './prisma-middleware';

const prisma = new PrismaClient();

// Register Soft Delete & Global Scoping Middleware
registerSoftDelete(prisma);

export { prisma };
export default prisma;
