
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  firstName: 'firstName',
  lastName: 'lastName',
  isActive: 'isActive',
  maxCompanies: 'maxCompanies',
  phone: 'phone',
  address: 'address',
  managerId: 'managerId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  isSystem: 'isSystem',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserRoleScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  roleId: 'roleId'
};

exports.Prisma.UserPermissionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  module: 'module',
  canCreate: 'canCreate',
  canView: 'canView',
  canVerify: 'canVerify',
  canApprove: 'canApprove'
};

exports.Prisma.CompanyScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  logoUrl: 'logoUrl',
  address: 'address',
  city: 'city',
  country: 'country',
  phone: 'phone',
  email: 'email',
  website: 'website',
  baseCurrency: 'baseCurrency',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserCompanyScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  companyId: 'companyId',
  isDefault: 'isDefault',
  ownershipPercentage: 'ownershipPercentage',
  isMainOwner: 'isMainOwner',
  canEditCompany: 'canEditCompany',
  canDeleteCompany: 'canDeleteCompany',
  canManageOwners: 'canManageOwners',
  fatherMotherName: 'fatherMotherName',
  nidPassport: 'nidPassport',
  mobile: 'mobile',
  permanentAddress: 'permanentAddress',
  ownershipType: 'ownershipType',
  joiningDate: 'joiningDate',
  openingCapital: 'openingCapital',
  capitalAccountCode: 'capitalAccountCode',
  drawingAccountCode: 'drawingAccountCode',
  currentCapitalBalance: 'currentCapitalBalance',
  tin: 'tin',
  tinCertificateUrl: 'tinCertificateUrl',
  din: 'din'
};

exports.Prisma.LCScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  lcNumber: 'lcNumber',
  bankName: 'bankName',
  amount: 'amount',
  currency: 'currency',
  conversionRate: 'conversionRate',
  issueDate: 'issueDate',
  expiryDate: 'expiryDate',
  status: 'status',
  type: 'type',
  description: 'description',
  loanType: 'loanType',
  loanValue: 'loanValue',
  marginPercentage: 'marginPercentage',
  commissionRate: 'commissionRate',
  shipmentDate: 'shipmentDate',
  portOfLoading: 'portOfLoading',
  portOfDestination: 'portOfDestination',
  vesselName: 'vesselName',
  bankBranch: 'bankBranch',
  customerId: 'customerId',
  vendorId: 'vendorId',
  receivedDate: 'receivedDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PIScalarFieldEnum = {
  id: 'id',
  piNumber: 'piNumber',
  lcId: 'lcId',
  piDate: 'piDate',
  amount: 'amount',
  currency: 'currency',
  exchangeRate: 'exchangeRate',
  totalBDT: 'totalBDT',
  status: 'status',
  invoiceNumber: 'invoiceNumber',
  submissionToBuyerDate: 'submissionToBuyerDate',
  submissionToBankDate: 'submissionToBankDate',
  bankAcceptanceDate: 'bankAcceptanceDate',
  maturityDate: 'maturityDate',
  purchaseApplicationDate: 'purchaseApplicationDate',
  purchaseAmount: 'purchaseAmount',
  idbpNumber: 'idbpNumber',
  companyId: 'companyId',
  customerId: 'customerId',
  vendorId: 'vendorId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PILineScalarFieldEnum = {
  id: 'id',
  piId: 'piId',
  productId: 'productId',
  description: 'description',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  total: 'total'
};

exports.Prisma.LoanScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  loanNumber: 'loanNumber',
  bankName: 'bankName',
  principalAmount: 'principalAmount',
  interestRate: 'interestRate',
  repaymentTerm: 'repaymentTerm',
  monthlyInstallment: 'monthlyInstallment',
  outstandingBalance: 'outstandingBalance',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccountTypeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  isActive: 'isActive'
};

