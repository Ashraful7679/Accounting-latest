export const demoAccounts = [
  // Assets
  { id: "acc-1", code: "1001", name: "Cash in Hand", accountType: { name: "ASSET", type: "DEBIT" }, currentBalance: 500000, openingBalance: 500000, isActive: true },
  { id: "acc-2", code: "1002", name: "Dutch Bangla Bank Ltd", accountType: { name: "ASSET", type: "DEBIT" }, currentBalance: 2500000, openingBalance: 2500000, isActive: true },
  { id: "acc-3", code: "1201", name: "Accounts Receivable", accountType: { name: "ASSET", type: "DEBIT" }, currentBalance: 1200000, openingBalance: 1000000, isActive: true },
  
  // Liabilities
  { id: "acc-4", code: "2001", name: "Accounts Payable", accountType: { name: "LIABILITY", type: "CREDIT" }, currentBalance: 800000, openingBalance: 800000, isActive: true },
  { id: "acc-5", code: "2101", name: "Bank Loan PV - DBBL", accountType: { name: "LIABILITY", type: "CREDIT" }, currentBalance: 5000000, openingBalance: 5000000, isActive: true },
  
  // Equity
  { id: "acc-6", code: "3001", name: "Capital - Owner A", accountType: { name: "EQUITY", type: "CREDIT" }, currentBalance: 10000000, openingBalance: 10000000, isActive: true },
  
  // Income
  { id: "acc-7", code: "4001", name: "Export Sales (RMG)", accountType: { name: "INCOME", type: "CREDIT" }, currentBalance: 4500000, openingBalance: 0, isActive: true },
  
  // Expenses
  { id: "acc-8", code: "5001", name: "Fabric Purchase", accountType: { name: "EXPENSE", type: "DEBIT" }, currentBalance: 1500000, openingBalance: 0, isActive: true },
  { id: "acc-9", code: "5101", name: "Utility Bill - Gas", accountType: { name: "EXPENSE", type: "DEBIT" }, currentBalance: 85000, openingBalance: 0, isActive: true },
  { id: "acc-10", code: "5201", name: "Salary & Allowances", accountType: { name: "EXPENSE", type: "DEBIT" }, currentBalance: 450000, openingBalance: 0, isActive: true },
];
