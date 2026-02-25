import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create roles
  const roles = [
    { name: 'Admin', description: 'System Administrator', isSystem: true },
    { name: 'Owner', description: 'Company Owner', isSystem: true },
    { name: 'Manager', description: 'Manager - can verify', isSystem: true },
    { name: 'Accountant', description: 'Accountant - can create entries', isSystem: true },
    { name: 'User', description: 'Basic user', isSystem: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log('✅ Roles created');

  // Create default currencies
  const currencies = [
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {},
      create: currency,
    });
  }
  console.log('✅ Currencies created');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@accounting.com' },
    update: {},
    create: {
      email: 'admin@accounting.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
      maxCompanies: 100,
    },
  });

  // Assign Admin role
  const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
  }
  console.log('✅ Admin user created');

  // Create default account types
  const accountTypes = [
    { name: 'ASSET', type: 'DEBIT' },
    { name: 'LIABILITY', type: 'CREDIT' },
    { name: 'EQUITY', type: 'CREDIT' },
    { name: 'INCOME', type: 'CREDIT' },
    { name: 'EXPENSE', type: 'DEBIT' },
  ];

  for (const at of accountTypes) {
    await prisma.accountType.create({
      data: at,
    }).catch(() => {});
  }
  console.log('✅ Account types created');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
