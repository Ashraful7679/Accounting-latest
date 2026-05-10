---
name: accabiz-accounting-pro
description: Advanced accounting domain expertise for AccaBiz, covering ledger integrity, financial workflows, and double-entry bookkeeping rules.
---

# AccaBiz Accounting Pro Skill

This skill provides the domain-specific logic required to maintain a professional-grade accounting engine. Use it when implementing financial features, designing reporting logic, or debugging ledger imbalances.

## Accounting Core Principles

### 1. Double-Entry Integrity
Every financial event must result in balanced Journal Entry Lines.
- **Rule**: `SUM(Debits) === SUM(Credits)` for every `JournalEntry`.
- **Validation**: `TransactionRepository` and `JournalService` must enforce this before changing status to `APPROVED`.

### 2. Account Categories & Normal Balances
- **ASSET / EXPENSE**: Increase with DEBIT, decrease with CREDIT.
- **LIABILITY / EQUITY / INCOME**: Increase with CREDIT, decrease with DEBIT.
- **Ledger Enforcement**: When updating `currentBalance`, the sign must depend on the `accountType.type` (DEBIT/CREDIT).

### 3. Automated Ledger Mapping
Entities (Customers, Vendors, Employees) should have dedicated ledger accounts or be mapped to unified AR/AP accounts via `ensureEntityAccount`.
- **AR (Accounts Receivable)**: Mapped to Customers.
- **AP (Accounts Payable)**: Mapped to Vendors.
- **PAYABLE**: Mapped to Salaries/Employees.

## Professional Workflows

### 1. Proforma Invoice (PI) & Letter of Credit (LC)
Specific to import/export trade:
- **LC Limits**: Sum of PIs linked to an LC must not exceed the LC's total value.
- **Margin Handling**: Track LC margins as restricted assets until the LC is settled or retired.

### 2. Multi-Currency Accounting
- **Base Currency**: BDT.
- **Foreign Currency**: Track `amount` (FCY) and `amountBase` (BDT).
- **Exchange Rates**: Always use the rate active at the `piDate` or `invoiceDate`. Realized gains/losses must be calculated at the time of settlement (Payment).

### 3. Bank Reconciliation
- Matches `Book Balance` (from GL) against `Statement Balance` (from Bank).
- Handles "Uncleared" transactions (Checks in transit, etc.).

## Financial Controls

- **Period Closing**: Prevent postings to closed financial years or periods.
- **Document Sequencing**: Ensure gapless or traceable document numbering for Invoices and Vouchers.
- **Audit Trail**: Every change to an `APPROVED` document must be logged with the user ID and timestamp.

## Implementation Guide

- **Reports**: When building Trial Balance or Balance Sheet, always aggregate from `JournalEntryLine` for accuracy, rather than just relying on `Account.currentBalance` which can drift.
- **Recalculation**: Use the `recalculate-balances` utility if a ledger imbalance is detected.

---
*Created for the AccaBiz ERP Project*
