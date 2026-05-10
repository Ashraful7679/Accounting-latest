import prisma from '../../config/database';

export const PERMISSIONS = {
  // Sales Module
  'sales.orders': { label: 'Sales Orders', create: true, view: true, edit: true, delete: false, verify: true, approve: true, export: true, print: true },
  'sales.invoices': { label: 'Sales Invoices', create: true, view: true, edit: false, delete: false, verify: true, approve: true, export: true, print: true },
  'sales.customers': { label: 'Customers', create: true, view: true, edit: true, delete: false, verify: false, approve: false, export: true, print: true },
  'sales.credit-notes': { label: 'Credit Notes', create: true, view: true, edit: true, delete: false, verify: true, approve: true },
  'sales.challans': { label: 'Delivery Challans', create: true, view: true, edit: true, delete: false, verify: false, approve: false },

  // Purchase Module
  'purchase.orders': { label: 'Purchase Orders', create: true, view: true, edit: true, delete: false, verify: true, approve: true },
  'purchase.invoices': { label: 'Purchase Invoices', create: true, view: true, edit: false, delete: false, verify: true, approve: true },
  'purchase.vendors': { label: 'Vendors', create: true, view: true, edit: true, delete: false, verify: false, approve: false },
  'purchase.debit-notes': { label: 'Debit Notes', create: true, view: true, edit: true, delete: false, verify: true, approve: true },
  'purchase.grn': { label: 'GRN', create: true, view: true, edit: true, delete: false, verify: false, approve: false },

  // Finance Module
  'finance.journals': { label: 'Journals', create: true, view: true, edit: true, delete: false, verify: true, approve: true, export: true },
  'finance.accounts': { label: 'Chart of Accounts', create: true, view: true, edit: true, delete: false, verify: false, approve: false, export: true },
  'finance.reports': { label: 'Reports', create: false, view: true, edit: false, delete: false, verify: false, approve: false, export: true, print: true },
  'finance.bank-reconciliation': { label: 'Bank Reconciliation', create: true, view: true, edit: true, delete: false, verify: true, approve: true },
  'finance.fixed-assets': { label: 'Fixed Assets', create: true, view: true, edit: true, delete: false, verify: true, approve: true },

  // Products & Settings
  'products': { label: 'Products', create: true, view: true, edit: true, delete: false, verify: false, approve: false, export: true },
  'settings': { label: 'Settings', create: false, view: true, edit: true, delete: false, verify: false, approve: false },

  // HR Module
  'hr.employees': { label: 'Employees', create: true, view: true, edit: true, delete: false, verify: false, approve: false, export: true },
  'hr.payroll': { label: 'Payroll', create: true, view: true, edit: true, delete: false, verify: true, approve: true },

  // Admin
  'admin.users': { label: 'User Management', create: true, view: true, edit: true, delete: false, verify: false, approve: false },
  'admin.roles': { label: 'Role Management', create: true, view: true, edit: true, delete: false, verify: false, approve: false },
};

export const ROLE_TEMPLATES = {
  'Admin': {
    description: 'Full system access',
    permissions: Object.keys(PERMISSIONS).reduce((acc, mod) => ({
      ...acc,
      [mod]: { canCreate: true, canView: true, canEdit: true, canDelete: true, canVerify: true, canApprove: true, canExport: true, canPrint: true }
    }), {})
  },
  'Controller': {
    description: 'Can approve all transactions',
    permissions: Object.keys(PERMISSIONS).reduce((acc, mod) => ({
      ...acc,
      [mod]: { canCreate: true, canView: true, canEdit: false, canDelete: false, canVerify: true, canApprove: true, canExport: true, canPrint: true }
    }), {})
  },
  'Accountant': {
    description: 'Can create and verify transactions',
    permissions: Object.keys(PERMISSIONS).reduce((acc, mod) => ({
      ...acc,
      [mod]: { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: true, canApprove: false, canExport: true, canPrint: true }
    }), {})
  },
  'Sales Rep': {
    description: 'Can create sales documents',
    permissions: {
      'sales.orders': { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: true },
      'sales.invoices': { canCreate: false, canView: true, canEdit: false, canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: true },
      'sales.customers': { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: true, canPrint: false },
      'products': { canCreate: false, canView: true, canEdit: false, canDelete: false, canVerify: false, canApprove: false, canExport: true, canPrint: false },
    }
  },
  'Purchase Rep': {
    description: 'Can create purchase documents',
    permissions: {
      'purchase.orders': { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: true },
      'purchase.invoices': { canCreate: false, canView: true, canEdit: false, canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: true },
      'purchase.vendors': { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: true, canPrint: false },
    }
  },
  'Viewer': {
    description: 'Read-only access',
    permissions: Object.keys(PERMISSIONS).reduce((acc, mod) => ({
      ...acc,
      [mod]: { canCreate: false, canView: true, canEdit: false, canDelete: false, canVerify: false, canApprove: false, canExport: true, canPrint: true }
    }), {})
  }
};

