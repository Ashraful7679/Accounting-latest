const { PrismaClient } = require('../dist/generated/client');
const fs = require('fs');
const path = require('path');

const TARGET_URL = "postgresql://orgajyzd_ashraful:alinairin%237679@localhost:5432/orgajyzd_accabiz";

const targetPrisma = new PrismaClient({
  datasources: { db: { url: TARGET_URL } },
});

// Dependency order (Leaf nodes last)
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
  console.log('🎯 Step 2/2: Restoring Data to Namecheap...');
  
  const backupFile = path.join(__dirname, '../backup.json');
  if (!fs.existsSync(backupFile)) {
    console.error('❌ Error: backup.json not found. Run extract-data.js first.');
    process.exit(1);
  }

  const allData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

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

    // 2. RESTORE DATA (Forward order)
    console.log('\n📦 Restoring data...');
    for (const model of MODELS) {
      const accessor = model.charAt(0).toLowerCase() + model.slice(1);
      const data = allData[model] || [];
      console.log(`   - Writing ${model}... (${data.length} records)`);
      
      if (data.length > 0) {
        // Chunking for large datasets
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

    console.log('\n✅ Database Restore Complete!');
  } catch (error) {
    console.error('\n❌ Fatal Error during restoration:', error);
  } finally {
    await targetPrisma.$disconnect();
  }
}

main();