exports.Prisma.AccountScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  companyId: 'companyId',
  accountTypeId: 'accountTypeId',
  parentId: 'parentId',
  isActive: 'isActive',
  openingBalance: 'openingBalance',
  currentBalance: 'currentBalance',
  cashFlowType: 'cashFlowType',
  allowNegative: 'allowNegative',
  category: 'category',
  referenceId: 'referenceId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BranchScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  companyId: 'companyId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  companyId: 'companyId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CostCenterScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  companyId: 'companyId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CustomerScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  companyId: 'companyId',
  email: 'email',
  phone: 'phone',
  address: 'address',
  city: 'city',
  country: 'country',
  isActive: 'isActive',
  contactPerson: 'contactPerson',
  tinVat: 'tinVat',
  openingBalance: 'openingBalance',
  balanceType: 'balanceType',
  creditLimit: 'creditLimit',
  preferredCurrency: 'preferredCurrency',
  exchangeRate: 'exchangeRate',
  paymentTerms: 'paymentTerms',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VendorScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  companyId: 'companyId',
  country: 'country',
  email: 'email',
  phone: 'phone',
  address: 'address',
  city: 'city',
  isActive: 'isActive',
  contactPerson: 'contactPerson',
  tinVat: 'tinVat',
  openingBalance: 'openingBalance',
  balanceType: 'balanceType',
  creditLimit: 'creditLimit',
  preferredCurrency: 'preferredCurrency',
  exchangeRate: 'exchangeRate',
  paymentTerms: 'paymentTerms',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PurchaseOrderScalarFieldEnum = {
  id: 'id',
  poNumber: 'poNumber',
  companyId: 'companyId',
  supplierId: 'supplierId',
  lcId: 'lcId',
  poDate: 'poDate',
  expectedDeliveryDate: 'expectedDeliveryDate',
  currency: 'currency',
  exchangeRate: 'exchangeRate',
  totalForeign: 'totalForeign',
  totalBDT: 'totalBDT',
  status: 'status',
  createdById: 'createdById',
  approvedById: 'approvedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PurchaseOrderLineScalarFieldEnum = {
  id: 'id',
  purchaseOrderId: 'purchaseOrderId',
  productId: 'productId',
  itemDescription: 'itemDescription',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  total: 'total'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  companyId: 'companyId',
  sku: 'sku',
  description: 'description',
  unitType: 'unitType',
  unitPrice: 'unitPrice',
  isActive: 'isActive',
  currency: 'currency',
  stockAmount: 'stockAmount',
  type: 'type',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  invoiceNumber: 'invoiceNumber',
  companyId: 'companyId',
  customerId: 'customerId',
  vendorId: 'vendorId',
  type: 'type',
  currency: 'currency',
  exchangeRate: 'exchangeRate',
  subtotal: 'subtotal',
  taxAmount: 'taxAmount',
  discountAmount: 'discountAmount',
  total: 'total',
  status: 'status',
  paymentSplits: 'paymentSplits',
  createdById: 'createdById',
  verifiedById: 'verifiedById',
  approvedById: 'approvedById',
  rejectedById: 'rejectedById',
  rejectionReason: 'rejectionReason',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  verifiedAt: 'verifiedAt',
  approvedAt: 'approvedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceLineScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  productId: 'productId',
  description: 'description',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  taxRate: 'taxRate',
  amount: 'amount'
};

exports.Prisma.JournalEntryScalarFieldEnum = {
  id: 'id',
  entryNumber: 'entryNumber',
  companyId: 'companyId',
  date: 'date',
  description: 'description',
  reference: 'reference',
  totalDebit: 'totalDebit',
  totalCredit: 'totalCredit',
  currencyId: 'currencyId',
  exchangeRate: 'exchangeRate',
  branchId: 'branchId',
  status: 'status',
  createdById: 'createdById',
  verifiedById: 'verifiedById',
  approvedById: 'approvedById',
  rejectedById: 'rejectedById',
  rejectionReason: 'rejectionReason',
  verifiedAt: 'verifiedAt',
  approvedAt: 'approvedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.JournalEntryLineScalarFieldEnum = {
  id: 'id',
  journalEntryId: 'journalEntryId',
  accountId: 'accountId',
  branchId: 'branchId',
  projectId: 'projectId',
  costCenterId: 'costCenterId',
  customerId: 'customerId',
  vendorId: 'vendorId',
  debit: 'debit',
  credit: 'credit',
  debitBase: 'debitBase',
  creditBase: 'creditBase',
  debitForeign: 'debitForeign',
  creditForeign: 'creditForeign',
  exchangeRate: 'exchangeRate',
  description: 'description',
  reconciled: 'reconciled',
  reconciledAt: 'reconciledAt'
};

