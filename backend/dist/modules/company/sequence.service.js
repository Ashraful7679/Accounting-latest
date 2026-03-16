"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SequenceService = void 0;
const database_1 = __importDefault(require("../../config/database"));
class SequenceService {
    /**
     * Generates a robust, collision-safe document number.
     * Format: [PREFIX]-[YEAR]-[SEQUENCE] (e.g., JE-2026-0001)
     *
     * Strategy:
     *  1. Count all existing docs that start with PREFIX-YEAR- to estimate the next slot.
     *  2. Loop and increment until we find a candidate that does NOT yet exist in the DB.
     *     This handles gaps, out-of-order inserts, and data migrations from older formats.
     */
    static async generateDocumentNumber(companyId, type, prismaOverride) {
        const client = prismaOverride || database_1.default;
        const prefixes = {
            invoice: 'INV',
            journal: 'JE',
            po: 'PO',
            pi: 'PI',
            lc: 'LC',
            customer: 'CUS',
            vendor: 'VEN',
            product: 'PRD',
        };
        const prefix = prefixes[type];
        const year = new Date().getFullYear();
        const prefixYear = `${prefix}-${year}-`;
        // Step 1: Count existing docs with this year's prefix to get a starting estimate
        let count = 0;
        switch (type) {
            case 'invoice':
                count = await client.invoice.count({ where: { companyId, invoiceNumber: { startsWith: prefixYear } } });
                break;
            case 'journal':
                count = await client.journalEntry.count({ where: { companyId, entryNumber: { startsWith: prefixYear } } });
                break;
            case 'po':
                count = await client.purchaseOrder.count({ where: { companyId, poNumber: { startsWith: prefixYear } } });
                break;
            case 'pi':
                count = await client.pI.count({ where: { companyId, piNumber: { startsWith: prefixYear } } });
                break;
            case 'lc':
                count = await client.lC.count({ where: { companyId, lcNumber: { startsWith: prefixYear } } });
                break;
            case 'customer':
                count = await client.customer.count({ where: { companyId, code: { startsWith: prefixYear } } });
                break;
            case 'vendor':
                count = await client.vendor.count({ where: { companyId, code: { startsWith: prefixYear } } });
                break;
            case 'product':
                count = await client.product.count({ where: { companyId, code: { startsWith: prefixYear } } });
                break;
        }
        // Step 2: Find the first free slot (handles gaps from deletions / data migrations)
        let counter = count + 1;
        let attempts = 0;
        while (true) {
            const candidate = `${prefixYear}${counter.toString().padStart(4, '0')}`;
            let alreadyExists = false;
            switch (type) {
                case 'invoice':
                    alreadyExists = !!(await client.invoice.findUnique({ where: { invoiceNumber: candidate } }));
                    break;
                case 'journal':
                    alreadyExists = !!(await client.journalEntry.findUnique({ where: { entryNumber: candidate } }));
                    break;
                case 'po':
                    alreadyExists = !!(await client.purchaseOrder.findUnique({ where: { poNumber: candidate } }));
                    break;
                case 'pi':
                    alreadyExists = !!(await client.pI.findUnique({ where: { piNumber: candidate } }));
                    break;
                case 'lc':
                    alreadyExists = !!(await client.lC.findUnique({ where: { lcNumber: candidate } }));
                    break;
                case 'customer':
                    alreadyExists = !!(await client.customer.findUnique({ where: { code: candidate } }));
                    break;
                case 'vendor':
                    alreadyExists = !!(await client.vendor.findUnique({ where: { code: candidate } }));
                    break;
                case 'product':
                    alreadyExists = !!(await client.product.findUnique({ where: { companyId_code: { companyId, code: candidate } } }));
                    break;
            }
            if (!alreadyExists)
                return candidate;
            counter++;
            attempts++;
            if (attempts > 200) {
                throw new Error(`Cannot generate unique document number for type "${type}" after 200 attempts`);
            }
        }
    }
}
exports.SequenceService = SequenceService;
//# sourceMappingURL=sequence.service.js.map