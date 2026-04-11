const fs = require('fs');
const path = 'prisma/schema.prisma';

const append = `

// ============================================
// COMPANY SETTINGS (Phase 13)
// ============================================

model CompanySettings {
  id                    String   @id @default(uuid())
  companyId             String   @unique
  company               Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Fiscal & Period Controls
  fiscalYearStart       Int      @default(1)
  lockPreviousMonths    Boolean  @default(false)
  lockedBeforeDate      DateTime?
  disallowFutureDates   Boolean  @default(false)

  // Workflow Controls
  approvalWorkflow      Boolean  @default(true)
  requireVerification   Boolean  @default(true)
  autoPostJournals      Boolean  @default(true)

  // Display & Defaults
  defaultCurrency       String   @default("BDT")
  dateFormat            String   @default("DD/MM/YYYY")
  decimalPlaces         Int      @default(2)

  // Tax & VAT (Bangladesh)
  enableVAT             Boolean  @default(false)
  defaultVATRate        Float    @default(15)
  vatRegistrationNumber String?
  tin                   String?

  // Alert Preferences
  alertOverdueInvoices  Boolean  @default(true)
  alertLCExpiry         Boolean  @default(true)
  alertLoanDue          Boolean  @default(true)
  lcExpiryAlertDays     Int      @default(7)
  loanDueAlertDays      Int      @default(30)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
`;

fs.appendFileSync(path, append, 'utf8');
const lines = fs.readFileSync(path, 'utf8').split('\n').length;
console.log('Schema appended OK. Total lines:', lines);
