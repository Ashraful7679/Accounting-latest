import { FastifyRequest } from 'fastify';
import prisma from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { SequenceService } from './sequence.service';
import { RBACService } from './rbac.service';

export class BaseCompanyController {
  protected async getUserRole(userId: string, companyId: string): Promise<string> {
    return RBACService.getUserRoleLevel(userId, companyId);
  }

  protected async checkPermission(
    userId: string, 
    companyId: string, 
    module: string, 
    action: 'create' | 'view' | 'edit' | 'delete' | 'verify' | 'approve' | 'export' | 'print'
  ): Promise<boolean> {
    return RBACService.checkPermission(userId, companyId, module, action);
  }

  protected async requirePermission(
    userId: string,
    companyId: string,
    module: string,
    action: 'create' | 'view' | 'edit' | 'delete' | 'verify' | 'approve' | 'export' | 'print'
  ): Promise<void> {
    const hasPermission = await this.checkPermission(userId, companyId, module, action);
    if (!hasPermission) {
      throw new ForbiddenError(`You don't have permission to ${action} ${module}`);
    }
  }

  protected canEdit(status: string, role: string, userId?: string, createdById?: string): boolean {
    const editableStatuses = ['DRAFT', 'REJECTED'];
    if (!editableStatuses.includes(status)) return false;
    
    if (role === 'Owner' || role === 'Manager') return true;
    if (userId && createdById && userId === createdById) return true;
    if (role === 'Accountant') return true;
    
    return false;
  }

  protected canDelete(status: string, role: string): boolean {
    if (status !== 'DRAFT') return false;
    if (role === 'Owner') return true;
    return false;
  }

  protected canVerify(status: string, role: string): boolean {
    // Role must have verify permission AND status must be pending verification
    const allowedRoles = ['Owner', 'Manager', 'Controller'];
    if (allowedRoles.includes(role)) {
      return status === 'PENDING_VERIFICATION' || status === 'DRAFT' || status === 'OPEN';
    }
    return false;
  }

  protected canApprove(status: string, role: string): boolean {
    // Only Controller/Admin can approve verified documents
    const allowedRoles = ['Owner', 'Manager', 'Controller'];
    if (allowedRoles.includes(role)) {
      return status === 'VERIFIED';
    }
    return false;
  }

  // Workflow: Draft → Pending Verification → Verified → Approved → Posted
  protected canSubmitForVerification(status: string, role: string): boolean {
    return status === 'DRAFT' && ['Accountant', 'Sales Rep', 'Purchase Rep', 'Owner'].includes(role);
  }

  protected canSubmitForApproval(status: string, role: string): boolean {
    return status === 'VERIFIED' && ['Controller', 'Owner'].includes(role);
  }

  protected async generateDocumentNumber(
    companyId: string, 
    type: 'invoice' | 'journal' | 'po' | 'pi' | 'lc' | 'customer' | 'vendor' | 'product' | 'employee' | 'account' | 'so' | 'dn' | 'grn' | 'bill',
    prismaOverride?: any
  ): Promise<string> {
    return SequenceService.generateDocumentNumber(companyId, type, prismaOverride);
  }
}