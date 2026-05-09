export interface FieldInfo {
  function: string;
  procedure?: string;
  impact?: string;
  suggestions?: string[];
}

type FieldDefinitions = Record<string, FieldInfo>;

export const invoiceFieldInfo: FieldDefinitions = {
  customer: {
    function: 'Identifies the customer/buyer who will receive this invoice',
    procedure: 'Select from the list of active customers. If customer is not found, create them first in the Customers module.',
    impact: 'Affects accounts receivable tracking, customer aging reports, and tax reporting. Incorrect customer selection leads to misreported revenue.',
    suggestions: [
      'Verify customer tax ID if applicable for tax compliance',
      'Check customer payment terms and credit limit',
      'Ensure billing address is current'
    ]
  },
  invoiceDate: {
    function: 'The date when the invoice is issued and recorded in the system',
    procedure: 'Defaults to today. Can be backdated for specific business scenarios but should match supporting documents.',
    impact: 'Determines the fiscal period for revenue recognition, tax liability timing, and aging calculations. Affects financial statements accuracy.',
    suggestions: [
      'Must fall within an open accounting period',
      'For tax purposes, use the date of goods/services delivery',
      'Backdating requires proper authorization'
    ]
  },
  dueDate: {
    function: 'The deadline for payment completion',
    procedure: 'Set based on agreed payment terms with customer (e.g., Net 30, Net 60). Can be calculated automatically or manually set.',
    impact: 'Critical for cash flow forecasting, aging reports, and late payment penalty calculations. Affects working capital analysis.',
    suggestions: [
      'Align with customer payment terms agreement',
      'Consider industry standard payment cycles',
      'Set reminders for follow-up before due date'
    ]
  },
  currency: {
    function: 'The monetary unit for the invoice values',
    procedure: 'Select from configured currencies. Must match the currency set for the customer account.',
    impact: 'Affects exchange rate calculations, foreign currency gain/loss, and multi-currency reporting. Requires proper exchange rate setup.',
    suggestions: [
      'Ensure exchange rate is current and accurate',
      'Consider hedging strategies for large foreign transactions',
      'Verify currency matches customer agreement'
    ]
  },
  exchangeRate: {
    function: 'Conversion rate between invoice currency and base currency',
    procedure: 'Automatically populated from latest rate. Manual entry allowed for specific historical dates or negotiated rates.',
    impact: 'Directly affects revenue conversion, exchange gain/loss calculation, and financial statement accuracy in base currency.',
    suggestions: [
      'Use official bank rate or market rate for accuracy',
      'Document any negotiated/special rates',
      'Update rates daily for volatile currencies'
    ]
  },
  quantity: {
    function: 'Number of units of the product/service being billed',
    procedure: 'Enter the actual quantity delivered or services rendered. Must be positive number.',
    impact: 'Multiplied by unit price to calculate line total. Affects revenue recognition and inventory if product is tracked.',
    suggestions: [
      'Verify against delivery notes or service records',
      'Check for quantity discounts or volume bonuses',
      'Ensure UOM matches product specification'
    ]
  },
  unitPrice: {
    function: 'Price per single unit of the product/service',
    procedure: 'Enter the agreed price per unit. Can be pulled from product price list or manually entered for special pricing.',
    impact: 'Directly determines line total and overall invoice amount. Affects revenue, margin calculation, and customer profitability.',
    suggestions: [
      'Verify against price list or sales agreement',
      'Check for applicable discounts or promotions',
      'Consider volume-based pricing tiers'
    ]
  },
  taxRate: {
    function: 'Percentage of tax applied to this line item',
    procedure: 'Select applicable tax rate from configured tax codes. Multiple taxes can be combined.',
    impact: 'Calculates tax amount to be collected and remitted. Incorrect rates lead to under/overpayment of taxes and penalties.',
    suggestions: [
      'Verify tax code matches product/service type',
      'Check for tax exemptions or special rates',
      'Stay updated on tax law changes'
    ]
  },
  description: {
    function: 'Text description of the product/service for documentation',
    procedure: 'Enter clear, descriptive text. For products, auto-populated from product but can be customized.',
    impact: 'Appears on customer invoice, helps with identification. Used in financial reporting and audit trails.',
    suggestions: [
      'Be specific enough for identification and audit',
      'Include relevant details like size, color, model',
      'Keep consistent with product catalog'
    ]
  }
};

