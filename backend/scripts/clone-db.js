const { PrismaClient } = require('../dist/generated/client');

const SOURCE_URL = "postgresql://accabiz_db_user:YXsbrWkwlSSTmmmUbqLaLJbPKJ4OLWan@dpg-d6fgfm5m5p6s73ebp520-a.oregon-postgres.render.com/accabiz_db";
const TARGET_URL = "postgresql://orgajyzd_ashraful:alinairin%237679@localhost:5432/orgajyzd_accabiz";

const sourcePrisma = new PrismaClient({
  datasources: { db: { url: SOURCE_URL } },
});

const targetPrisma = new PrismaClient({
  datasources: { db: { url: TARGET_URL } },
});

// Dependency order (Leaf nodes last)
const MODELS = [
  'Currency',
  'AccountType',
  'User',
  'Role',
  'UserRole',
  'UserPermission',
  'Company',
  'UserCompany',
  'CompanySettings',
  'Account',
  'Branch',
  'Project',
  'CostCenter',
  'Customer',
  'Vendor',
  'Product',
  'Employee',
  'LC',
  'PI',
  'PILine',
  'PurchaseOrder',
  'PurchaseOrderLine',
  'Invoice',
  'InvoiceLine',
  'JournalEntry',
  'JournalEntryLine',
  'Bill',
  'Payment',
  'PaymentPI',
  'Attachment',
  'ActivityLog',
  'Notification',
  'EmployeeAdvance',
  'EmployeeLoan',
  'EmployeeLoanRepayment',
  'EmployeeExpense'
];

async function main() {
  console.log('🚀 Starting Database Clone (Node.js Version)...');

  try {
    // 1. WIPE TARGET (Reverse order)
    console.log('\n🧹 Wiping target database...');
    for (const model of [...MODELS].reverse()) {
      const accessor = model.charAt(0).toLowerCase() + model.slice(1);
      console.log(`   - Clearing ${model}...`);
      try {
        await targetPrisma[accessor].deleteMany({});
      } catch (e) {
        console.warn(`   ⚠️ Warning clearing ${model}: ${e.message}`);
      }
    }

    // 2. CLONE DATA (Forward order)
    console.log('\n📦 Cloning data...');
    for (const model of MODELS) {
      const accessor = model.charAt(0).toLowerCase() + model.slice(1);
      console.log(`   - Copying ${model}...`);
      
      const data = await sourcePrisma[accessor].findMany();
      console.log(`     (Found ${data.length} records)`);
      
      if (data.length > 0) {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          await targetPrisma[accessor].createMany({
            data: chunk,
            skipDuplicates: true,
          });
        }
      }
    }

    console.log('\n✅ Database Clone Complete!');
  } catch (error) {
    console.error('\n❌ Fatal Error during clone:', error);
  } finally {
    await sourcePrisma.$disconnect();
    await targetPrisma.$disconnect();
  }
}

main();