exports.Prisma.BillScalarFieldEnum = {
  id: 'id',
  billNumber: 'billNumber',
  companyId: 'companyId',
  vendorId: 'vendorId',
  status: 'status',
  subtotal: 'subtotal',
  taxAmount: 'taxAmount',
  total: 'total',
  dueDate: 'dueDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AttachmentScalarFieldEnum = {
  id: 'id',
  name: 'name',
  fileName: 'fileName',
  fileType: 'fileType',
  filePath: 'filePath',
  fileSize: 'fileSize',
  entityType: 'entityType',
  entityId: 'entityId',
  documentType: 'documentType',
  hashValue: 'hashValue',
  version: 'version',
  isActive: 'isActive',
  isVerified: 'isVerified',
  verifiedById: 'verifiedById',
  uploadedById: 'uploadedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CurrencyScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  symbol: 'symbol',
  isBase: 'isBase',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ExchangeRateScalarFieldEnum = {
  id: 'id',
  fromCurrencyId: 'fromCurrencyId',
  toCurrencyId: 'toCurrencyId',
  rate: 'rate',
  rateDate: 'rateDate',
  source: 'source',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BackupLogScalarFieldEnum = {
  id: 'id',
  fileName: 'fileName',
  fileSize: 'fileSize',
  status: 'status',
  triggeredBy: 'triggeredBy',
  createdAt: 'createdAt'
};

exports.Prisma.ActivityLogScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  entityType: 'entityType',
  entityId: 'entityId',
  action: 'action',
  performedById: 'performedById',
  targetUserId: 'targetUserId',
  branchId: 'branchId',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  type: 'type',
  severity: 'severity',
  title: 'title',
  message: 'message',
  entityType: 'entityType',
  entityId: 'entityId',
  isRead: 'isRead',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  paymentNumber: 'paymentNumber',
  companyId: 'companyId',
  date: 'date',
  amount: 'amount',
  currency: 'currency',
  method: 'method',
  reference: 'reference',
  description: 'description',
  status: 'status',
  invoiceId: 'invoiceId',
  billId: 'billId',
  lcId: 'lcId',
  accountId: 'accountId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentPIScalarFieldEnum = {
  id: 'id',
  paymentId: 'paymentId',
  piId: 'piId',
  allocatedAmount: 'allocatedAmount'
};

exports.Prisma.EmployeeScalarFieldEnum = {
  id: 'id',
  employeeCode: 'employeeCode',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  phone: 'phone',
  designation: 'designation',
  department: 'department',
  joinDate: 'joinDate',
  salary: 'salary',
  companyId: 'companyId',
  isActive: 'isActive',
  paymentTerms: 'paymentTerms',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmployeeAdvanceScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  amount: 'amount',
  purpose: 'purpose',
  date: 'date',
  status: 'status',
  paymentMethod: 'paymentMethod',
  accountId: 'accountId',
  journalEntryId: 'journalEntryId',
  companyId: 'companyId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmployeeLoanScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  principalAmount: 'principalAmount',
  interestRate: 'interestRate',
  interestAmount: 'interestAmount',
  totalAmount: 'totalAmount',
  installments: 'installments',
  startDate: 'startDate',
  purpose: 'purpose',
  status: 'status',
  companyId: 'companyId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmployeeLoanRepaymentScalarFieldEnum = {
  id: 'id',
  loanId: 'loanId',
  amount: 'amount',
  principalPaid: 'principalPaid',
  interestPaid: 'interestPaid',
  paymentDate: 'paymentDate',
  status: 'status',
  journalEntryId: 'journalEntryId',
  companyId: 'companyId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmployeeExpenseScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  amount: 'amount',
  description: 'description',
  category: 'category',
  date: 'date',
  status: 'status',
  paymentMethod: 'paymentMethod',
  accountId: 'accountId',
  journalEntryId: 'journalEntryId',
  companyId: 'companyId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompanySettingsScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};


exports.Prisma.ModelName = {
  User: 'User',
  Role: 'Role',
  UserRole: 'UserRole',
  UserPermission: 'UserPermission',
  Company: 'Company',
  UserCompany: 'UserCompany',
  LC: 'LC',
  PI: 'PI',
  PILine: 'PILine',
  Loan: 'Loan',
  AccountType: 'AccountType',
  Account: 'Account',
  Branch: 'Branch',
  Project: 'Project',
  CostCenter: 'CostCenter',
  Customer: 'Customer',
  Vendor: 'Vendor',
  PurchaseOrder: 'PurchaseOrder',
  PurchaseOrderLine: 'PurchaseOrderLine',
  Product: 'Product',
  Invoice: 'Invoice',
  InvoiceLine: 'InvoiceLine',
  JournalEntry: 'JournalEntry',
  JournalEntryLine: 'JournalEntryLine',
  Bill: 'Bill',
  Attachment: 'Attachment',
  Currency: 'Currency',
  ExchangeRate: 'ExchangeRate',
  BackupLog: 'BackupLog',
  ActivityLog: 'ActivityLog',
  Notification: 'Notification',
  Payment: 'Payment',
  PaymentPI: 'PaymentPI',
  Employee: 'Employee',
  EmployeeAdvance: 'EmployeeAdvance',
  EmployeeLoan: 'EmployeeLoan',
  EmployeeLoanRepayment: 'EmployeeLoanRepayment',
  EmployeeExpense: 'EmployeeExpense',
  CompanySettings: 'CompanySettings'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
