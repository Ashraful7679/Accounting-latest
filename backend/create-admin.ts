import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create Admin role if it doesn't exist
  let adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: 'Admin',
        description: 'Administrator role',
      }
    });
    console.log('Created Admin role');
  }

  // Create a default company if none exists
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        code: 'DEFAULT',
        name: 'Default Company',
        address: '123 Business St',
        phone: '+1234567890',
        email: 'info@company.com',
        baseCurrency: 'BDT',
      }
    });
    console.log('Created default company');
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@accounting.com' },
    update: {},
    create: {
      email: 'admin@accounting.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
      forcePasswordReset: false,
      tokenVersion: 0,
      userRoles: {
        create: {
          roleId: adminRole.id,
        }
      },
userCompanies: {
          create: {
            companyId: company.id,
            isDefault: true,
          }
        }
    }
  });

  console.log('Created admin user:', adminUser.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());