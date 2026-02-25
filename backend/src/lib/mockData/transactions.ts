import { demoUser } from './company';

export const demoInvoices = [
  {
    id: "inv-1",
    invoiceNumber: "INV-DEMO-001",
    invoiceDate: new Date().toISOString(),
    status: "APPROVED",
    currency: "USD",
    exchangeRate: 110.5,
    subtotal: 5000,
    taxAmount: 0,
    total: 552500, // in BDT
    customer: { name: "Global Garments USA" },
    createdBy: demoUser,
    lines: [
      { id: "inv-l-1", description: "Export Quality Cotton Yarn", quantity: 1000, unitPrice: 50, amount: 5000 }
    ]
  },
  {
    id: "inv-2",
    invoiceNumber: "INV-DEMO-002",
    invoiceDate: new Date().toISOString(),
    status: "PENDING_VERIFICATION",
    currency: "BDT",
    exchangeRate: 1,
    subtotal: 125000,
    taxAmount: 6250,
    total: 131250,
    customer: { name: "Local Textile Ltd" },
    createdBy: demoUser,
    lines: [
      { id: "inv-l-2", description: "Fabric Dying (Blue)", quantity: 5000, unitPrice: 25, amount: 125000 }
    ]
  }
];

export const demoJournals = [
  {
    id: "jr-1",
    entryNumber: "JV-2026-001",
    companyId: "498a49fa-03bb-43c2-ab5b-bb8690eb7a62",
    date: new Date().toISOString(),
    description: "Office Rent for February 2026",
    status: "APPROVED",
    totalDebit: 45000,
    totalCredit: 45000,
    createdBy: demoUser,
    lines: [
      { account: { code: "5202", name: "Rent Expense" }, debit: 45000, credit: 0, description: "Monthly Rent" },
      { account: { code: "1001", name: "Cash in Hand" }, debit: 0, credit: 45000, description: "Paid by Cash" }
    ]
  },
  {
    id: "jr-2",
    entryNumber: "JV-2026-002",
    companyId: "498a49fa-03bb-43c2-ab5b-bb8690eb7a62",
    date: new Date().toISOString(),
    description: "Electricity Bill (Jan)",
    status: "PENDING_APPROVAL",
    totalDebit: 12500,
    totalCredit: 12500,
    createdBy: demoUser,
    lines: [
      { account: { code: "5101", name: "Utility Expense" }, debit: 12500, credit: 0, description: "Electricity Bill" },
      { account: { code: "2001", name: "Accrued Liabilities" }, debit: 0, credit: 12500, description: "Payable" }
    ]
  }
];
