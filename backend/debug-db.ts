import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });
  
  console.log('--- USERS IN DATABASE ---');
  users.forEach(u => {
    console.log(`Email: ${u.email}`);
    console.log(`Roles: ${u.userRoles.map(ur => ur.role.name).join(', ')}`);
    console.log('------------------------');
  });
}

main().finally(() => prisma.$disconnect());
