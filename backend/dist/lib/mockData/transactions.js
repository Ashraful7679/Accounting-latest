"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.demoJournals = exports.demoInvoices = void 0;
const company_1 = require("./company");
exports.demoInvoices = [
    {
        id: "inv-1",
        invoiceNumber: "INV-DEMO-001",
        invoiceDate: new Date().toISOString(),
        status: "APPROVED",
        currency: "USD",
        exchangeRate: 110.5,
        type: "SALES",
        subtotal: 5000,
        taxAmount: 0,
        total: 552500, // in BDT
        customer: { id: "cust-1", name: "Global Garments USA" },
        vendor: null,
        createdBy: company_1.demoUser,
        lines: [
            { id: "inv-l-1", description: "Export Quality Cotton Yarn", quantity: 1000, unitPrice: 50, taxRate: 0, amount: 5000, product: null }
        ]
    },
    {
        id: "inv-2",
        invoiceNumber: "INV-DEMO-002",
        invoiceDate: new Date().toISOString(),
        status: "PENDING_VERIFICATION",
        currency: "BDT",
        exchangeRate: 1,
        type: "SALES",
        subtotal: 125000,
        taxAmount: 6250,
        total: 131250,
        customer: { id: "cust-2", name: "Local Textile Ltd" },
        vendor: null,
        createdBy: company_1.demoUser,
        lines: [
            { id: "inv-l-2", description: "Fabric Dying (Blue)", quantity: 5000, unitPrice: 25, taxRate: 5, amount: 125000, product: null }
        ]
    },
    {
        id: "inv-3",
        invoiceNumber: "PUR-DEMO-001",
        invoiceDate: new Date().toISOString(),
        status: "APPROVED",
        currency: "BDT",
        exchangeRate: 1,
        type: "PURCHASE",
        subtotal: 80000,
        taxAmount: 4000,
        total: 84000,
        customer: null,
        vendor: { id: "ven-1", name: "Fabric Supplier X" },
        createdBy: company_1.demoUser,
        lines: [
            { id: "inv-l-3", description: "Raw Cotton", quantity: 100, unitPrice: 800, taxRate: 5, amount: 80000, product: null }
        ]
    }
];
exports.demoJournals = [
    {
        id: "jr-1",
        entryNumber: "JV-2026-001",
        companyId: "498a49fa-03bb-43c2-ab5b-bb8690eb7a62",
        date: new Date().toISOString(),
        description: "Office Rent for February 2026",
        status: "APPROVED",
        totalDebit: 45000,
        totalCredit: 45000,
        createdBy: company_1.demoUser,
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
        createdBy: company_1.demoUser,
        lines: [
            { account: { code: "5101", name: "Utility Expense" }, debit: 12500, credit: 0, description: "Electricity Bill" },
            { account: { code: "2001", name: "Accrued Liabilities" }, debit: 0, credit: 12500, description: "Payable" }
        ]
    }
];
//# sourceMappingURL=transactions.js.map