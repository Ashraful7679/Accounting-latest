import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pump = promisify(pipeline);
import { EquityService } from '../accounting/equity.service';
import { CoaController } from '../company/coa.controller';

const PERMISSION_MODULES = [
  'journals', 'invoices', 'bills', 'payments', 'purchase_orders',
  'customers', 'vendors', 'accounts', 'reports', 'employees',
  'lc', 'pi', 'loans', 'products', 'attachments',
  'employee_advances', 'employee_loans', 'employee_expenses',
  'debit_notes', 'credit_notes', 'fixed_assets', 'grn', 'dn', 'payroll',
];

const ROLE_PERMISSIONS: Record<string, {
  canCreate: boolean; canView: boolean; canEdit: boolean; canDelete: boolean;
  canVerify: boolean; canApprove: boolean; canExport: boolean; canPrint: boolean;
}> = {
  //            create  view   edit   delete verify approve export print
  User:       { canCreate: false, canView: true,  canEdit: false, canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: false },
  DataEntry:  { canCreate: true,  canView: true,  canEdit: true,  canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: true  },
  Accountant: { canCreate: true,  canView: true,  canEdit: true,  canDelete: false, canVerify: true,  canApprove: false, canExport: true,  canPrint: true  },
  Controller: { canCreate: false, canView: true,  canEdit: false, canDelete: false, canVerify: true,  canApprove: true,  canExport: true,  canPrint: true  },
  Manager:    { canCreate: true,  canView: true,  canEdit: true,  canDelete: false, canVerify: true,  canApprove: true,  canExport: true,  canPrint: true  },
  Owner:      { canCreate: true,  canView: true,  canEdit: true,  canDelete: true,  canVerify: true,  canApprove: true,  canExport: true,  canPrint: true  },
  Admin:      { canCreate: true,  canView: true,  canEdit: true,  canDelete: true,  canVerify: true,  canApprove: true,  canExport: true,  canPrint: true  },
};

async function seedDefaultPermissions(userId: string, roleName: string): Promise<void> {
  // 1. Try to find existing role templates in database
  const templates = await (prisma as any).rolePermission.findMany({
    where: { role: { name: roleName } }
  });

  const modulesToSeed = templates.length > 0 
    ? templates.map(t => ({
        module: t.module,
        canCreate: t.canCreate,
        canView: t.canView,
        canEdit: t.canEdit,
        canDelete: t.canDelete,
        canVerify: t.canVerify,
        canApprove: t.canApprove,
        canExport: t.canExport,
        canPrint: t.canPrint
      }))
    : PERMISSION_MODULES.map(module => {
        const defaults = ROLE_PERMISSIONS[roleName as keyof typeof ROLE_PERMISSIONS] || ROLE_PERMISSIONS.Employee;
        return {
          module,
          canView: true,
          canCreate: defaults.canCreate,
          canEdit: defaults.canEdit,
          canDelete: defaults.canDelete,
          canVerify: defaults.canVerify,
          canApprove: defaults.canApprove,
          canExport: defaults.canExport,
          canPrint: defaults.canPrint
        };
      });

  // 2. Upsert permissions for user
  await Promise.all(
    modulesToSeed.map((perm) =>
      (prisma.userPermission as any).upsert({
        where: { userId_module: { userId, module: perm.module } },
        update: perm,
        create: { userId, ...perm },
      })
    )
  );
}

export class OwnerController {
  // Get companies assigned to this owner
  async getMyCompanies(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as any).id;

    // Get companies where this user is an owner
    const userCompanies = await prisma.userCompany.findMany({
      where: { userId },
      include: { company: true },
    });

    const companies = await Promise.all(userCompanies.map(async (uc) => {
      // Count users who have the 'Owner' role in this company
      const ownersCount = await prisma.user.count({
        where: {
          userCompanies: { some: { companyId: uc.company.id } },
          userRoles: { some: { role: { is: { name: 'Owner' } } } }
        }
      });

      // Count users who do NOT have the 'Owner' role in this company
      const employeesCount = await prisma.user.count({
        where: {
          userCompanies: { some: { companyId: uc.company.id } },
          userRoles: { none: { role: { is: { name: 'Owner' } } } }
        }
      });

      return {
        id: uc.company.id,
        code: uc.company.code,
        name: uc.company.name,
        logoUrl: uc.company.logoUrl,
        address: uc.company.address,
        city: uc.company.city,
        country: uc.company.country,
        phone: uc.company.phone,
        email: uc.company.email,
        isActive: uc.company.isActive,
        isDefault: uc.isDefault,
        ownersCount,
        employeesCount,
      };
    }));

