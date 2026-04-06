import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '../../config/database';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';

export class AdminController {
  // Generate company code from name
  private generateCompanyCode(name: string): string {
    const initials = name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    const uniqueId = randomUUID().split('-')[0].toUpperCase();
    return `${initials}-${uniqueId}`;
  }

  async getCompanies(request: FastifyRequest, reply: FastifyReply) {
    const companies = await prisma.company.findMany({
      include: {
        userCompanies: {
          include: {
            user: {
              include: {
                userRoles: {
                  include: {
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = companies.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      logoUrl: c.logoUrl,
      address: c.address,
      city: c.city,
      country: c.country,
      phone: c.phone,
      email: c.email,
      isActive: c.isActive,
      owners: c.userCompanies
        .filter((uc) => uc.user.userRoles.some((ur) => ur.role.name === 'Owner'))
        .map((uc) => ({
          id: uc.user.id,
          name: `${uc.user.firstName} ${uc.user.lastName}`,
          email: uc.user.email,
        })),
      createdAt: c.createdAt,
    }));

    return reply.send({ success: true, data: formatted });
  }

  async createCompany(request: FastifyRequest, reply: FastifyReply) {
    const { name, address, city, country, phone, email, website, logoUrl, ownerId } = request.body as any;

    // Generate unique company code
    let code = this.generateCompanyCode(name);
    let counter = 0;
    while (await prisma.company.findUnique({ where: { code } })) {
      const uniqueId = randomUUID().split('-')[0].toUpperCase();
      code = `${name.slice(0, 2).toUpperCase()}-${uniqueId}${counter}`;
      counter++;
    }

    const company = await prisma.company.create({
      data: {
        code,
        name,
        address,
        city,
        country,
        phone,
        email,
        website,
        logoUrl,
        isActive: true,
      },
    });

    // Create default branch
    const branchCode = `${code}-BR001`;
    await prisma.branch.upsert({
      where: { companyId_code: { companyId: company.id, code: branchCode } },
      update: {},
      create: {
        companyId: company.id,
        code: branchCode,
        name: 'Main Branch',
        isActive: true,
      },
    });

    // Create default account types
    const accountTypes = [
      { name: 'ASSET', type: 'DEBIT' },
      { name: 'LIABILITY', type: 'CREDIT' },
      { name: 'EQUITY', type: 'CREDIT' },
      { name: 'INCOME', type: 'CREDIT' },
      { name: 'EXPENSE', type: 'DEBIT' },
    ];

    for (const at of accountTypes) {
      await (prisma.accountType as any).upsert({
        where: { name: at.name },
        update: {},
        create: { name: at.name, type: at.type },
      });
    }

    // Assign owner to company if provided
    if (ownerId) {
      const user = await prisma.user.findUnique({
        where: { id: ownerId },
        include: { userCompanies: true }
      });
      if (!user) throw new NotFoundError('Owner not found');
      
      const mainBaseCompanies = user.userCompanies.filter(c => c.isMainOwner).length;
      if (mainBaseCompanies >= user.maxCompanies) {
        throw new ConflictError(`This owner has reached their maximum limit of ${user.maxCompanies} companies.`);
      }

      // Ensure user has Owner role
      const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
      if (ownerRole) {
        const hasRole = await prisma.userRole.findFirst({
          where: { userId: ownerId, roleId: ownerRole.id }
        });
        if (!hasRole) {
          await prisma.userRole.create({
            data: { userId: ownerId, roleId: ownerRole.id }
          });
        }
      }

      await (prisma.userCompany as any).upsert({
        where: { userId_companyId: { userId: ownerId, companyId: company.id } },
        update: { 
          isDefault: true,
          isMainOwner: true,
          ownershipPercentage: 100,
          canEditCompany: true,
          canDeleteCompany: true,
          canManageOwners: true
        },
        create: { 
          userId: ownerId, 
          companyId: company.id, 
          isDefault: true,
          isMainOwner: true,
          ownershipPercentage: 100,
          canEditCompany: true,
          canDeleteCompany: true,
          canManageOwners: true
        },
      });
    }

    // Create default Chart of Accounts (COA)
    const allAccountTypes = await prisma.accountType.findMany();
    const assetType = allAccountTypes.find(at => at.name === 'ASSET');
    const liabilityType = allAccountTypes.find(at => at.name === 'LIABILITY');
    const equityType = allAccountTypes.find(at => at.name === 'EQUITY');
    const incomeType = allAccountTypes.find(at => at.name === 'INCOME');
    const expenseType = allAccountTypes.find(at => at.name === 'EXPENSE');

    const defaultAccounts = [
      // Asset accounts
      { code: '1000', name: 'Cash in Hand', typeId: assetType?.id, category: 'CASH' },
      { code: '1010', name: 'Cash at Bank', typeId: assetType?.id, category: 'BANK' },
      { code: '1100', name: 'Accounts Receivable', typeId: assetType?.id, category: 'AR' },
      { code: '1200', name: 'Inventory', typeId: assetType?.id, category: null },
      { code: '1500', name: 'Fixed Assets', typeId: assetType?.id, category: null },
      
      // Liability accounts
      { code: '2000', name: 'Accounts Payable', typeId: liabilityType?.id, category: 'AP' },
      { code: '2100', name: 'Notes Payable', typeId: liabilityType?.id, category: null },
      { code: '2200', name: 'Accrued Expenses', typeId: liabilityType?.id, category: null },
      
      // Equity accounts
      { code: '3000', name: 'Owner\'s Capital', typeId: equityType?.id, category: null },
      { code: '3100', name: 'Retained Earnings', typeId: equityType?.id, category: null },
      
      // Income accounts
      { code: '4000', name: 'Revenue', typeId: incomeType?.id, category: null },
      { code: '4010', name: 'Sales Revenue', typeId: incomeType?.id, category: null },
      { code: '4100', name: 'Service Revenue', typeId: incomeType?.id, category: null },
      { code: '4200', name: 'Other Income', typeId: incomeType?.id, category: null },
      
      // Expense accounts
      { code: '5000', name: 'Expense', typeId: expenseType?.id, category: null },
      { code: '5010', name: 'Cost of Goods Sold', typeId: expenseType?.id, category: null },
      { code: '5100', name: 'Salaries & Wages', typeId: expenseType?.id, category: null },
      { code: '5200', name: 'Rent Expense', typeId: expenseType?.id, category: null },
      { code: '5300', name: 'Utilities Expense', typeId: expenseType?.id, category: null },
      { code: '5400', name: 'Office Supplies', typeId: expenseType?.id, category: null },
      { code: '5500', name: 'Depreciation Expense', typeId: expenseType?.id, category: null },
      { code: '5600', name: 'Transportation Expense', typeId: expenseType?.id, category: null },
      { code: '5700', name: 'Communication Expense', typeId: expenseType?.id, category: null },
      { code: '5800', name: 'Professional Fees', typeId: expenseType?.id, category: null },
      { code: '5900', name: 'Miscellaneous Expense', typeId: expenseType?.id, category: null },
    ];

    for (const acc of defaultAccounts) {
      if (acc.typeId) {
        await prisma.account.create({
          data: {
            code: `${company.code}-${acc.code}`,
            name: acc.name,
            companyId: company.id,
            accountTypeId: acc.typeId,
            category: acc.category,
            isActive: true,
            openingBalance: 0,
            currentBalance: 0,
          }
        });
      }
    }

    // Create default roles for the company
    const roles = ['Manager', 'Accountant', 'DataEntryOperator'];
    for (const roleName of roles) {
      const existingRole = await prisma.role.findFirst({ where: { name: roleName } });
      if (!existingRole) {
        await prisma.role.create({
          data: {
            name: roleName,
            description: `${roleName} role for ${company.name}`,
            isSystem: false,
          }
        });
      }
    }

    return reply.status(201).send({ success: true, data: company });
  }

  async updateCompany(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { ownerId, ...data } = request.body as any;

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundError('Company not found');
    }

    const updated = await prisma.company.update({
      where: { id },
      data: {
        name: data.name ?? company.name,
        address: data.address ?? company.address,
        city: data.city ?? company.city,
        country: data.country ?? company.country,
        phone: data.phone ?? company.phone,
        email: data.email ?? company.email,
        website: data.website ?? company.website,
        logoUrl: data.logoUrl ?? company.logoUrl,
      },
    });

    // Handle owner assignment if ownerId is provided
    if (ownerId !== undefined) {
      // First, remove existing owner assignments for this company
      // We only allow one owner for now based on the UI
      await prisma.userCompany.deleteMany({
        where: {
          companyId: id,
          user: {
            userRoles: {
              some: {
                role: {
                  name: 'Owner',
                },
              },
            },
          },
        },
      });

      // Then assign the new owner if ownerId is not empty
      if (ownerId) {
        // Ensure user has Owner role
        const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
        if (ownerRole) {
          const hasRole = await prisma.userRole.findFirst({
            where: { userId: ownerId, roleId: ownerRole.id }
          });
          if (!hasRole) {
            await prisma.userRole.create({
              data: { userId: ownerId, roleId: ownerRole.id }
            });
          }
        }

        await (prisma.userCompany as any).upsert({
          where: { userId_companyId: { userId: ownerId, companyId: id } },
          update: { 
            isDefault: true,
            isMainOwner: true,
            ownershipPercentage: 100,
            canEditCompany: true,
            canDeleteCompany: true,
            canManageOwners: true
          },
          create: { 
            userId: ownerId, 
            companyId: id, 
            isDefault: true,
            isMainOwner: true,
            ownershipPercentage: 100,
            canEditCompany: true,
            canDeleteCompany: true,
            canManageOwners: true
          },
        });
      }
    }

    return reply.send({ success: true, data: updated });
  }

  async deleteCompany(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundError('Company not found');
    }

    await prisma.company.delete({ where: { id } });

    return reply.send({ success: true, message: 'Company deleted successfully' });
  }

  async toggleCompanyStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { isActive } = request.body as { isActive: boolean };

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundError('Company not found');
    }

    const updated = await prisma.company.update({
      where: { id },
      data: { isActive },
    });

    return reply.send({ success: true, data: updated });
  }

  async getOwners(request: FastifyRequest, reply: FastifyReply) {
    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (!ownerRole) {
      return reply.send({ success: true, data: [] });
    }

    const owners = await prisma.user.findMany({
      where: {
        userRoles: { some: { roleId: ownerRole.id } },
      },
      include: {
        userRoles: { include: { role: true } },
        userCompanies: { include: { company: true } },
      },
    });

    const formatted = owners.map((o) => ({
      id: o.id,
      firstName: o.firstName,
      lastName: o.lastName,
      email: o.email,
      isActive: o.isActive,
      maxCompanies: o.maxCompanies,
      companies: o.userCompanies.map((uc) => ({
        id: uc.company.id,
        name: uc.company.name,
        code: uc.company.code,
      })),
    }));

    return reply.send({ success: true, data: formatted });
  }

  async createOwner(request: FastifyRequest, reply: FastifyReply) {
    const { email, password, firstName, lastName } = request.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    };

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get Owner role
    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (!ownerRole) {
      throw new NotFoundError('Owner role not found');
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        maxCompanies: 5,
        userRoles: {
          create: { roleId: ownerRole.id },
        },
      },
      include: { userRoles: { include: { role: true } } },
    });

    const { password: _, ...userWithoutPassword } = user;

    return reply.status(201).send({ success: true, data: userWithoutPassword });
  }

  async deleteOwner(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('Owner not found');
    }

    // Delete user (cascade will handle relations)
    await prisma.user.delete({ where: { id } });

    return reply.send({ success: true, message: 'Owner deleted successfully' });
  }

  async resetOwnerPassword(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { password } = request.body as { password: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return reply.send({ success: true, message: 'Password reset successfully' });
  }
}