export const journalFieldInfo: FieldDefinitions = {
  date: {
    function: 'Effective date of the journal entry',
    procedure: 'Select the date when the transaction occurred. Must be within an open accounting period.',
    impact: 'Determines which fiscal period the transaction affects. Critical for period-end reporting and closing.',
    suggestions: [
      'Must be in an open accounting period',
      'Use transaction date, not entry creation date',
      'For adjustments, use original transaction date'
    ]
  },
  description: {
    function: 'Narrative explaining the purpose of the journal entry',
    procedure: 'Write clear, descriptive text explaining what, why, and who for the transaction.',
    impact: 'Essential for audit trails, financial analysis, and internal controls. Poor descriptions cause audit findings.',
    suggestions: [
      'Include reference to supporting documents',
      'Be specific: "Payment to vendor ABC for invoice #123"',
      'Avoid vague terms like "adjustment" or "miscellaneous"'
    ]
  },
  debit: {
    function: 'Amount to be debited (increased) to the account',
    procedure: 'Enter positive number for debit amount. Must equal total credits for the entry to balance.',
    impact: 'Increases assets or expenses, decreases liabilities or equity. Affects account balance and trial balance.',
    suggestions: [
      'Use standard debit rules: assets ↑, expenses ↑',
      'Ensure debits equal credits for balanced entry',
      'Double-check account type before entering'
    ]
  },
  credit: {
    function: 'Amount to be credited (increased) to the account',
    procedure: 'Enter positive number for credit amount. Must equal total debits for the entry to balance.',
    impact: 'Increases liabilities, equity, or revenue, decreases assets. Affects account balance and trial balance.',
    suggestions: [
      'Use standard credit rules: liabilities ↑, equity ↑, revenue ↑',
      'Ensure credits equal debits for balanced entry',
      'Verify account type before entering'
    ]
  },
  account: {
    function: 'The specific general ledger account to be affected',
    procedure: 'Select from the chart of accounts. Use correct account based on transaction nature.',
    impact: 'Determines which financial statement line item is affected. Wrong account causes misstated reports.',
    suggestions: [
      'Know your chart of accounts structure',
      'Use appropriate detail level for the transaction',
      'Check account balance before posting large amounts'
    ]
  },
  reference: {
    function: 'Document or transaction reference number',
    procedure: 'Enter related document number (invoice, PO, receipt) for traceability.',
    impact: 'Links journal entry to source document for audit trail and reconciliation.',
    suggestions: [
      'Always reference supporting documents',
      'Use consistent reference format',
      'Include supporting document with entry'
    ]
  }
};

export const paymentFieldInfo: FieldDefinitions = {
  amount: {
    function: 'The monetary value of the payment',
    procedure: 'Enter the payment amount. Can be partial or full payment based on invoice status.',
    impact: 'Reduces accounts receivable/payable balance. Affects cash flow and customer/vendor accounting.',
    suggestions: [
      'Verify against invoice due amount',
      'Check for early payment discounts',
      'Consider overpayment scenarios'
    ]
  },
  account: {
    function: 'The bank/cash account from which payment is made',
    procedure: 'Select the appropriate payment method account. Must have sufficient balance.',
    impact: 'Reduces the selected account balance. Important for bank reconciliation.',
    suggestions: [
      'Verify account has sufficient funds',
      'Use designated account per payment method',
      'Consider bank fees for certain accounts'
    ]
  },
  method: {
    function: 'The payment mechanism used (Cash, Check, Bank Transfer, etc.)',
    procedure: 'Select from available payment methods configured in system.',
    impact: 'Affects how transaction is recorded, bank reconciliation process, and audit trail.',
    suggestions: [
      'Match method to actual payment made',
      'Ensure method is allowed per company policy',
      'Record check numbers for check payments'
    ]
  },
  reference: {
    function: 'External reference number (check number, transfer ID, etc.)',
    procedure: 'Enter payment reference from bank statement or received document.',
    impact: 'Critical for bank reconciliation and audit. Links payment to bank record.',
    suggestions: [
      'Use bank transaction reference for electronic payments',
      'Record check number for check payments',
      'Keep reference consistent with bank statement'
    ]
  },
  date: {
    function: 'Date the payment was made/cleared',
    procedure: 'Enter payment date, typically same as bank transaction date.',
    impact: 'Determines the accounting period. Affects cash flow and period reporting.',
    suggestions: [
      'Use actual payment date, not entry creation date',
      'Must be in open accounting period',
      'Match bank statement date for reconciliation'
    ]
  }
};