    return reply.send({ success: true, data: companies });
  }

  private async saveLogo(file: any): Promise<string | null> {
    if (!file) return null;
    
    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'uploads/logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(file.filename);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filepath = path.join(uploadDir, filename);

    await pump(file.file, fs.createWriteStream(filepath));
    return `/uploads/logos/${filename}`;
  }

  // Update company details
  async updateCompany(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;

    // Verify owner has access to this company
    const userCompany = await prisma.userCompany.findFirst({
      where: { userId, companyId: id },
    });

    if (!userCompany) {
      throw new ForbiddenError('You do not have access to this company');
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundError('Company not found');
    }

    const parts = request.parts();
    const data: any = {};
    let logoUrl = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.fieldname === 'logo') {
          logoUrl = await this.saveLogo(part);
        }
      } else {
        data[part.fieldname] = part.value;
      }
    }

    const updated = await prisma.company.update({
      where: { id },
      data: {
        name: data.name ?? company.name,
        logoUrl: logoUrl ?? data.logoUrl ?? company.logoUrl,
        address: data.address ?? company.address,
        city: data.city ?? company.city,
        country: data.country ?? company.country,
        phone: data.phone ?? company.phone,
        email: data.email ?? company.email,
        website: data.website ?? company.website,
      },
    });

    return reply.send({ success: true, data: updated });
  }

  // Add owner to company
  async addOwnerToCompany(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { 
      email,
      ownerEmail, 
      firstName, 
      lastName, 
      password, 
      ownershipPercentage = 0,
      fatherMotherName,
      nidPassport,
      mobile,
      permanentAddress,
      ownershipType,
      joiningDate,
      openingCapital = 0,
      tin,
      din
    } = request.body as any;
    
    const targetEmail = ownerEmail || email;
    if (!targetEmail) throw new ValidationError('Owner email is required');
    const requesterId = (request.user as any).id;

    // Verify requester has canManageOwners permission
    const requesterAccess = await (prisma.userCompany as any).findFirst({
      where: { userId: requesterId, companyId },
    });

    if (!requesterAccess || (!requesterAccess.isMainOwner && !requesterAccess.canManageOwners)) {
      throw new ForbiddenError('You do not have permission to manage owners');
    }

    // Find or create user
    let owner = await (prisma.user as any).findFirst({
      where: { email: targetEmail, deletedAt: null },
      include: { userRoles: { include: { role: true } } }
    });

    if (!owner) {
      if (!firstName || !password) {
        throw new ConflictError('User not found. Please provide name and password to register a new user.');
      }

      // Create new user with Owner role
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Get Owner role
      const ownerRole = await prisma.role.findFirst({
        where: { name: 'Owner' }
      });

      if (!ownerRole) {
        throw new NotFoundError('Owner role not found in database');
      }

      owner = await prisma.user.create({
        data: {
          email: targetEmail,
          password: hashedPassword,
          firstName,
          lastName: lastName || '',
          userRoles: {
            create: {
              roleId: ownerRole.id
            }
          }
        },
        include: { userRoles: { include: { role: true } } }
      });
    }

    // Ensure user has Owner role
    const isOwner = owner.userRoles.some((ur) => ur.role.name === 'Owner');
    if (!isOwner) {
      // Add owner role if missing? For now, just error out to be safe or add it.
      // Usually, if we're registering a co-owner, we expect them to be an owner.
      const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
      if (ownerRole) {
        await prisma.userRole.create({
          data: { userId: owner.id, roleId: ownerRole.id }
        });
      }
    }

    // Seed full Owner permissions
    await seedDefaultPermissions(owner.id, 'Owner');

    const ownerId = owner.id;

    // Check 100% ownership cap
    const companyOwners = await (prisma.userCompany as any).findMany({
      where: { companyId }
    });
    const currentTotal = companyOwners.reduce((sum: number, co: any) => sum + (co.ownershipPercentage || 0), 0);
    const newTotal = currentTotal + Number(ownershipPercentage);
    
    if (newTotal > 100) {
      throw new ConflictError(`Total ownership cannot exceed 100%. Current total shares: ${currentTotal}%. You are trying to add ${ownershipPercentage}%, which would total ${newTotal}%. Please reduce the share of another owner or adjust the current entry.`);
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundError('Company not found');

    const shortId = ownerId.split('-')[0].toUpperCase();

    const userCompany = await (prisma.userCompany as any).create({
      data: { 
        userId: ownerId, 
        companyId, 
        isDefault: false,
        ownershipPercentage: Number(ownershipPercentage),
        isMainOwner: false,
        canEditCompany: false,
        canDeleteCompany: false,
        canManageOwners: false,
        fatherMotherName,
        nidPassport,
        mobile,
        permanentAddress,
        ownershipType,
        joiningDate: joiningDate ? new Date(joiningDate) : null,
        openingCapital: Number(openingCapital),
        currentCapitalBalance: Number(openingCapital),
        capitalAccountCode: `CAP-O-${company.code}-${shortId}`,
        drawingAccountCode: `DRW-O-${company.code}-${shortId}`,
        tin,
        din,
      },
    });

    // --- AUTOMATION: Handle Equity & Journal ---
    if (Number(openingCapital) > 0) {
      await EquityService.handleOpeningCapital(companyId, ownerId, Number(openingCapital), requesterId);
    }

    return reply.send({ success: true, message: 'Owner added to company' });
  }

  // Remove owner from company
  async removeOwnerFromCompany(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, ownerId } = request.params as { id: string; ownerId: string };
    const userId = (request.user as any).id;

    // Verify requester has canManageOwners permission
    const requesterAccess = await (prisma.userCompany as any).findFirst({
      where: { userId, companyId },
    });

    if (!requesterAccess || (!requesterAccess.isMainOwner && !requesterAccess.canManageOwners)) {
      throw new ForbiddenError('You do not have permission to manage owners');
    }

    await (prisma.userCompany as any).delete({
      where: { userId_companyId: { userId: ownerId, companyId } },
    });

    return reply.send({ success: true, message: 'Owner removed from company' });
  }


  // Create a new company
  async createCompany(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as any).id;
    
    const parts = request.parts();
    const data: any = {};
    let logoUrl = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.fieldname === 'logo') {
          logoUrl = await this.saveLogo(part);
        }
      } else {
        data[part.fieldname] = part.value;
      }
    }

    const { name, code, ...info } = data;

    // Check if code exists
    const existing = await prisma.company.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictError('Company code already exists');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userCompanies: true }
    });

    if (user) {
      const mainBaseCompanies = user.userCompanies.filter(c => c.isMainOwner).length;
      if (mainBaseCompanies >= user.maxCompanies) {
        throw new ForbiddenError(`You have reached your limit of ${user.maxCompanies} companies.`);
      }
    }

    const company = await (prisma.company as any).create({
      data: {
        name,
        code,
        ...info,
        logoUrl,
        userCompanies: {
          create: {
            userId,
            isMainOwner: true,
            canEditCompany: true,
            canDeleteCompany: true,
            canManageOwners: true,
            ownershipPercentage: 100,
            isDefault: true,
            openingCapital: Number(data.openingCapital || 0),
            currentCapitalBalance: Number(data.openingCapital || 0),
          }
        }
      }
    });

    // Seed default COA based on category
    await CoaController.initializeCompanyCOA(company.id, data.category || 'GENERAL');

    // --- AUTOMATION: Handle Equity & Journal ---
    if (Number(data.openingCapital || 0) > 0) {
      await EquityService.handleOpeningCapital(company.id, userId, Number(data.openingCapital), userId);
    }

    return reply.send({ success: true, data: company });
  }

  // Get co-owners for a company
  async getCoOwners(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const access = await (prisma.userCompany as any).findFirst({
      where: { userId, companyId },
    });

    if (!access) {
      throw new ForbiddenError('No access to this company');
    }

    // Only return users who have the 'Owner' role
    const owners = await (prisma.userCompany as any).findMany({
      where: { 
        companyId,
        user: {
          isSystem: false,
          userRoles: { some: { role: { is: { name: 'Owner' } } } }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    return reply.send({ success: true, data: owners });
  }

  // Update co-owner permissions and percentage
  async updateCoOwner(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, ownerId } = request.params as { id: string; ownerId: string };
    const requesterId = (request.user as any).id;
    const { 
      ownershipPercentage, 
      canEditCompany, 
      canDeleteCompany, 
      canManageOwners,
      fatherMotherName,
      nidPassport,
      mobile,
      permanentAddress,
      ownershipType,
      joiningDate,
      openingCapital,
      tin,
      din
    } = request.body as any;

    // Verify requester has permission
    const requesterAccess = await (prisma.userCompany as any).findFirst({
      where: { userId: requesterId, companyId },
    });

    if (!requesterAccess || (!requesterAccess.isMainOwner && !requesterAccess.canManageOwners)) {
      throw new ForbiddenError('You do not have permission to manage owners');
    }

    // Check if target owner exists in this company
    const targetOwner = await (prisma.userCompany as any).findUnique({
      where: { userId_companyId: { userId: ownerId, companyId } },
    });

    if (!targetOwner) {
      throw new NotFoundError('Owner not found in this company');
    }

    // Protection for System users
    const targetUser = await prisma.user.findUnique({ where: { id: ownerId } });
    if ((targetUser as any)?.isSystem) {
      throw new ForbiddenError('System accounts cannot be modified by standard owners');
    }

    // Prevent non-main owners from editing the main owner
    if (targetOwner.isMainOwner && requesterId !== ownerId && !requesterAccess.isMainOwner) {
       throw new ForbiddenError('You cannot edit the main owner');
    }

    // Check 100% ownership cap if percentage is changing
    if (ownershipPercentage !== undefined) {
      const companyOwners = await (prisma.userCompany as any).findMany({
        where: { companyId }
      });
      const currentTotal = companyOwners.reduce((sum: number, co: any) => 
        sum + (co.userId === ownerId ? 0 : (co.ownershipPercentage || 0)), 0);
      const newTotal = currentTotal + Number(ownershipPercentage);

      if (newTotal > 100) {
        throw new ConflictError(`Total ownership cannot exceed 100%. The other owners currently hold ${currentTotal}%. This update to ${ownershipPercentage}% would bring the total to ${newTotal}%. Please reduce another owner's share before increasing this one.`);
      }
    }

    const updated = await (prisma.userCompany as any).update({
      where: { userId_companyId: { userId: ownerId, companyId } },
      data: {
        ownershipPercentage: ownershipPercentage !== undefined ? Number(ownershipPercentage) : undefined,
        canEditCompany: canEditCompany ?? targetOwner.canEditCompany,
        canDeleteCompany: canDeleteCompany ?? targetOwner.canDeleteCompany,
        canManageOwners: canManageOwners ?? targetOwner.canManageOwners,
        fatherMotherName: fatherMotherName ?? targetOwner.fatherMotherName,
        nidPassport: nidPassport ?? targetOwner.nidPassport,
        mobile: mobile ?? targetOwner.mobile,
        permanentAddress: permanentAddress ?? targetOwner.permanentAddress,
        ownershipType: ownershipType ?? targetOwner.ownershipType,
        joiningDate: joiningDate ? new Date(joiningDate) : targetOwner.joiningDate,
        openingCapital: openingCapital !== undefined ? Number(openingCapital) : targetOwner.openingCapital,
        tin: tin ?? targetOwner.tin,
        din: din ?? targetOwner.din,
      }
    });

    return reply.send({ success: true, data: updated });
  }

  // Delete employee
  async deleteEmployee(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const requesterId = (request.user as any).id;

    // Find the employee and their companies
    const employee = await prisma.user.findUnique({
      where: { id },
      include: { userCompanies: true }
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    if ((employee as any).isSystem) {
      throw new ForbiddenError('System accounts cannot be deleted by standard owners');
    }

    // Verify requester has permission in at least one of the employee's companies
    const sharedCompanyIds = employee.userCompanies.map(uc => uc.companyId);
    const requesterAccess = await (prisma.userCompany as any).findFirst({
      where: { 
        userId: requesterId, 
        companyId: { in: sharedCompanyIds },
        isMainOwner: true // Only main owners can delete employees for safety
      },
    });

    if (!requesterAccess) {
      throw new ForbiddenError('You do not have permission to delete this employee. Only Main Owners can perform this action.');
    }

    // Delete the user record (this will cascade to UserCompany, UserRole, etc.)
    await prisma.user.delete({
      where: { id }
    });

    return reply.send({ success: true, message: 'Employee deleted successfully' });
  }

  // Get employees in owner's companies
  async getEmployees(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as any).id;

    // Get companies where user is owner
    const userCompanies = await prisma.userCompany.findMany({
      where: { userId },
      select: { companyId: true },
    });

    const companyIds = userCompanies.map((uc) => uc.companyId);

    // Get all users in these companies, excluding system accounts
    const employees = await prisma.user.findMany({
      where: {
        userCompanies: { some: { companyId: { in: companyIds } } },
        isSystem: false,
        userRoles: {
          none: { role: { name: 'Owner' } } // Exclude Owners from employee list
        }
      } as any,
      include: {
        userRoles: { include: { role: true } },
        userCompanies: { include: { company: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Format all users (including owners)
    const formatted = employees
      .map((e: any) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        isActive: e.isActive,
        role: e.userRoles[0]?.role.name || 'User',
        companies: e.userCompanies.map((uc: any) => ({
          id: uc.company.id,
          name: uc.company.name,
          code: uc.company.code,
        })),
        manager: e.manager
          ? { id: e.manager.id, name: `${e.manager.firstName} ${e.manager.lastName}` }
          : null,
        permissions: [],
      }));

    return reply.send({ success: true, data: formatted });
  }

  // Create employee
  async createEmployee(request: FastifyRequest, reply: FastifyReply) {
    const { email, password, firstName, lastName, roleId, companyIds } = request.body as any;
    const userId = (request.user as any).id;

    // Get owner's companies
    const ownerCompanies = await prisma.userCompany.findMany({
      where: { userId },
      select: { companyId: true },
    });
    const ownerCompanyIds = ownerCompanies.map((c) => c.companyId);

    // Verify companies belong to owner
    const validCompanies = companyIds?.filter((cId: string) => ownerCompanyIds.includes(cId)) || [];

    if (validCompanies.length === 0) {
      throw new ValidationError('At least one valid company must be assigned to the employee');
    }

    if (!roleId) {
      throw new ValidationError('A role must be assigned to the employee');
    }

    // Check if email exists
    // Check if email exists (active accounts only)
    const existing = await (prisma.user as any).findFirst({ 
      where: { email, deletedAt: null } 
    });
    if (existing) {
      throw new ConflictError('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        userRoles: roleId ? { create: { roleId } } : undefined,
        userCompanies: {
          create: validCompanies.map((cId: string) => ({
            companyId: cId,
            isDefault: validCompanies.length === 1,
          })),
        },
      },
      include: { userRoles: { include: { role: true } }, userCompanies: { include: { company: true } } } },
    );

    // Seed default permissions for the assigned role
    if (roleId) {
      const roleName = user.userRoles[0]?.role?.name;
      if (roleName) await seedDefaultPermissions(user.id, roleName);
    }

    const { password: _, ...userWithoutPassword } = user;
    return reply.status(201).send({ success: true, data: userWithoutPassword });
  }

  // Update employee
  async updateEmployee(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { email, password, firstName, lastName, roleId, companyIds } = request.body as any;
    const userId = (request.user as any).id;

    // Verify employee exists and belongs to owner's companies
    const employee = await prisma.user.findUnique({
      where: { id },
      include: { userCompanies: true },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    if ((employee as any).isSystem) {
      throw new ForbiddenError('System accounts cannot be modified by standard owners');
    }

    // Get owner's companies to verify access
    const ownerCompanies = await prisma.userCompany.findMany({
      where: { userId },
      select: { companyId: true },
    });
    const ownerCompanyIds = ownerCompanies.map((c) => c.companyId);

    // Filter valid companies (only those owned by the owner)
    const validCompanies = companyIds?.filter((cId: string) => ownerCompanyIds.includes(cId)) || [];

    // Prepare update data
    const updateData: any = {
      email: email ?? employee.email,
      firstName: firstName ?? employee.firstName,
      lastName: lastName ?? employee.lastName,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user basic info
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Update role if provided and re-seed permissions for the new role
    if (roleId) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      await prisma.userRole.create({ data: { userId: id, roleId } });
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (role) await seedDefaultPermissions(id, role.name);
    }

    // Update companies if provided
    if (companyIds) {
      // Remove old associations
      await prisma.userCompany.deleteMany({ where: { userId: id } });
      // Add new associations
      await prisma.userCompany.createMany({
        data: validCompanies.map((cId: string) => ({
          userId: id,
          companyId: cId,
          isDefault: validCompanies.length === 1,
        })),
      });
    }

    const { password: _, ...userWithoutPassword } = updatedUser;
    return reply.send({ success: true, data: userWithoutPassword });
  }

  // Sync default permissions for ALL existing users based on their current role (run once)
  async syncAllPermissions(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as any).id;

    // Only owner/admin of at least one company can run this
    const ownerCompanies = await prisma.userCompany.findMany({
      where: { userId },
      select: { companyId: true },
    });
    if (ownerCompanies.length === 0) {
      return reply.status(403).send({ success: false, error: { message: 'Access denied' } });
    }

    // Get all users in the owner's companies
    const companyIds = ownerCompanies.map((c) => c.companyId);
    const users = await prisma.user.findMany({
      where: { userCompanies: { some: { companyId: { in: companyIds } } } },
      include: { userRoles: { include: { role: true } } },
    });

    let synced = 0;
    for (const u of users) {
      const roleName = u.userRoles[0]?.role?.name;
      if (roleName) {
        await seedDefaultPermissions(u.id, roleName);
        synced++;
      }
    }

    return reply.send({ success: true, message: `Permissions synced for ${synced} user(s)` });
  }

  // Update employee permissions
  async updateEmployeePermissions(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { 
      module, 
      canCreate, canView, canEdit, canDelete,
      canVerify, canApprove, canExport, canPrint 
    } = request.body as any;

    // Upsert permission
    const permission = await (prisma.userPermission as any).upsert({
      where: { userId_module: { userId: id, module } },
      update: { 
        canCreate, canView, canEdit, canDelete,
        canVerify, canApprove, canExport, canPrint 
      },
      create: { 
        userId: id, module, 
        canCreate, canView, canEdit, canDelete,
        canVerify, canApprove, canExport, canPrint 
      },
    });

    return reply.send({ success: true, data: permission });
  }

  // Bulk update employee permissions
  async bulkUpdateEmployeePermissions(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { permissions } = request.body as { permissions: any[] };

    if (!Array.isArray(permissions)) {
      throw new ValidationError('Permissions must be an array');
    }

    // Use a transaction for reliability
    await prisma.$transaction(
      permissions.map((perm) =>
        (prisma.userPermission as any).upsert({
          where: { userId_module: { userId: id, module: perm.module } },
          update: {
            canCreate: perm.canCreate,
            canView: perm.canView,
            canEdit: perm.canEdit,
            canDelete: perm.canDelete,
            canVerify: perm.canVerify,
            canApprove: perm.canApprove,
            canExport: perm.canExport,
            canPrint: perm.canPrint,
          },
          create: {
            userId: id,
            module: perm.module,
            canCreate: perm.canCreate,
            canView: perm.canView,
            canEdit: perm.canEdit,
            canDelete: perm.canDelete,
            canVerify: perm.canVerify,
            canApprove: perm.canApprove,
            canExport: perm.canExport,
            canPrint: perm.canPrint,
          },
        })
      )
    );

    return reply.send({ success: true, message: 'Permissions updated successfully' });
  }

  // Set employee's reporting manager
  async setEmployeeManager(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { managerId } = request.body as { managerId: string | null };

    await prisma.user.update({
      where: { id },
      data: { managerId: managerId || null },
    });

    return reply.send({ success: true, message: 'Manager updated successfully' });
  }

  // Toggle employee status
  async toggleEmployeeStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { isActive } = request.body as { isActive: boolean };

    await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    return reply.send({ success: true, message: `Employee ${isActive ? 'activated' : 'deactivated'} successfully` });
  }

  // Reset employee password
  async resetEmployeePassword(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { password } = request.body as { password: string };

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return reply.send({ success: true, message: 'Password reset successfully' });
  }
}
