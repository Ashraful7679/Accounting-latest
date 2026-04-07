import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';

async function generateSeed() {
  let sql = `-- Seed Data\n`;
  
  // Roles
  const roles = [
    { name: 'Admin', description: 'System Administrator', isSystem: true },
    { name: 'Owner', description: 'Company Owner', isSystem: true },
    { name: 'Manager', description: 'Manager - can verify', isSystem: true },
    { name: 'Accountant', description: 'Accountant - can create entries', isSystem: true },
    { name: 'User', description: 'Basic user', isSystem: true },
  ];
  
  roles.forEach((r, i) => {
    sql += `INSERT INTO "Role" ("id", "name", "description", "isSystem", "createdAt", "updatedAt") VALUES ('role_${i}', '${r.name}', '${r.description}', ${r.isSystem}, NOW(), NOW()) ON CONFLICT ("name") DO NOTHING;\n`;
  });

  // Currencies
  const currencies = [
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  ];
  currencies.forEach((c, i) => {
    sql += `INSERT INTO "Currency" ("id", "code", "name", "symbol", "isActive", "createdAt", "updatedAt") VALUES ('curr_${i}', '${c.code}', '${c.name}', '${c.symbol}', true, NOW(), NOW()) ON CONFLICT ("code") DO NOTHING;\n`;
  });

  // Admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  sql += `INSERT INTO "User" ("id", "email", "password", "firstName", "lastName", "isActive", "maxCompanies", "createdAt", "updatedAt") VALUES ('usr_admin', 'admin@accounting.com', '${adminPassword}', 'Admin', 'User', true, 100, NOW(), NOW()) ON CONFLICT ("email") DO NOTHING;\n`;

  // Admin Role mapping
  sql += `INSERT INTO "UserRole" ("id", "userId", "roleId") VALUES ('ur_admin', 'usr_admin', 'role_0') ON CONFLICT ("userId", "roleId") DO NOTHING;\n`;

  // Account Types
  const accountTypes = [
    { name: 'ASSET', type: 'DEBIT' },
    { name: 'LIABILITY', type: 'CREDIT' },
    { name: 'EQUITY', type: 'CREDIT' },
    { name: 'INCOME', type: 'CREDIT' },
    { name: 'EXPENSE', type: 'DEBIT' },
  ];
  accountTypes.forEach((at, i) => {
    sql += `INSERT INTO "AccountType" ("id", "name", "type") VALUES ('at_${i}', '${at.name}', '${at.type}') ON CONFLICT ("name") DO NOTHING;\n`;
  });

  fs.writeFileSync('seed.sql', sql);
  console.log('Generated seed.sql');
}

generateSeed();