export const productFieldInfo: FieldDefinitions = {
  code: {
    function: 'Unique identifier for the product',
    procedure: 'Enter a unique code. System auto-generates if left blank based on category.',
    impact: 'Used for all product transactions, inventory tracking, and reporting. Must be unique per company.',
    suggestions: [
      'Use consistent coding format (e.g., PREFIX-001)',
      'Avoid similar codes that cause confusion',
      'Consider barcode/QR code compatibility'
    ]
  },
  name: {
    function: 'Descriptive name of the product',
    procedure: 'Enter clear, searchable product name. Can include brand, size, color, model.',
    impact: 'Used in invoices, reports, and searches. Should be descriptive enough for identification.',
    suggestions: [
      'Use standardized naming convention',
      'Include key identifying attributes',
      'Keep consistent with supplier product names'
    ]
  },
  category: {
    function: 'Classification group for the product',
    procedure: 'Select from predefined product categories. Affects reporting and categorization.',
    impact: 'Used in financial reports, inventory analysis, and sales breakdown by category.',
    suggestions: [
      'Align with company reporting requirements',
      'Use consistent categories across all products',
      'Consider tax treatment per category'
    ]
  },
  unitPrice: {
    function: 'Selling price per unit',
    procedure: 'Enter the sales price. Can be overridden per transaction or customer.',
    impact: 'Determines revenue and margin. Affects pricing strategies and customer profitability.',
    suggestions: [
      'Consider cost, markup, and market price',
      'Set volume discount tiers if applicable',
      'Review pricing regularly against competitors'
    ]
  },
  costPrice: {
    function: 'Purchase/inventory cost per unit',
    procedure: 'Enter the cost from supplier. Used for margin calculation and inventory valuation.',
    impact: 'Affects gross profit calculation, inventory valuation, and pricing decisions.',
    suggestions: [
      'Update with each supplier price change',
      'Consider landed cost for imported goods',
      'Track price trends for negotiation'
    ]
  },
  stockAmount: {
    function: 'Current quantity in inventory',
    procedure: 'System tracks automatically. Can be manually adjusted for discrepancies.',
    impact: 'Determines availability for sales, affects reorder decisions, and inventory valuation.',
    suggestions: [
      'Conduct regular physical inventory counts',
      'Set reorder points and alerts',
      'Track slow-moving items'
    ]
  },
  unit: {
    function: 'Unit of measure (pcs, kg, box, etc.)',
    procedure: 'Select from configured units of measure. Must be consistent with purchases and sales.',
    impact: 'Used in all quantity calculations. Inconsistent units cause calculation errors.',
    suggestions: [
      'Standardize across the company',
      'Use industry-standard units where applicable',
      'Consider conversion factors for bulk orders'
    ]
  }
};

