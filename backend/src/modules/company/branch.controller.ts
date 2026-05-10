import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { ValidationError, NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';

export class BranchController extends BaseCompanyController {
  async getBranches(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    
    const branches = await prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    
    return reply.send({ success: true, data: branches });
  }

  async getBranch(request: FastifyRequest, reply: FastifyReply) {
    const { branchId } = request.params as { branchId: string };
    
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });
    
    if (!branch || branch.deletedAt) throw new NotFoundError('Branch not found');
    
    return reply.send({ success: true, data: branch });
  }

  async createBranch(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const { name, code, address, phone, email, isMain } = request.body as any;

    await this.requirePermission(userId, companyId, 'branches', 'create');

    if (!name) throw new ValidationError('Branch name is required');
    if (!code) throw new ValidationError('Branch code is required');

    // Check if code already exists in company
    const existing = await prisma.branch.findFirst({
      where: { companyId, code, deletedAt: null }
    });
    if (existing) throw new ValidationError('Branch code already exists in this company');

    const branch = await prisma.branch.create({
      data: {
        companyId,
        name,
        code,
        address,
        phone,
        email,
        isMain: !!isMain,
      }
    });

    // If isMain is true, update other branches to false
    if (isMain) {
      await prisma.branch.updateMany({
        where: { companyId, id: { not: branch.id } },
        data: { isMain: false }
      });
      
      // Also update company defaultBranchId
      const settings = await prisma.companySettings.findFirst({ where: { companyId } });
      if (settings) {
        await prisma.companySettings.update({
          where: { id: settings.id },
          data: { defaultBranchId: branch.id }
        });
      }
    }

    return reply.status(201).send({ success: true, data: branch });
  }

  async updateBranch(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, branchId } = request.params as { id: string; branchId: string };
    const userId = (request.user as any).id;
    const data = request.body as any;

    await this.requirePermission(userId, companyId, 'branches', 'edit');

    const existing = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!existing || existing.deletedAt) throw new NotFoundError('Branch not found');

    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.branch.findFirst({
        where: { companyId, code: data.code, deletedAt: null }
      });
      if (duplicate) throw new ValidationError('Branch code already exists');
    }

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        name: data.name ?? existing.name,
        code: data.code ?? existing.code,
        address: data.address ?? existing.address,
        phone: data.phone ?? existing.phone,
        email: data.email ?? existing.email,
        isMain: data.isMain ?? existing.isMain,
      }
    });

    if (data.isMain) {
      await prisma.branch.updateMany({
        where: { companyId, id: { not: branch.id } },
        data: { isMain: false }
      });
      
      const settings = await prisma.companySettings.findFirst({ where: { companyId } });
      if (settings) {
        await prisma.companySettings.update({
          where: { id: settings.id },
          data: { defaultBranchId: branch.id }
        });
      }
    }

    return reply.send({ success: true, data: branch });
  }

  async deleteBranch(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, branchId } = request.params as { id: string; branchId: string };
    const userId = (request.user as any).id;

    await this.requirePermission(userId, companyId, 'branches', 'delete');

    const branch = await (prisma as any).branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.deletedAt) throw new NotFoundError('Branch not found');

    if (branch.isMain) {
      throw new ValidationError('Cannot delete the main branch. Designate another branch as main first.');
    }

    // Check if branch has associated records (Invoices, Journals, etc.)
    const hasInvoices = await prisma.invoice.findFirst({ where: { branchId } });
    const hasJournals = await prisma.journalEntry.findFirst({ where: { branchId } });
    
    if (hasInvoices || hasJournals) {
      // Soft delete
      await prisma.branch.update({
        where: { id: branchId },
        data: { deletedAt: new Date() }
      });
    } else {
      // Hard delete if no records
      await prisma.branch.delete({ where: { id: branchId } });
    }

    return reply.send({ success: true, message: 'Branch deleted successfully' });
  }

  async verifyBranch(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, branchId } = request.params as { id: string; branchId: string };
    const userId = (request.user as any).id;

    await this.requirePermission(userId, companyId, 'branches', 'verify');

    const branch = await (prisma.branch as any).update({
      where: { id: branchId },
      data: {
        status: 'VERIFIED',
        verifiedById: userId,
        verifiedAt: new Date()
      }
    });

    return reply.send({ success: true, data: branch });
  }

  async approveBranch(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, branchId } = request.params as { id: string; branchId: string };
    const userId = (request.user as any).id;

    await this.requirePermission(userId, companyId, 'branches', 'approve');

    const branch = await (prisma.branch as any).update({
      where: { id: branchId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date()
      }
    });

    return reply.send({ success: true, data: branch });
  }
}
