import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { AccountRepository } from '../../repositories/AccountRepository';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';
import { COA_TEMPLATES, CoaAccountTemplate } from '../../lib/coaTemplates';

export class CoaController extends BaseCompanyController {
  // ============ ACCOUNTS ============
  async getAccounts(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { limit, page } = request.query as { limit?: string; page?: string };
    
    const take = limit ? parseInt(limit) : undefined;
    const skip = (page && take) ? (parseInt(page) - 1) * take : undefined;

    const accounts = await AccountRepository.findMany({ companyId }, take, skip);
    return reply.send({ success: true, data: accounts });
  }

  async createAccount(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { code, name, accountTypeId, parentId, openingBalance, cashFlowType, category } = request.body as any;

    let accountCode = code;
    
    // If no code provided, auto-generate based on account type
    if (!accountCode) {
      const accountType = await prisma.accountType.findUnique({ where: { id: accountTypeId } });
      
      if (parentId) {
        // Get parent account and derive code from its serial
        const parent = await prisma.account.findUnique({ where: { id: parentId } });
        if (parent) {
          // Get count of existing children under this parent
          const siblingCount = await prisma.account.count({ where: { parentId } });
          const parentPrefix = parent.code.substring(0, parent.code.length - 2);
          accountCode = `${parentPrefix}${String(siblingCount + 1).padStart(2, '0')}`;
        }
      } else if (accountType) {
        // Generate code based on account type
        const typeCodeMap: Record<string, { prefix: string; min: number; max: number }> = {
          'ASSET': { prefix: '1', min: 100, max: 999 },
          'LIABILITY': { prefix: '2', min: 100, max: 999 },
          'EQUITY': { prefix: '3', min: 100, max: 999 },
          'INCOME': { prefix: '4', min: 100, max: 999 },
          'EXPENSE': { prefix: '5', min: 100, max: 999 },
        };
        
        const config = typeCodeMap[accountType.name];
        if (config) {
          // Find next available code in range
          const existing = await prisma.account.findMany({
            where: { 
              companyId,
              code: { startsWith: config.prefix }
            },
            orderBy: { code: 'desc' },
            take: 1
          });
          
          let nextNum = config.min;
          if (existing.length > 0) {
            const lastCode = existing[0].code;
            const lastNum = parseInt(lastCode.replace(/[^0-9]/g, ''));
            if (lastNum < config.max) {
              nextNum = lastNum + 1;
            }
          }
          accountCode = `${config.prefix}${String(nextNum).padStart(3, '0')}`;
        }
      }
    }

    if (!accountCode) {
      return reply.status(400).send({ success: false, error: 'Could not generate account code' });
    }

    const openBal = parseFloat(openingBalance) || 0;
    const account = await AccountRepository.create({ 
      code: accountCode, 
      name, 
      companyId, 
      accountTypeId, 
      parentId: parentId || null, 
      openingBalance: openBal, 
      currentBalance: openBal,
      cashFlowType,
      category: category || 'NONE'
    } as any);
    return reply.status(201).send({ success: true, data: account });
  }

  async updateAccount(request: FastifyRequest, reply: FastifyReply) {
    const { accountId } = request.params as { accountId: string };
    const { code, name, accountTypeId, parentId, openingBalance, isActive, cashFlowType, category } = request.body as any;

    const existingAccount = await prisma.account.findUnique({ where: { id: accountId } });
    if (!existingAccount) throw new NotFoundError('Account not found');

    // Prevent deactivation if account has non-zero balance, children, or journal entries
    if (isActive === false && existingAccount.isActive) {
      if (Number(existingAccount.currentBalance) !== 0) {
        return reply.status(400).send({ success: false, error: 'Cannot deactivate account with non-zero balance. Clear balance first.' });
      }
      const childCount = await prisma.account.count({ where: { parentId: accountId, deletedAt: null } });
      if (childCount > 0) {
        return reply.status(400).send({ success: false, error: 'Cannot deactivate account with active child accounts. Reassign or remove children first.' });
      }
      const journalCount = await prisma.journalEntryLine.count({ where: { accountId } });
      if (journalCount > 0) {
        return reply.status(400).send({ success: false, error: 'Cannot deactivate account with journal history. Account has existing transactions.' });
      }
    }

    const account = await prisma.account.update({
      where: { id: accountId },
      data: { 
        name: name ?? existingAccount.name, 
        isActive: isActive ?? existingAccount.isActive, 
        cashFlowType: cashFlowType ?? existingAccount.cashFlowType,
        code: code ?? existingAccount.code,
        accountTypeId: accountTypeId ?? existingAccount.accountTypeId,
        parentId: parentId === null ? null : (parentId ?? existingAccount.parentId),
        openingBalance: openingBalance !== undefined ? parseFloat(openingBalance) : existingAccount.openingBalance,
        category: category ?? (existingAccount as any).category
      },
    });

    return reply.send({ success: true, data: account });
  }

