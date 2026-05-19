import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create roles
  const roles = [
    { name: 'Admin', description: 'System Administrator', isSystem: true, isActive: true },
    { name: 'Owner', description: 'Company Owner', isSystem: true, isActive: true },
    { name: 'Manager', description: 'Manager - can verify', isSystem: true, isActive: true },
    { name: 'Accountant', description: 'Accountant - can create entries', isSystem: true, isActive: true },
    { name: 'User', description: 'Basic user', isSystem: true, isActive: true },
    { name: 'DataEntry', description: 'Data Entry Operator', isSystem: true, isActive: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log('✅ Roles created');

  // Create default role permissions templates
  const ROLE_TEMPLATES = {
    Owner: { canCreate: true, canView: true, canEdit: true, canDelete: true, canVerify: true, canApprove: true, canExport: true, canPrint: true },
    Manager: { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: true, canApprove: true, canExport: true, canPrint: true },
    Accountant: { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: true, canPrint: true },
    DataEntry: { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: true },
    User: { canCreate: false, canView: true, canEdit: false, canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: false },
  };

  const MODULES = [
    'journals', 'invoices', 'bills', 'payments', 'purchase_orders',
    'customers', 'vendors', 'accounts', 'reports', 'employees',
    'lc', 'pi', 'loans', 'products', 'attachments',
    'employee_advances', 'employee_loans', 'employee_expenses',
    'debit_notes', 'credit_notes', 'fixed_assets', 'grn', 'dn', 'payroll',
  ];

  for (const [roleName, perms] of Object.entries(ROLE_TEMPLATES)) {
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (role) {
      for (const module of MODULES) {
        await prisma.rolePermission.upsert({
          where: { roleId_module: { roleId: role.id, module } },
          update: perms,
          create: { roleId: role.id, module, ...perms },
        });
      }
    }
  }
  console.log('✅ Role permission templates created');

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
    throw e;
  })
  .finally(() => prisma.$disconnect());
