import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';
import { RBACService, PERMISSIONS } from './rbac.service';

export class RBACController extends BaseCompanyController {
  async getRoles(request: FastifyRequest, reply: FastifyReply) {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: true
      }
    });

    const formattedRoles = roles.map(role => {
      const permissions: Record<string, any> = {};
      
      // Initialize all modules from PERMISSIONS with default false
      Object.keys(PERMISSIONS).forEach(m => {
        permissions[m] = {
          canView: false, canCreate: false, canEdit: false, canDelete: false,
          canVerify: false, canApprove: false, canExport: false, canPrint: false
        };
      });

      // Fill from existing role permissions in DB
      (role as any).rolePermissions?.forEach((rp: any) => {
        if (permissions[rp.module]) {
          permissions[rp.module] = {
            canView: rp.canView,
            canCreate: rp.canCreate,
            canEdit: rp.canEdit,
            canDelete: rp.canDelete,
            canVerify: rp.canVerify,
            canApprove: rp.canApprove,
            canExport: rp.canExport,
            canPrint: rp.canPrint
          };
        }
      });

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissions,
        userCount: role._count.userRoles
      };
    });

    return reply.send({ success: true, data: formattedRoles });
  }

  async getRole(request: FastifyRequest, reply: FastifyReply) {
    const { roleId } = request.params as { id: string; roleId: string };

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: true,
        userRoles: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
        }
      }
    });

    if (!role) throw new NotFoundError('Role not found');

    const permissions: Record<string, any> = {};
    (role as any).rolePermissions.forEach((rp: any) => {
      permissions[rp.module] = {
        canCreate: rp.canCreate,
        canView: rp.canView,
        canEdit: rp.canEdit,
        canDelete: rp.canDelete,
        canVerify: rp.canVerify,
        canApprove: rp.canApprove,
        canExport: rp.canExport,
        canPrint: rp.canPrint,
      };
    });

    return reply.send({
      success: true,
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissions,
        users: role.userRoles.map(ur => ({
          id: ur.user.id,
          name: `${ur.user.firstName} ${ur.user.lastName}`,
          email: ur.user.email
        }))
      }
    });
  }

  async createRole(request: FastifyRequest, reply: FastifyReply) {
    const { name, description } = request.body as { name: string; description?: string };

    if (!name) {
      return reply.status(400).send({ error: 'Role name is required' });
    }

    const existing = await prisma.role.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    });

    if (existing) {
      return reply.status(409).send({ error: 'Role with this name already exists' });
    }

    const role = await prisma.role.create({
      data: {
        name,
        description: description || '',
        isSystem: false,
      }
    });

    return reply.status(201).send({ success: true, data: { id: role.id, name: role.name } });
  }

  async updateRole(request: FastifyRequest, reply: FastifyReply) {
    const { roleId } = request.params as { id: string; roleId: string };
    const { name, description } = request.body as { name?: string; description?: string };

    const existingRole = await prisma.role.findUnique({ where: { id: roleId } });

    if (!existingRole) throw new NotFoundError('Role not found');
    if (existingRole.isSystem) {
      throw new ForbiddenError('Cannot modify system roles');
    }

    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: name || existingRole.name,
        description: description !== undefined ? description : existingRole.description
      }
    });

    return reply.send({ success: true, data: { id: role.id, name: role.name } });
  }

  async deleteRole(request: FastifyRequest, reply: FastifyReply) {
    const { roleId } = request.params as { id: string; roleId: string };

    const existingRole = await prisma.role.findUnique({ where: { id: roleId } });

    if (!existingRole) throw new NotFoundError('Role not found');
    if (existingRole.isSystem) {
      throw new ForbiddenError('Cannot delete system roles');
    }

    const userCount = await prisma.userRole.count({ where: { roleId } });
    if (userCount > 0) {
      return reply.status(409).send({ error: `Cannot delete role — ${userCount} user(s) are assigned to it.` });
    }

    await prisma.role.delete({ where: { id: roleId } });

    return reply.send({ success: true, message: 'Role deleted successfully' });
  }

  async updatePermission(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, roleId } = request.params as { id: string; roleId: string };
    const body = request.body as any;

    // Role-level toggle from Roles UI: { module, action/permission, can/value }
    if (body.module !== undefined && body.userId === undefined) {
      const { module } = body;
      const action = body.action || body.permission;
      const can = body.can !== undefined ? body.can : body.value;

      if (action === undefined || can === undefined) {
        return reply.status(400).send({ success: false, message: 'Missing action or can value' });
      }
      
      const existing = await prisma.rolePermission.findUnique({
        where: { roleId_module: { roleId, module } }
      });

      const current: Record<string, boolean> = {
        canCreate: existing?.canCreate ?? false,
        canView: existing?.canView ?? true,
        canEdit: existing?.canEdit ?? false,
        canDelete: existing?.canDelete ?? false,
        canVerify: existing?.canVerify ?? false,
        canApprove: existing?.canApprove ?? false,
        canExport: existing?.canExport ?? false,
        canPrint: existing?.canPrint ?? false,
      };

      // action might be 'canCreate' or 'create'
      const fieldName = action.startsWith('can') ? action : `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
      
      if (fieldName in current) {
        current[fieldName] = can;
      } else {
        return reply.status(400).send({ success: false, message: `Invalid permission field: ${fieldName}` });
      }

      const result = await prisma.rolePermission.upsert({
        where: { roleId_module: { roleId, module } },
        update: current,
        create: { roleId, module, ...current },
      });

      return reply.send({ success: true, data: result });
    }

    return reply.status(400).send({ error: 'Invalid permission update request' });
  }

  async assignRoleToUser(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, roleId } = request.params as { id: string; roleId: string };
    const { userId: targetUserId } = request.body as { userId: string };

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundError('Role not found');

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, userCompanies: { some: { companyId } } }
    });
    if (!targetUser) throw new NotFoundError('User not found in this company');

    const existing = await prisma.userRole.findFirst({
      where: { userId: targetUserId, roleId }
    });
    if (existing) {
      return reply.status(409).send({ error: 'User already has this role' });
    }

    await prisma.userRole.create({ data: { userId: targetUserId, roleId } });

    return reply.send({ success: true, message: 'Role assigned successfully' });
  }

  async removeRoleFromUser(request: FastifyRequest, reply: FastifyReply) {
    const { roleId, userId } = request.params as { id: string; roleId: string; userId: string };

    const assignment = await prisma.userRole.findFirst({ where: { userId, roleId } });
    if (!assignment) throw new NotFoundError('User does not have this role');

    await prisma.userRole.delete({ where: { id: assignment.id } });

    return reply.send({ success: true, message: 'Role removed successfully' });
  }

  async getMyPermissions(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const user = request.user as { id: string };
    const permissions = await RBACService.getUserPermissions(user.id, companyId);
    return reply.send({ success: true, data: permissions });
  }
}