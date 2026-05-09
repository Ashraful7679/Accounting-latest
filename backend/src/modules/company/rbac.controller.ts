import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';
import { RBACService } from './rbac.service';

export class RBACController extends BaseCompanyController {
  async getRoles(request: FastifyRequest, reply: FastifyReply) {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { userRoles: true } }
      }
    });

    const formattedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.permissions,
      userCount: role._count.userRoles
    }));

    return reply.send({ success: true, data: formattedRoles });
  }

  async getRole(request: FastifyRequest, reply: FastifyReply) {
    const { roleId } = request.params as { id: string; roleId: string };

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        userRoles: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
        }
      }
    });

    if (!role) throw new NotFoundError('Role not found');

    return reply.send({
      success: true,
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissions: role.permissions,
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
    const { roleId } = request.params as { id: string; roleId: string };
    const { module, permission, value } = request.body as { module: string; permission: string; value: boolean };

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundError('Role not found');
    if (role.isSystem) throw new ForbiddenError('Cannot modify system role permissions');

    const currentPermissions = (role.permissions as Record<string, Record<string, boolean>>) || {};
    if (!currentPermissions[module]) currentPermissions[module] = {};
    currentPermissions[module][permission] = value;

    await prisma.role.update({
      where: { id: roleId },
      data: { permissions: currentPermissions }
    });

    return reply.send({ success: true, message: 'Permission updated successfully' });
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