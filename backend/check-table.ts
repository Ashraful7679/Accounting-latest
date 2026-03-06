import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRawUnsafe('SELECT * FROM "ActivityLog" LIMIT 1');
    console.log('ActivityLog table exists!', result);
  } catch (err: any) {
    if (err.message.includes('does not exist')) {
        console.log('TABLE DOES NOT EXIST!');
    } else {
        console.error('Other Error:', err.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}
main();
