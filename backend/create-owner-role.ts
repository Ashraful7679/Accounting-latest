import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create Owner role if it doesn't exist
  let ownerRole = await prisma.role.findUnique({ where: { name: 'Owner' } });
  if (!ownerRole) {
    ownerRole = await prisma.role.create({
      data: {
        name: 'Owner',
        description: 'Company owner/primary user role',
      }
    });
    console.log('Created Owner role');
  } else {
    console.log('Owner role already exists');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());