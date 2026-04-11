import { FastifyRequest } from 'fastify';
import prisma from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { SequenceService } from './sequence.service';

export class BaseCompanyController {
  protected async getUserRole(userId: string, companyId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) return 'User';

    const userCompany = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    if (!userCompany) {
      const isAdmin = user.userRoles.some(ur => ur.role.name === 'Admin');
      if (isAdmin) return 'Admin';
      throw new ForbiddenError('Access denied: You are not a member of this company');
    }

    return user.userRoles[0]?.role?.name || 'User';
  }

  protected canEdit(status: string, role: string, userId?: string, createdById?: string): boolean {
    const lockedStatuses = ['VERIFIED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CLOSED'];
    if (lockedStatuses.includes(status)) return false;
    
    if (role === 'Owner' || role === 'Admin' || role === 'Manager') return true;
    if (userId && createdById && userId === createdById) {
      return status === 'DRAFT' || status === 'REJECTED';
    }
    
    if (role === 'Accountant') return status === 'DRAFT' || status === 'REJECTED';
    return false;
  }

  protected canDelete(status: string, role: string): boolean {
    if (status !== 'DRAFT') return false;
    if (role === 'Owner' || role === 'Admin') return true;
    return false;
  }

  protected canVerify(status: string, role: string): boolean {
    const allowedRoles = ['Owner', 'Manager', 'Admin'];
    if (allowedRoles.includes(role)) {
      return status === 'PENDING_VERIFICATION' || status === 'DRAFT' || status === 'OPEN';
    }
    return false;
  }

  protected canApprove(status: string, role: string): boolean {
    const allowedRoles = ['Owner', 'Admin', 'Manager'];
    if (allowedRoles.includes(role)) {
      return status === 'VERIFIED';
    }
    return false;
  }

  protected async generateDocumentNumber(
    companyId: string, 
    type: 'invoice' | 'journal' | 'po' | 'pi' | 'lc' | 'customer' | 'vendor' | 'product' | 'employee',
    prismaOverride?: any
  ): Promise<string> {
    return SequenceService.generateDocumentNumber(companyId, type, prismaOverride);
  }
}