export const employeeFieldInfo: FieldDefinitions = {
  firstName: {
    function: 'Employee given name',
    procedure: 'Enter as per legal documents. Used for all official communications.',
    impact: 'Appears on payslips, reports, and legal documents. Should match ID documents.',
    suggestions: [
      'Match legal documents exactly',
      'Use proper spelling and capitalization',
      'Consider nickname policy'
    ]
  },
  lastName: {
    function: 'Employee family name',
    procedure: 'Enter as per legal documents. Critical for legal and tax compliance.',
    impact: 'Used in tax filings, legal documents, and HR records. Must be accurate.',
    suggestions: [
      'Match legal documents exactly',
      'Consider surname conventions',
      'Document any name changes'
    ]
  },
  email: {
    function: 'Company email address for communication',
    procedure: 'Enter official company email. Must be unique in system.',
    impact: 'Used for system login, notifications, and official communications.',
    suggestions: [
      'Use company email domain',
      'Ensure email is active and monitored',
      'Set up email forwarding if needed'
    ]
  },
  phone: {
    function: 'Contact phone number',
    procedure: 'Enter active contact number. Include country code for mobile.',
    impact: 'Used for emergency contacts, payroll alerts, and HR communications.',
    suggestions: [
      'Provide mobile number for SMS alerts',
      'Keep updated for emergency contact',
      'Consider WhatsApp for company communications'
    ]
  },
  designation: {
    function: 'Job title/position in the organization',
    procedure: 'Select from predefined positions or enter custom title.',
    impact: 'Affects payroll setup, reporting structure, and HR analytics.',
    suggestions: [
      'Match official job title',
      'Use consistent titles across departments',
      'Consider career progression titles'
    ]
  },
  department: {
    function: 'Organizational department/team',
    procedure: 'Select from company departments. Affects cost allocation and reporting.',
    impact: 'Used for cost center tracking, reporting, and organizational analysis.',
    suggestions: [
      'Match organizational structure',
      'Consider department-specific policies',
      'Use for headcount reporting'
    ]
  },
  salary: {
    function: 'Monthly/annual compensation amount',
    procedure: 'Enter gross salary as per employment contract. Update for changes.',
    impact: 'Affects payroll calculations, tax deductions, and financial forecasting.',
    suggestions: [
      'Enter gross amount before deductions',
      'Keep documentation of salary changes',
      'Review annually per policy'
    ]
  },
  joinDate: {
    function: 'Date of employment start',
    procedure: 'Enter first working day. Affects probation, benefits, and leave accrual.',
    impact: 'Determines service period, benefits eligibility, and leave accrual.',
    suggestions: [
      'Use actual start date',
      'Update for rejoiners with previous service',
      'Consider probation period calculation'
    ]
  }
};

export const accountFieldInfo: FieldDefinitions = {
  code: {
    function: 'Unique account code in chart of accounts',
    procedure: 'Enter unique code. Auto-generated based on account type if not provided.',
    impact: 'Used for all transactions. Forms basis of financial reporting structure.',
    suggestions: [
      'Follow standardized coding system',
      'Keep codes consistent with accounting standards',
      'Reserve ranges for future account types'
    ]
  },
  name: {
    function: 'Descriptive account name',
    procedure: 'Enter clear, descriptive name that identifies the account purpose.',
    impact: 'Used in financial statements and transaction selection. Should be self-explanatory.',
    suggestions: [
      'Use descriptive but concise names',
      'Avoid ambiguous abbreviations',
      'Keep consistent with chart of accounts standard'
    ]
  },
  accountType: {
    function: 'Classification (Asset, Liability, Equity, Income, Expense)',
    procedure: 'Select from predefined account types. Determines financial statement presentation.',
    impact: 'Critical for correct financial statement classification and accounting equation.',
    suggestions: [
      'Understand impact on financial statements',
      'Consider tax treatment by type',
      'Follow accounting standards classification'
    ]
  },
  openingBalance: {
    function: 'Initial balance when account is created',
    procedure: 'Enter balance from previous system or as of go-live date.',
    impact: 'Forms the starting point for all future transactions. Affects beginning balances.',
    suggestions: [
      'Verify from previous accounting records',
      'Balance against trial balance',
      'Document source of opening balance'
    ]
  },
  category: {
    function: 'Sub-classification (Cash, Bank, AR, AP, etc.)',
    procedure: 'Select appropriate category for reporting and controls.',
    impact: 'Used in cash flow reporting, aging analysis, and special handling.',
    suggestions: [
      'Match business requirements for reporting',
      'Set up appropriate controls by category',
      'Use for receivable/payable aging'
    ]
  },
  cashFlowType: {
    function: 'Classification for cash flow statement',
    procedure: 'Select Operating, Investing, or Financing activity type.',
    impact: 'Directly affects cash flow statement presentation and analysis.',
    suggestions: [
      'Understand cash flow statement structure',
      'Consider actual cash movement type',
      'Review for correct classification'
    ]
  }
};