export class RBACService {
  static async checkPermission(
    userId: string,
    companyId: string,
    module: string,
    action: 'create' | 'view' | 'edit' | 'delete' | 'verify' | 'approve' | 'export' | 'print'
  ): Promise<boolean> {
    // 1. Company owner bypass — always full access
    const userCompany = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } }
    });
    if (userCompany?.isMainOwner) return true;

    // 2. Check user-specific permission overrides first (highest priority)
    const userPerm = await prisma.userPermission.findFirst({
      where: { userId, module }
    });
    if (userPerm) {
      const field = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
      return !!(userPerm as any)[field];
    }

    // 3. Fall back to role-level policy (module-aware)
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });

    const actionField = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;

    for (const ur of userRoles) {
      const template = (ROLE_TEMPLATES as any)[ur.role.name];
      if (template?.permissions && template.permissions[module]) {
        if (template.permissions[module][actionField]) return true;
      }
      
      // Special case for global roles like Admin/Owner
      if (ur.role.name === 'Admin' || ur.role.name === 'Owner') {
        return true;
      }
    }

    return false;
  }

  static async getUserPermissions(userId: string, companyId?: string) {
    // 1. Owner bypass
    if (companyId) {
      const userCompany = await prisma.userCompany.findUnique({
        where: { userId_companyId: { userId, companyId } }
      });
      if (userCompany?.isMainOwner) {
        const fullAccess: Record<string, any> = {};
        Object.keys(PERMISSIONS).forEach(mod => {
          fullAccess[mod] = {
            canCreate: true, canView: true, canEdit: true, canDelete: true,
            canVerify: true, canApprove: true, canExport: true, canPrint: true
          };
        });
        return fullAccess;
      }
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });

    // 2. Admin bypass (if they have the Admin role)
    if (userRoles.some(ur => ur.role.name === 'Admin' || ur.role.name === 'Owner')) {
      const fullAccess: Record<string, any> = {};
      Object.keys(PERMISSIONS).forEach(mod => {
        fullAccess[mod] = {
          canCreate: true, canView: true, canEdit: true, canDelete: true,
          canVerify: true, canApprove: true, canExport: true, canPrint: true
        };
      });
      return fullAccess;
    }

    const permissions: Record<string, any> = {};

    for (const ur of userRoles) {
      const template = (ROLE_TEMPLATES as any)[ur.role.name];
      if (!template?.permissions) continue;
      for (const [mod, perms] of Object.entries(template.permissions)) {
        if (!permissions[mod]) {
          permissions[mod] = {
            canCreate: false, canView: false, canEdit: false, canDelete: false,
            canVerify: false, canApprove: false, canExport: false, canPrint: false
          };
        }
        const p = perms as Record<string, boolean>;
        permissions[mod].canCreate ||= p.canCreate;
        permissions[mod].canView ||= p.canView;
        permissions[mod].canEdit ||= p.canEdit;
        permissions[mod].canDelete ||= p.canDelete;
        permissions[mod].canVerify ||= p.canVerify;
        permissions[mod].canApprove ||= p.canApprove;
        permissions[mod].canExport ||= p.canExport;
        permissions[mod].canPrint ||= p.canPrint;
      }
    }

    const userPerms = await prisma.userPermission.findMany({ where: { userId } });
    for (const up of userPerms) {
      if (!permissions[up.module]) {
        permissions[up.module] = {
          canCreate: false, canView: false, canEdit: false, canDelete: false,
          canVerify: false, canApprove: false, canExport: false, canPrint: false
        };
      }
      Object.keys(permissions[up.module]).forEach(key => {
        const v = (up as any)[key];
        if (typeof v === 'boolean') {
          permissions[up.module][key] = v;
        }
      });
    }

    return permissions;
  }

  static async hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });
    return userRoles.some(ur => roles.includes(ur.role.name));
  }

  static async getUserRoleLevel(userId: string, companyId: string): Promise<string> {
    const userCompany = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } }
    });
    if (userCompany?.isMainOwner) return 'Owner';

    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });

    if (userRoles.some(ur => ur.role.name === 'Admin' || ur.role.isSystem)) return 'Admin';
    if (userRoles.some(ur => ur.role.name === 'Controller')) return 'Controller';
    if (userRoles.some(ur => ur.role.name === 'Accountant')) return 'Accountant';

    return 'User';
  }

  /**
   * Enforces the Manager Verification Rule:
   * 1. A Manager cannot verify their own entries.
   * 2. A Manager can only verify entries created by their subordinates.
   * 
   * Note: Owners and Admins are exempt from these restrictions.
   */
  static async canManagerVerifyEntry(managerId: string, createdById: string, role: string): Promise<boolean> {
    if (role === 'Owner' || role === 'Admin') return true;
    if (role !== 'Manager') return false; // Non-managers shouldn't be verifying unless they have explicit permission (handled elsewhere)

    if (managerId === createdById) return false; // Cannot verify own entry

    // Check if createdById is a subordinate of managerId
    const subordinate = await prisma.user.findFirst({
      where: { id: createdById, managerId: managerId }
    });

    return !!subordinate;
  }
}