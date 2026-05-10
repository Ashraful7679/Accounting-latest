export interface CoaAccountTemplate {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  cashFlowType?: 'OPERATING' | 'INVESTING' | 'FINANCING';
  category?: string;
  children?: CoaAccountTemplate[];
}

export const COA_TEMPLATES: Record<string, CoaAccountTemplate[]> = {
  GENERAL: [
    { code: '1000', name: 'ASSETS', type: 'ASSET', children: [
      { code: '1100', name: 'Cash & Bank', type: 'ASSET', category: 'CASH', children: [
        { code: '1101', name: 'Cash on Hand', type: 'ASSET', category: 'CASH' },
        { code: '1102', name: 'Main Bank Account', type: 'ASSET', category: 'CASH' },
        { code: '1103', name: 'Petty Cash', type: 'ASSET', category: 'CASH' },
        { code: '1104', name: 'Mobile Banking (Bkash/Nagad)', type: 'ASSET', category: 'CASH' },
        { code: '1105', name: 'Credit Card Settlements', type: 'ASSET', category: 'CASH' },
      ]},
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET', category: 'AR_PARENT', children: [
        { code: '1201', name: 'Trade Debtors', type: 'ASSET', category: 'AR' },
        { code: '1202', name: 'Other Receivables', type: 'ASSET' },
        { code: '1203', name: 'Allowance for Doubtful Debts', type: 'ASSET' },
      ]},
      { code: '1300', name: 'Fixed Assets', type: 'ASSET', children: [
        { code: '1301', name: 'Office Equipment', type: 'ASSET' },
        { code: '1302', name: 'Furniture & Fixtures', type: 'ASSET' },
        { code: '1303', name: 'Motor Vehicles', type: 'ASSET' },
        { code: '1399', name: 'Accumulated Depreciation', type: 'ASSET' },
      ]},
      { code: '1400', name: 'Prepayments & Deposits', type: 'ASSET', children: [
        { code: '1401', name: 'Prepaid Rent', type: 'ASSET' },
        { code: '1402', name: 'Security Deposits', type: 'ASSET' },
        { code: '1403', name: 'Advance Tax (AIT)', type: 'ASSET' },
      ]},
      { code: '1500', name: 'Other Assets', type: 'ASSET', children: [
        { code: '1501', name: 'Suspense Account', type: 'ASSET' },
      ]},
    ]},
    { code: '2000', name: 'LIABILITIES', type: 'LIABILITY', children: [
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', category: 'AP_PARENT', children: [
        { code: '2101', name: 'Trade Creditors', type: 'LIABILITY', category: 'AP' },
        { code: '2102', name: 'Other Payables', type: 'LIABILITY' },
      ]},
      { code: '2200', name: 'Accrued Liabilities', type: 'LIABILITY', children: [
        { code: '2201', name: 'Salaries Payable', type: 'LIABILITY', category: 'PAYABLE_PARENT' },
        { code: '2202', name: 'Utilities Payable', type: 'LIABILITY' },
        { code: '2203', name: 'Audit Fees Payable', type: 'LIABILITY' },
      ]},
      { code: '2300', name: 'Tax Payables', type: 'LIABILITY', children: [
        { code: '2301', name: 'VAT/GST Payable', type: 'LIABILITY' },
        { code: '2302', name: 'VDS (VAT Deducted at Source)', type: 'LIABILITY' },
        { code: '2303', name: 'TDS (Tax Deducted at Source)', type: 'LIABILITY' },
        { code: '2304', name: 'Income Tax Provision', type: 'LIABILITY' },
      ]},
      { code: '2400', name: 'Short Term Loans', type: 'LIABILITY', children: [
        { code: '2401', name: 'Bank Overdraft', type: 'LIABILITY' },
        { code: '2402', name: 'Directors Loan', type: 'LIABILITY' },
      ]},
    ]},
    { code: '3000', name: 'EQUITY', type: 'EQUITY', children: [
      { code: '3100', name: 'Owner Capital', type: 'EQUITY' },
      { code: '3200', name: 'Retained Earnings', type: 'EQUITY' },
      { code: '3300', name: 'Current Year Earnings', type: 'EQUITY' },
      { code: '3400', name: 'Dividends Paid', type: 'EQUITY' },
    ]},
    { code: '4000', name: 'INCOME', type: 'INCOME', children: [
      { code: '4100', name: 'Sales Revenue', type: 'INCOME' },
      { code: '4200', name: 'Service Revenue', type: 'INCOME' },
      { code: '4300', name: 'Other Income', type: 'INCOME', children: [
        { code: '4301', name: 'Interest Income', type: 'INCOME' },
        { code: '4302', name: 'Exchange Gain', type: 'INCOME' },
        { code: '4303', name: 'Commission Income', type: 'INCOME' },
      ]},
    ]},
    { code: '5000', name: 'EXPENSES', type: 'EXPENSE', children: [
      { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE' },
      { code: '5200', name: 'Operating Expenses', type: 'EXPENSE', category: 'EXPENSE', children: [
        { code: '5201', name: 'Salaries & Wages', type: 'EXPENSE' },
        { code: '5202', name: 'Rent & Rates', type: 'EXPENSE' },
        { code: '5203', name: 'Electricity & Water', type: 'EXPENSE' },
        { code: '5204', name: 'Internet & Communication', type: 'EXPENSE' },
        { code: '5205', name: 'Printing & Stationery', type: 'EXPENSE' },
        { code: '5206', name: 'Travel & Conveyance', type: 'EXPENSE' },
        { code: '5207', name: 'Entertainment', type: 'EXPENSE' },
        { code: '5208', name: 'Repairs & Maintenance', type: 'EXPENSE' },
        { code: '5209', name: 'Insurance', type: 'EXPENSE' },
      ]},
      { code: '5300', name: 'Financial & Other Expenses', type: 'EXPENSE', children: [
        { code: '5301', name: 'Bank Charges', type: 'EXPENSE' },
        { code: '5302', name: 'Interest Paid', type: 'EXPENSE' },
        { code: '5303', name: 'Exchange Loss', type: 'EXPENSE' },
        { code: '5304', name: 'Bad Debts Expense', type: 'EXPENSE' },
      ]},
      { code: '5400', name: 'Depreciation Expense', type: 'EXPENSE', category: 'EXPENSE' },
    ]},
  ],
  MANUFACTURING: [
    { code: '1000', name: 'ASSETS', type: 'ASSET', children: [
      { code: '1400', name: 'Inventory', type: 'ASSET', children: [
        { code: '1401', name: 'Raw Materials', type: 'ASSET' },
        { code: '1402', name: 'Work in Progress', type: 'ASSET' },
        { code: '1403', name: 'Finished Goods', type: 'ASSET' },
        { code: '1404', name: 'Factory Supplies', type: 'ASSET' },
      ]},
      { code: '1500', name: 'Plant & Machinery', type: 'ASSET', children: [
        { code: '1501', name: 'Factory Machines', type: 'ASSET' },
        { code: '1599', name: 'Accumulated Depreciation - Machinery', type: 'ASSET' },
      ]},
    ]},
    { code: '5000', name: 'Manufacturing Costs', type: 'EXPENSE', children: [
      { code: '5100', name: 'Direct Material Cost', type: 'EXPENSE' },
      { code: '5200', name: 'Direct Labor', type: 'EXPENSE' },
      { code: '5300', name: 'Factory Overheads', type: 'EXPENSE', children: [
        { code: '5301', name: 'Factory Rent', type: 'EXPENSE' },
        { code: '5302', name: 'Factory Power & Fuel', type: 'EXPENSE' },
        { code: '5303', name: 'Machine Maintenance', type: 'EXPENSE' },
      ]},
    ]},
  ],
  TRADING: [
    { code: '1000', name: 'ASSETS', type: 'ASSET', children: [
      { code: '1300', name: 'Trade Related Assets', type: 'ASSET', children: [
        { code: '1310', name: 'LC Margin Deposits', type: 'ASSET' },
        { code: '1320', name: 'Inventory in Transit (Import)', type: 'ASSET' },
      ]},
      { code: '1400', name: 'Inventory for Resale', type: 'ASSET' },
    ]},
    { code: '4000', name: 'Trading Income', type: 'INCOME', children: [
      { code: '4100', name: 'Product Sales - Local', type: 'INCOME' },
      { code: '4200', name: 'Product Sales - Export', type: 'INCOME' },
    ]},
    { code: '5000', name: 'Trading Expenses', type: 'EXPENSE', children: [
      { code: '5100', name: 'Purchase Cost - Local', type: 'EXPENSE' },
      { code: '5200', name: 'Purchase Cost - Import', type: 'EXPENSE' },
      { code: '5300', name: 'Freight & Clearing', type: 'EXPENSE' },
      { code: '5400', name: 'Import Duties', type: 'EXPENSE' },
    ]},
  ],
  SERVICE: [
    { code: '4000', name: 'Service Income', type: 'INCOME', children: [
      { code: '4100', name: 'Consulting Revenue', type: 'INCOME' },
      { code: '4200', name: 'Maintenance Revenue', type: 'INCOME' },
      { code: '4300', name: 'Training Revenue', type: 'INCOME' },
    ]},
    { code: '5000', name: 'Direct Service Costs', type: 'EXPENSE', children: [
      { code: '5100', name: 'Contractor Fees', type: 'EXPENSE' },
      { code: '5200', name: 'Service Travel', type: 'EXPENSE' },
      { code: '5300', name: 'Software Licenses', type: 'EXPENSE' },
    ]},
  ]
};
