"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
class AdminController {
    // Generate company code from name
    generateCompanyCode(name) {
        const initials = name
            .split(' ')
            .map((word) => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        const uniqueId = (0, crypto_1.randomUUID)().split('-')[0].toUpperCase();
        return `${initials}-${uniqueId}`;
    }
    // Reusable COA generation logic
    async ensureCOA(companyId, companyCode) {
        const existingAccounts = await database_1.default.account.count({ where: { companyId } });
        if (existingAccounts > 0)
            return; // Already has COA
        const allAccountTypes = await database_1.default.accountType.findMany();
        const assetType = allAccountTypes.find(at => at.name === 'ASSET');
        const liabilityType = allAccountTypes.find(at => at.name === 'LIABILITY');
        const equityType = allAccountTypes.find(at => at.name === 'EQUITY');
        const incomeType = allAccountTypes.find(at => at.name === 'INCOME');
        const expenseType = allAccountTypes.find(at => at.name === 'EXPENSE');
        const defaultAccounts = [
            { code: '1000', name: 'Cash in Hand', typeId: assetType?.id, category: 'CASH' },
            { code: '1010', name: 'Cash at Bank', typeId: assetType?.id, category: 'BANK' },
            { code: '1100', name: 'Accounts Receivable', typeId: assetType?.id, category: 'AR' },
            { code: '1200', name: 'Inventory', typeId: assetType?.id, category: null },
            { code: '1500', name: 'Fixed Assets', typeId: assetType?.id, category: null },
            { code: '2000', name: 'Accounts Payable', typeId: liabilityType?.id, category: 'AP' },
            { code: '2100', name: 'Notes Payable', typeId: liabilityType?.id, category: null },
            { code: '2200', name: 'Accrued Expenses', typeId: liabilityType?.id, category: null },
            { code: '3000', name: 'Owner\'s Capital', typeId: equityType?.id, category: null },
            { code: '3100', name: 'Retained Earnings', typeId: equityType?.id, category: null },
            { code: '4000', name: 'Revenue', typeId: incomeType?.id, category: null },
            { code: '4010', name: 'Sales Revenue', typeId: incomeType?.id, category: null },
            { code: '4100', name: 'Service Revenue', typeId: incomeType?.id, category: null },
            { code: '4200', name: 'Other Income', typeId: incomeType?.id, category: null },
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
                await database_1.default.account.create({
                    data: {
                        code: `${companyCode}-${acc.code}`,
                        name: acc.name,
                        companyId: companyId,
                        accountTypeId: acc.typeId,
                        category: acc.category,
                        isActive: true,
                        openingBalance: 0,
                        currentBalance: 0,
                    }
                });
            }
        }
    }
    async getCompanies(request, reply) {
        const companies = await database_1.default.company.findMany({
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
    async createCompany(request, reply) {
        const { name, address, city, country, phone, email, website, logoUrl, ownerId } = request.body;
        // Generate unique company code
        let code = this.generateCompanyCode(name);
        let counter = 0;
        while (await database_1.default.company.findUnique({ where: { code } })) {
            const uniqueId = (0, crypto_1.randomUUID)().split('-')[0].toUpperCase();
            code = `${name.slice(0, 2).toUpperCase()}-${uniqueId}${counter}`;
            counter++;
        }
        const company = await database_1.default.company.create({
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
        await database_1.default.branch.upsert({
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
            await database_1.default.accountType.upsert({
                where: { name: at.name },
                update: {},
                create: { name: at.name, type: at.type },
            });
        }
        // Assign owner to company if provided
        if (ownerId) {
            const user = await database_1.default.user.findUnique({
                where: { id: ownerId },
                include: { userCompanies: true }
            });
            if (!user)
                throw new errorHandler_1.NotFoundError('Owner not found');
            const mainBaseCompanies = user.userCompanies.filter(c => c.isMainOwner).length;
            if (mainBaseCompanies >= user.maxCompanies) {
                throw new errorHandler_1.ConflictError(`This owner has reached their maximum limit of ${user.maxCompanies} companies.`);
            }
            // Ensure user has Owner role
            const ownerRole = await database_1.default.role.findFirst({ where: { name: 'Owner' } });
            if (ownerRole) {
                const hasRole = await database_1.default.userRole.findFirst({
                    where: { userId: ownerId, roleId: ownerRole.id }
                });
                if (!hasRole) {
                    await database_1.default.userRole.create({
                        data: { userId: ownerId, roleId: ownerRole.id }
                    });
                }
            }
            await database_1.default.userCompany.upsert({
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
        await this.ensureCOA(company.id, company.code);
        // Create default roles for the company
        const roles = ['Manager', 'Accountant', 'DataEntryOperator'];
        for (const roleName of roles) {
            const existingRole = await database_1.default.role.findFirst({ where: { name: roleName } });
            if (!existingRole) {
                await database_1.default.role.create({
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
    async updateCompany(request, reply) {
        const { id } = request.params;
        const { ownerId, ...data } = request.body;
        const company = await database_1.default.company.findUnique({ where: { id } });
        if (!company) {
            throw new errorHandler_1.NotFoundError('Company not found');
        }
        const updated = await database_1.default.company.update({
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
            await database_1.default.userCompany.deleteMany({
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
                const ownerRole = await database_1.default.role.findFirst({ where: { name: 'Owner' } });
                if (ownerRole) {
                    const hasRole = await database_1.default.userRole.findFirst({
                        where: { userId: ownerId, roleId: ownerRole.id }
                    });
                    if (!hasRole) {
                        await database_1.default.userRole.create({
                            data: { userId: ownerId, roleId: ownerRole.id }
                        });
                    }
                }
                await database_1.default.userCompany.upsert({
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
                // Ensure COA exists now that an owner is linked
                await this.ensureCOA(id, company.code);
            }
        }
        return reply.send({ success: true, data: updated });
    }
    async deleteCompany(request, reply) {
        const { id } = request.params;
        const company = await database_1.default.company.findUnique({ where: { id } });
        if (!company) {
            throw new errorHandler_1.NotFoundError('Company not found');
        }
        await database_1.default.company.delete({ where: { id } });
        return reply.send({ success: true, message: 'Company deleted successfully' });
    }
    async toggleCompanyStatus(request, reply) {
        const { id } = request.params;
        const { isActive } = request.body;
        const company = await database_1.default.company.findUnique({ where: { id } });
        if (!company) {
            throw new errorHandler_1.NotFoundError('Company not found');
        }
        const updated = await database_1.default.company.update({
            where: { id },
            data: { isActive },
        });
        return reply.send({ success: true, data: updated });
    }
    async getOwners(request, reply) {
        const ownerRole = await database_1.default.role.findFirst({ where: { name: 'Owner' } });
        if (!ownerRole) {
            return reply.send({ success: true, data: [] });
        }
        const owners = await database_1.default.user.findMany({
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
    async createOwner(request, reply) {
        const { email, password, firstName, lastName } = request.body;
        // Check if user exists
        const existing = await database_1.default.user.findUnique({ where: { email } });
        if (existing) {
            throw new errorHandler_1.ConflictError('Email already exists');
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Get Owner role
        const ownerRole = await database_1.default.role.findFirst({ where: { name: 'Owner' } });
        if (!ownerRole) {
            throw new errorHandler_1.NotFoundError('Owner role not found');
        }
        // Create user
        const user = await database_1.default.user.create({
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
    async deleteOwner(request, reply) {
        const { id } = request.params;
        const user = await database_1.default.user.findUnique({ where: { id } });
        if (!user) {
            throw new errorHandler_1.NotFoundError('Owner not found');
        }
        // Delete user (cascade will handle relations)
        await database_1.default.user.delete({ where: { id } });
        return reply.send({ success: true, message: 'Owner deleted successfully' });
    }
    async resetOwnerPassword(request, reply) {
        const { id } = request.params;
        const { password } = request.body;
        const user = await database_1.default.user.findUnique({ where: { id } });
        if (!user) {
            throw new errorHandler_1.NotFoundError('User not found');
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        await database_1.default.user.update({
            where: { id },
            data: { password: hashedPassword },
        });
        return reply.send({ success: true, message: 'Password reset successfully' });
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=admin.controller.js.map