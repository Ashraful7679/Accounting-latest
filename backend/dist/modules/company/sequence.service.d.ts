export declare class SequenceService {
    /**
     * Generates a robust, collision-safe document number.
     * Format: [PREFIX]-[YEAR]-[SEQUENCE] (e.g., JE-2026-0001)
     *
     * Strategy:
     *  1. Count all existing docs that start with PREFIX-YEAR- to estimate the next slot.
     *  2. Loop and increment until we find a candidate that does NOT yet exist in the DB.
     *     This handles gaps, out-of-order inserts, and data migrations from older formats.
     */
    static generateDocumentNumber(companyId: string, type: 'invoice' | 'journal' | 'po' | 'pi' | 'lc' | 'customer' | 'vendor' | 'product', prismaOverride?: any): Promise<string>;
}
//# sourceMappingURL=sequence.service.d.ts.map