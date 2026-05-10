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
      ]},
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET', category: 'AR_PARENT', children: [
        { code: '1201', name: 'Trade Debtors', type: 'ASSET', category: 'AR' },
        { code: '1202', name: 'Other Receivables', type: 'ASSET' },
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
      ]},
    ]},
    { code: '2000', name: 'LIABILITIES', type: 'LIABILITY', children: [
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', category: 'AP_PARENT', children: [
        { code: '2101', name: 'Trade Creditors', type: 'LIABILITY', category: 'AP' },
      ]},
      { code: '2200', name: 'Accrued Liabilities', type: 'LIABILITY', children: [
        { code: '2201', name: 'Salaries Payable', type: 'LIABILITY', category: 'PAYABLE_PARENT' },
        { code: '2202', name: 'Utilities Payable', type: 'LIABILITY' },
      ]},
      { code: '2300', name: 'Tax Payables', type: 'LIABILITY', children: [
        { code: '2301', name: 'VAT/GST Payable', type: 'LIABILITY' },
        { code: '2302', name: 'Withholding Tax Payable', type: 'LIABILITY' },
      ]},
    ]},
    { code: '3000', name: 'EQUITY', type: 'EQUITY', children: [
      { code: '3100', name: 'Owner Capital', type: 'EQUITY' },
      { code: '3200', name: 'Retained Earnings', type: 'EQUITY' },
      { code: '3300', name: 'Current Year Earnings', type: 'EQUITY' },
    ]},
    { code: '4000', name: 'INCOME', type: 'INCOME', children: [
      { code: '4100', name: 'Sales Revenue', type: 'INCOME' },
      { code: '4200', name: 'Service Revenue', type: 'INCOME' },
      { code: '4900', name: 'Other Income', type: 'INCOME' },
    ]},
    { code: '5000', name: 'EXPENSES', type: 'EXPENSE', children: [
      { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE' },
      { code: '5200', name: 'Operating Expenses', type: 'EXPENSE', category: 'EXPENSE', children: [
        { code: '5201', name: 'Salaries & Wages', type: 'EXPENSE' },
        { code: '5202', name: 'Rent & Rates', type: 'EXPENSE' },
        { code: '5203', name: 'Electricity & Water', type: 'EXPENSE' },
        { code: '5204', name: 'Internet & Communication', type: 'EXPENSE' },
      ]},
      { code: '5300', name: 'Financial Expenses', type: 'EXPENSE', children: [
        { code: '5301', name: 'Bank Charges', type: 'EXPENSE' },
        { code: '5302', name: 'Interest Paid', type: 'EXPENSE' },
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
      { code: '5300', name: 'Factory Overheads', type: 'EXPENSE' },
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
  ]
};
