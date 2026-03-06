import { config } from 'dotenv';
config();
import prisma from './src/config/database';

async function main() {
  try {
    const activities = await prisma.activityLog.findMany({
      take: 1,
      select: {
          id: true,
          companyId: true,
          entityType: true,
          entityId: true,
          action: true,
          metadata: true,
          createdAt: true,
          performedBy: { select: { id: true, firstName: true, lastName: true } },
          targetUser: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    console.log('Success!', activities);
  } catch (err) {
    console.error('Prisma Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
