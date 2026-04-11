"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OwnerController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const stream_1 = require("stream");
const util_1 = require("util");
const pump = (0, util_1.promisify)(stream_1.pipeline);
const PERMISSION_MODULES = [
    'journals', 'invoices', 'bills', 'payments', 'purchase_orders',
    'customers', 'vendors', 'accounts', 'reports', 'employees',
    'lc', 'pi', 'loans', 'products', 'attachments',
    'employee_advances', 'employee_loans', 'employee_expenses',
];
const ROLE_PERMISSIONS = {
    User: { canCreate: false, canView: true, canVerify: false, canApprove: false },
    Accountant: { canCreate: true, canView: true, canVerify: false, canApprove: false },
    Manager: { canCreate: true, canView: true, canVerify: true, canApprove: false },
    Owner: { canCreate: true, canView: true, canVerify: true, canApprove: true },
    Admin: { canCreate: true, canView: true, canVerify: true, canApprove: true },
};
async function seedDefaultPermissions(userId, roleName) {
    const perms = ROLE_PERMISSIONS[roleName];
    if (!perms)
        return; // Unknown role — skip
    await Promise.all(PERMISSION_MODULES.map((module) => database_1.default.userPermission.upsert({
        where: { userId_module: { userId, module } },
        update: perms,
        create: { userId, module, ...perms },
    })));
}
class OwnerController {
    // Get companies assigned to this owner
    async getMyCompanies(request, reply) {
        const userId = request.user.id;
        // Get companies where this user is an owner
        const userCompanies = await database_1.default.userCompany.findMany({
            where: { userId },
            include: { company: true },
        });
        const companies = await Promise.all(userCompanies.map(async (uc) => {
            // Count users who have the 'Owner' role in this company
            const ownersCount = await database_1.default.user.count({
                where: {
                    userCompanies: { some: { companyId: uc.company.id } },
                    userRoles: { some: { role: { name: 'Owner' } } }
                }
            });
            // Count users who do NOT have the 'Owner' role in this company
            const employeesCount = await database_1.default.user.count({
                where: {
                    userCompanies: { some: { companyId: uc.company.id } },
                    userRoles: { none: { role: { name: 'Owner' } } }
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
    async saveLogo(file) {
        if (!file)
            return null;
        // Ensure upload directory exists
        const uploadDir = path_1.default.join(process.cwd(), 'uploads/logos');
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        const ext = path_1.default.extname(file.filename);
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const filepath = path_1.default.join(uploadDir, filename);
        await pump(file.file, fs_1.default.createWriteStream(filepath));
        return `/uploads/logos/${filename}`;
    }
    // Update company details
    async updateCompany(request, reply) {
        const { id } = request.params;
        const userId = request.user.id;
        // Verify owner has access to this company
        const userCompany = await database_1.default.userCompany.findFirst({
            where: { userId, companyId: id },
        });
        if (!userCompany) {
            throw new errorHandler_1.ForbiddenError('You do not have access to this company');
        }
        const company = await database_1.default.company.findUnique({ where: { id } });
        if (!company) {
            throw new errorHandler_1.NotFoundError('Company not found');
        }
        const parts = request.parts();
        const data = {};
        let logoUrl = null;
        for await (const part of parts) {
            if (part.type === 'file') {
                if (part.fieldname === 'logo') {
                    logoUrl = await this.saveLogo(part);
                }
            }
            else {
                data[part.fieldname] = part.value;
            }
        }
        const updated = await database_1.default.company.update({
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
    async addOwnerToCompany(request, reply) {
        const { id: companyId } = request.params;
        const { email, ownerEmail, firstName, lastName, password, ownershipPercentage = 0, fatherMotherName, nidPassport, mobile, permanentAddress, ownershipType, joiningDate, openingCapital = 0, tin, din } = request.body;
        const targetEmail = ownerEmail || email;
        if (!targetEmail)
            throw new errorHandler_1.ValidationError('Owner email is required');
        const requesterId = request.user.id;
        // Verify requester has canManageOwners permission
        const requesterAccess = await database_1.default.userCompany.findFirst({
            where: { userId: requesterId, companyId },
        });
        if (!requesterAccess || (!requesterAccess.isMainOwner && !requesterAccess.canManageOwners)) {
            throw new errorHandler_1.ForbiddenError('You do not have permission to manage owners');
        }
        // Find or create user
        let owner = await database_1.default.user.findUnique({
            where: { email: targetEmail },
            include: { userRoles: { include: { role: true } } }
        });
        if (!owner) {
            if (!firstName || !password) {
                throw new errorHandler_1.ConflictError('User not found. Please provide name and password to register a new user.');
            }
            // Create new user with Owner role
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            // Get Owner role
            const ownerRole = await database_1.default.role.findFirst({
                where: { name: 'Owner' }
            });
            if (!ownerRole) {
                throw new errorHandler_1.NotFoundError('Owner role not found in database');
            }
            owner = await database_1.default.user.create({
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
            const ownerRole = await database_1.default.role.findFirst({ where: { name: 'Owner' } });
            if (ownerRole) {
                await database_1.default.userRole.create({
                    data: { userId: owner.id, roleId: ownerRole.id }
                });
            }
        }
        // Seed full Owner permissions
        await seedDefaultPermissions(owner.id, 'Owner');
        const ownerId = owner.id;
        // Check 100% ownership cap
        const companyOwners = await database_1.default.userCompany.findMany({
            where: { companyId }
        });
        const currentTotal = companyOwners.reduce((sum, co) => sum + (co.ownershipPercentage || 0), 0);
        const newTotal = currentTotal + Number(ownershipPercentage);
        if (newTotal > 100) {
            throw new errorHandler_1.ConflictError(`Total ownership cannot exceed 100%. Current total shares: ${currentTotal}%. You are trying to add ${ownershipPercentage}%, which would total ${newTotal}%. Please reduce the share of another owner or adjust the current entry.`);
        }
        const company = await database_1.default.company.findUnique({ where: { id: companyId } });
        if (!company)
            throw new errorHandler_1.NotFoundError('Company not found');
        const shortId = ownerId.split('-')[0].toUpperCase();
        await database_1.default.userCompany.create({
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
        return reply.send({ success: true, message: 'Owner added to company' });
    }
    // Remove owner from company
    async removeOwnerFromCompany(request, reply) {
        const { id: companyId, ownerId } = request.params;
        const userId = request.user.id;
        // Verify requester has canManageOwners permission
        const requesterAccess = await database_1.default.userCompany.findFirst({
            where: { userId, companyId },
        });
        if (!requesterAccess || (!requesterAccess.isMainOwner && !requesterAccess.canManageOwners)) {
            throw new errorHandler_1.ForbiddenError('You do not have permission to manage owners');
        }
        await database_1.default.userCompany.delete({
            where: { userId_companyId: { userId: ownerId, companyId } },
        });
        return reply.send({ success: true, message: 'Owner removed from company' });
    }
    // Seed default Chart of Accounts for a new company
    async seedDefaultCOA(companyId) {
        const accountTypes = await database_1.default.accountType.findMany();
        const typeMap = accountTypes.reduce((acc, at) => {
            acc[at.name] = at.id;
            return acc;
        }, {});
        const defaultAccounts = [
            // Assets
            { code: '1010', name: 'Cash in Hand', accountTypeId: typeMap['ASSET'], category: 'CASH', cashFlowType: 'OPERATING' },
            { code: '1020', name: 'Bank Account', accountTypeId: typeMap['ASSET'], category: 'BANK', cashFlowType: 'OPERATING' },
            { code: '1100', name: 'Accounts Receivable', accountTypeId: typeMap['ASSET'], category: 'AR', cashFlowType: 'OPERATING' },
            { code: '1200', name: 'Inventory', accountTypeId: typeMap['ASSET'], category: 'NONE', cashFlowType: 'OPERATING' },
            // Liabilities
            { code: '2100', name: 'Accounts Payable', accountTypeId: typeMap['LIABILITY'], category: 'AP', cashFlowType: 'OPERATING' },
            // Equity
            { code: '3100', name: "Owner's Capital", accountTypeId: typeMap['EQUITY'], category: 'NONE', cashFlowType: 'FINANCING' },
            { code: '3200', name: 'Retained Earnings', accountTypeId: typeMap['EQUITY'], category: 'NONE', cashFlowType: 'FINANCING' },
            // Income
            { code: '4100', name: 'Sales Revenue', accountTypeId: typeMap['INCOME'], category: 'REVENUE', cashFlowType: 'OPERATING' },
            // Expenses
            { code: '5100', name: 'Cost of Goods Sold', accountTypeId: typeMap['EXPENSE'], category: 'NONE', cashFlowType: 'OPERATING' },
            { code: '5200', name: 'Salaries & Wages', accountTypeId: typeMap['EXPENSE'], category: 'NONE', cashFlowType: 'OPERATING' },
        ];
        // Filter out rows where type ID is missing (safety)
        const validAccounts = defaultAccounts.filter(a => a.accountTypeId).map(a => ({
            ...a,
            companyId,
            openingBalance: 0,
            currentBalance: 0,
            isActive: true,
        }));
        if (validAccounts.length > 0) {
            await database_1.default.account.createMany({
                data: validAccounts,
            });
            console.log(`✅ Seeded ${validAccounts.length} default accounts for company ${companyId}`);
        }
    }
    // Create a new company
    async createCompany(request, reply) {
        const userId = request.user.id;
        const parts = request.parts();
        const data = {};
        let logoUrl = null;
        for await (const part of parts) {
            if (part.type === 'file') {
                if (part.fieldname === 'logo') {
                    logoUrl = await this.saveLogo(part);
                }
            }
            else {
                data[part.fieldname] = part.value;
            }
        }
        const { name, code, ...info } = data;
        // Check if code exists
        const existing = await database_1.default.company.findUnique({ where: { code } });
        if (existing) {
            throw new errorHandler_1.ConflictError('Company code already exists');
        }
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: { userCompanies: true }
        });
        if (user) {
            const mainBaseCompanies = user.userCompanies.filter(c => c.isMainOwner).length;
            if (mainBaseCompanies >= user.maxCompanies) {
                throw new errorHandler_1.ForbiddenError(`You have reached your limit of ${user.maxCompanies} companies.`);
            }
        }
        const company = await database_1.default.company.create({
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
                    }
                }
            }
        });
        // Seed default COA
        await this.seedDefaultCOA(company.id);
        return reply.send({ success: true, data: company });
    }
    // Get co-owners for a company
    async getCoOwners(request, reply) {
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const access = await database_1.default.userCompany.findFirst({
            where: { userId, companyId },
        });
        if (!access) {
            throw new errorHandler_1.ForbiddenError('No access to this company');
        }
        // Only return users who have the 'Owner' role
        const owners = await database_1.default.userCompany.findMany({
            where: {
                companyId,
                user: {
                    userRoles: { some: { role: { name: 'Owner' } } }
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
    async updateCoOwner(request, reply) {
        const { id: companyId, ownerId } = request.params;
        const requesterId = request.user.id;
        const { ownershipPercentage, canEditCompany, canDeleteCompany, canManageOwners, fatherMotherName, nidPassport, mobile, permanentAddress, ownershipType, joiningDate, openingCapital, tin, din } = request.body;
        // Verify requester has permission
        const requesterAccess = await database_1.default.userCompany.findFirst({
            where: { userId: requesterId, companyId },
        });
        if (!requesterAccess || (!requesterAccess.isMainOwner && !requesterAccess.canManageOwners)) {
            throw new errorHandler_1.ForbiddenError('You do not have permission to manage owners');
        }
        // Check if target owner exists in this company
        const targetOwner = await database_1.default.userCompany.findUnique({
            where: { userId_companyId: { userId: ownerId, companyId } },
        });
        if (!targetOwner) {
            throw new errorHandler_1.NotFoundError('Owner not found in this company');
        }
        // Prevent non-main owners from editing the main owner
        if (targetOwner.isMainOwner && requesterId !== ownerId && !requesterAccess.isMainOwner) {
            throw new errorHandler_1.ForbiddenError('You cannot edit the main owner');
        }
        // Check 100% ownership cap if percentage is changing
        if (ownershipPercentage !== undefined) {
            const companyOwners = await database_1.default.userCompany.findMany({
                where: { companyId }
            });
            const currentTotal = companyOwners.reduce((sum, co) => sum + (co.userId === ownerId ? 0 : (co.ownershipPercentage || 0)), 0);
            const newTotal = currentTotal + Number(ownershipPercentage);
            if (newTotal > 100) {
                throw new errorHandler_1.ConflictError(`Total ownership cannot exceed 100%. The other owners currently hold ${currentTotal}%. This update to ${ownershipPercentage}% would bring the total to ${newTotal}%. Please reduce another owner's share before increasing this one.`);
            }
        }
        const updated = await database_1.default.userCompany.update({
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
    async deleteEmployee(request, reply) {
        const { id } = request.params;
        const requesterId = request.user.id;
        // Find the employee and their companies
        const employee = await database_1.default.user.findUnique({
            where: { id },
            include: { userCompanies: true }
        });
        if (!employee) {
            throw new errorHandler_1.NotFoundError('Employee not found');
        }
        // Verify requester has permission in at least one of the employee's companies
        const sharedCompanyIds = employee.userCompanies.map(uc => uc.companyId);
        const requesterAccess = await database_1.default.userCompany.findFirst({
            where: {
                userId: requesterId,
                companyId: { in: sharedCompanyIds },
                isMainOwner: true // Only main owners can delete employees for safety
            },
        });
        if (!requesterAccess) {
            throw new errorHandler_1.ForbiddenError('You do not have permission to delete this employee. Only Main Owners can perform this action.');
        }
        // Delete the user record (this will cascade to UserCompany, UserRole, etc.)
        await database_1.default.user.delete({
            where: { id }
        });
        return reply.send({ success: true, message: 'Employee deleted successfully' });
    }
    // Get employees in owner's companies
    async getEmployees(request, reply) {
        const userId = request.user.id;
        // Get companies where user is owner
        const userCompanies = await database_1.default.userCompany.findMany({
            where: { userId },
            select: { companyId: true },
        });
        const companyIds = userCompanies.map((uc) => uc.companyId);
        // Get all users in these companies
        const employees = await database_1.default.user.findMany({
            where: {
                userCompanies: { some: { companyId: { in: companyIds } } },
            },
            include: {
                userRoles: { include: { role: true } },
                userCompanies: { include: { company: true } },
                permissions: true,
                manager: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        // Format all users (including owners)
        const formatted = employees
            .map((e) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            email: e.email,
            isActive: e.isActive,
            role: e.userRoles[0]?.role.name || 'User',
            companies: e.userCompanies.map((uc) => ({
                id: uc.company.id,
                name: uc.company.name,
                code: uc.company.code,
            })),
            manager: e.manager
                ? { id: e.manager.id, name: `${e.manager.firstName} ${e.manager.lastName}` }
                : null,
            permissions: e.permissions,
        }));
        return reply.send({ success: true, data: formatted });
    }
    // Create employee
    async createEmployee(request, reply) {
        const { email, password, firstName, lastName, roleId, companyIds } = request.body;
        const userId = request.user.id;
        // Get owner's companies
        const ownerCompanies = await database_1.default.userCompany.findMany({
            where: { userId },
            select: { companyId: true },
        });
        const ownerCompanyIds = ownerCompanies.map((c) => c.companyId);
        // Verify companies belong to owner
        const validCompanies = companyIds?.filter((cId) => ownerCompanyIds.includes(cId)) || [];
        // Check if email exists
        const existing = await database_1.default.user.findUnique({ where: { email } });
        if (existing) {
            throw new errorHandler_1.ConflictError('Email already exists');
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await database_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                userRoles: roleId ? { create: { roleId } } : undefined,
                userCompanies: {
                    create: validCompanies.map((cId) => ({
                        companyId: cId,
                        isDefault: validCompanies.length === 1,
                    })),
                },
            },
            include: { userRoles: { include: { role: true } }, userCompanies: { include: { company: true } } }
        });
        // Seed default permissions for the assigned role
        if (roleId) {
            const roleName = user.userRoles[0]?.role?.name;
            if (roleName)
                await seedDefaultPermissions(user.id, roleName);
        }
        const { password: _, ...userWithoutPassword } = user;
        return reply.status(201).send({ success: true, data: userWithoutPassword });
    }
    // Update employee
    async updateEmployee(request, reply) {
        const { id } = request.params;
        const { email, password, firstName, lastName, roleId, companyIds } = request.body;
        const userId = request.user.id;
        // Verify employee exists and belongs to owner's companies
        const employee = await database_1.default.user.findUnique({
            where: { id },
            include: { userCompanies: true },
        });
        if (!employee) {
            throw new errorHandler_1.NotFoundError('Employee not found');
        }
        // Get owner's companies to verify access
        const ownerCompanies = await database_1.default.userCompany.findMany({
            where: { userId },
            select: { companyId: true },
        });
        const ownerCompanyIds = ownerCompanies.map((c) => c.companyId);
        // Filter valid companies (only those owned by the owner)
        const validCompanies = companyIds?.filter((cId) => ownerCompanyIds.includes(cId)) || [];
        // Prepare update data
        const updateData = {
            email: email ?? employee.email,
            firstName: firstName ?? employee.firstName,
            lastName: lastName ?? employee.lastName,
        };
        if (password) {
            updateData.password = await bcryptjs_1.default.hash(password, 10);
        }
        // Update user basic info
        const updatedUser = await database_1.default.user.update({
            where: { id },
            data: updateData,
        });
        // Update role if provided and re-seed permissions for the new role
        if (roleId) {
            await database_1.default.userRole.deleteMany({ where: { userId: id } });
            await database_1.default.userRole.create({ data: { userId: id, roleId } });
            const role = await database_1.default.role.findUnique({ where: { id: roleId } });
            if (role)
                await seedDefaultPermissions(id, role.name);
        }
        // Update companies if provided
        if (companyIds) {
            // Remove old associations
            await database_1.default.userCompany.deleteMany({ where: { userId: id } });
            // Add new associations
            await database_1.default.userCompany.createMany({
                data: validCompanies.map((cId) => ({
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
    async syncAllPermissions(request, reply) {
        const userId = request.user.id;
        // Only owner/admin of at least one company can run this
        const ownerCompanies = await database_1.default.userCompany.findMany({
            where: { userId },
            select: { companyId: true },
        });
        if (ownerCompanies.length === 0) {
            return reply.status(403).send({ success: false, error: { message: 'Access denied' } });
        }
        // Get all users in the owner's companies
        const companyIds = ownerCompanies.map((c) => c.companyId);
        const users = await database_1.default.user.findMany({
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
    async updateEmployeePermissions(request, reply) {
        const { id } = request.params;
        const { module, canCreate, canView, canVerify, canApprove } = request.body;
        // Upsert permission
        const permission = await database_1.default.userPermission.upsert({
            where: { userId_module: { userId: id, module } },
            update: { canCreate, canView, canVerify, canApprove },
            create: { userId: id, module, canCreate, canView, canVerify, canApprove },
        });
        return reply.send({ success: true, data: permission });
    }
    // Set employee's reporting manager
    async setEmployeeManager(request, reply) {
        const { id } = request.params;
        const { managerId } = request.body;
        await database_1.default.user.update({
            where: { id },
            data: { managerId: managerId || null },
        });
        return reply.send({ success: true, message: 'Manager updated successfully' });
    }
    // Toggle employee status
    async toggleEmployeeStatus(request, reply) {
        const { id } = request.params;
        const { isActive } = request.body;
        await database_1.default.user.update({
            where: { id },
            data: { isActive },
        });
        return reply.send({ success: true, message: `Employee ${isActive ? 'activated' : 'deactivated'} successfully` });
    }
    // Reset employee password
    async resetEmployeePassword(request, reply) {
        const { id } = request.params;
        const { password } = request.body;
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        await database_1.default.user.update({
            where: { id },
            data: { password: hashedPassword },
        });
        return reply.send({ success: true, message: 'Password reset successfully' });
    }
}
exports.OwnerController = OwnerController;
//# sourceMappingURL=owner.controller.js.map