  async getAccountTypes(request: FastifyRequest, reply: FastifyReply) {
    const types = await AccountRepository.findAccountTypes();
    return reply.send({ success: true, data: types });
  }

  async healBalances(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    
    // 1. Get all accounts for this company
    const accounts = await prisma.account.findMany({
      where: { companyId },
      include: { accountType: true }
    });

    // 2. Wrap in a transaction for safety
    await prisma.$transaction(async (tx: any) => {
      for (const account of accounts) {
        // Reset to opening balance
        let balance = Number(account.openingBalance) || 0;

        // Get all approved ledger lines for this account
        const lines = await tx.journalEntryLine.findMany({
          where: {
            accountId: account.id,
            journalEntry: { status: 'APPROVED' }
          }
        });

        // Sum up movements
        const isDebitType = account.accountType.type === 'DEBIT';
        for (const line of lines) {
          const change = isDebitType
            ? (Number(line.debitBase) - Number(line.creditBase))
            : (Number(line.creditBase) - Number(line.debitBase));
          balance += change;
        }

        // Update Account
        await tx.account.update({
          where: { id: account.id },
          data: { currentBalance: balance }
        });
      }
    });

    return reply.send({ success: true, message: 'All account balances have been synchronized with the ledger.' });
  }

  static async initializeCompanyCOA(companyId: string, category: string = 'GENERAL') {
    const accountTypes = await prisma.accountType.findMany();
    const typeIdMap: Record<string, string> = {};
    accountTypes.forEach(t => { typeIdMap[t.name] = t.id; });

    // 1. Get base template (GENERAL)
    let template = [...COA_TEMPLATES.GENERAL];

    // 2. If a specific category is requested, merge it
    if (category !== 'GENERAL' && COA_TEMPLATES[category]) {
      const categoryTemplate = COA_TEMPLATES[category];
      
      const mergeTemplates = (base: CoaAccountTemplate[], extra: CoaAccountTemplate[]) => {
        for (const item of extra) {
          const existing = base.find(b => b.code === item.code);
          if (existing) {
            if (item.children && item.children.length > 0) {
              existing.children = existing.children || [];
              mergeTemplates(existing.children, item.children);
            }
          } else {
            base.push(item);
          }
        }
      };
      
      mergeTemplates(template, categoryTemplate);
    }

    const createFromTemplate = async (items: CoaAccountTemplate[], parentId: string | null = null, tx?: any) => {
      const client = tx || prisma;
      const sortedItems = [...items].sort((a, b) => a.code.localeCompare(b.code));
      
      for (const item of sortedItems) {
        const typeId = typeIdMap[item.type];
        if (!typeId) continue;

        const existing = await client.account.findFirst({
          where: { companyId, code: item.code }
        });

        let accountId = existing?.id;

        if (!existing) {
          const account = await client.account.create({
            data: {
              companyId,
              code: item.code,
              name: item.name,
              accountTypeId: typeId,
              parentId,
              category: item.category || 'NONE',
              cashFlowType: item.cashFlowType || 'OPERATING',
              openingBalance: 0,
              currentBalance: 0,
              isActive: true
            }
          });
          accountId = account.id;
        }

        if (item.children && item.children.length > 0) {
          await createFromTemplate(item.children, accountId || null, tx);
        }
      }
    };

    await prisma.$transaction(async (tx: any) => {
      await createFromTemplate(template, null, tx);
    });
  }
}
