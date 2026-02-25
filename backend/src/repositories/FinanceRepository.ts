import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

// Simple demo data for finance
const demoLCs = [
  { id: 'lc-1', lcNumber: 'LC-DEMO-2026-01', bankName: 'DBBL', amount: 50000, currency: 'USD', status: 'OPEN', type: 'IMPORT' }
];

const demoLoans = [
  { id: 'loan-1', loanNumber: 'LN-DBBL-4422', bankName: 'DBBL', principalAmount: 2000000, outstandingBalance: 1800000, interestRate: 9, status: 'ACTIVE' }
];

export class FinanceRepository {
  static async findLCs(companyId: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.lC.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
      } catch (error) {
        console.error('LC fetch failed, using demo data');
      }
    }
    return demoLCs;
  }

  static async findLoans(companyId: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.loan.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
      } catch (error) {
        console.error('Loan fetch failed, using demo data');
      }
    }
    return demoLoans;
  }
}
