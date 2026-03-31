const { PrismaClient } = require('../dist/generated/client');
const fs = require('fs');
const path = require('path');

const SOURCE_URL = "postgresql://accabiz_db_user:YXsbrWkwlSSTmmmUbqLaLJbPKJ4OLWan@dpg-d6fgfm5m5p6s73ebp520-a.oregon-postgres.render.com/accabiz_db";

const sourcePrisma = new PrismaClient({
  datasources: { db: { url: SOURCE_URL } },
});

const MODELS = [
  'Currency', 'AccountType', 'User', 'Role', 'UserRole', 'UserPermission', 
  'Company', 'UserCompany', 'CompanySettings', 'Account', 'Branch', 
  'Project', 'CostCenter', 'Customer', 'Vendor', 'Product', 'Employee', 
  'LC', 'PI', 'PILine', 'PurchaseOrder', 'PurchaseOrderLine', 'Invoice', 
  'InvoiceLine', 'JournalEntry', 'JournalEntryLine', 'Bill', 'Payment', 
  'PaymentPI', 'Attachment', 'ActivityLog', 'Notification', 
  'EmployeeAdvance', 'EmployeeLoan', 'EmployeeLoanRepayment', 'EmployeeExpense'
];

async function main() {
  console.log('📡 Step 1/2: Extracting Data from Render...');
  const allData = {};

  try {
    for (const model of MODELS) {
      const accessor = model.charAt(0).toLowerCase() + model.slice(1);
      console.log(`   - Reading ${model}...`);
      const data = await sourcePrisma[accessor].findMany();
      allData[model] = data;
      console.log(`     (Found ${data.length} records)`);
    }

    const backupFile = path.join(__dirname, '../backup.json');
    fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2));
    console.log(`\n✅ Backup saved to ${backupFile}`);
    console.log('🚀 Next Step: Run "node scripts/restore-data.js"');
  } catch (error) {
    console.error('❌ Fatal Error during extraction:', error);
  } finally {
    await sourcePrisma.$disconnect();
  }
}

main();
