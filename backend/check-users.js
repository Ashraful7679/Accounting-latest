const prisma = require('./src/config/database');

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, isActive: true },
    take: 5
  });
  console.log('Users found:', users.length);
  console.log(users);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());