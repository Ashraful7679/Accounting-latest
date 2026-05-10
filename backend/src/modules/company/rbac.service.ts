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
  'inventory.products': { label: 'Products', create: true, view: true, edit: true, delete: false, verify: false, approve: false, export: true },
  'company.settings': { label: 'Settings', create: false, view: true, edit: true, delete: false, verify: false, approve: false },
  'company.branches': { label: 'Branches', create: true, view: true, edit: true, delete: false, verify: true, approve: true },

  // HR Module
  'hr.employees': { label: 'Employees', create: true, view: true, edit: true, delete: false, verify: false, approve: false, export: true },
  'hr.payroll': { label: 'Payroll', create: true, view: true, edit: true, delete: false, verify: true, approve: true },
};

export const ROLE_TEMPLATES = {
  'Admin': {
    description: 'System-level administrative access',
    permissions: {
      'admin.users': { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: true, canPrint: true },
      'admin.roles': { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: true, canPrint: true },
      'settings': { canCreate: false, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: true, canPrint: true },
    }
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
    const userCompany = await prisma.userCompany.findFirst({
      where: { userId, companyId }
    });
    if (userCompany?.isMainOwner) return true;

    // 1. System-level Admin check (Strict isolation)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.isAdmin) {
      // Admin only has access to admin modules or system tasks
      if (module.startsWith('admin.') || module === 'security' || module === 'backup') {
        return true;
      }
      return false; // Strict privacy: no access to company modules
    }

    // 2. Company Context Bypass
    if (companyId) {
      const userCompany = await prisma.userCompany.findFirst({
        where: { userId, companyId }
      });
      
      // Main owner gets full access to everything in their company
      if (userCompany?.isMainOwner) {
        return true;
      }
    }

    // 2. Check Role-based permissions (Modern)
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { 
        role: {
          include: { rolePermissions: { where: { module } } }
        } 
      }
    });

    const actionField = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;

    for (const ur of userRoles) {
      // Owner role always gets full access
      if (ur.role.name === 'Owner') return true;

      // Check specific role permissions
      const rp = ur.role.rolePermissions[0];
      if (rp && (rp as any)[actionField]) return true;

      // Fallback to hardcoded templates if no DB record exists yet
      const template = (ROLE_TEMPLATES as any)[ur.role.name];
      if (template?.permissions && template.permissions[module]) {
        if (template.permissions[module][actionField]) return true;
      }
    }

    return false;
  }

  static async getUserPermissions(userId: string, companyId?: string) {
    // 1. Admin bypass (System-level)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.isAdmin) {
      const adminAccess: Record<string, any> = {};
      Object.keys(PERMISSIONS).forEach(mod => {
        // Admin only gets access to system-level modules
        const isSystem = mod.startsWith('admin.') || mod === 'company.settings' || mod === 'company.branches' || mod === 'security' || mod === 'backup';
        adminAccess[mod] = {
          canCreate: isSystem, canView: isSystem, canEdit: isSystem, canDelete: isSystem,
          canVerify: isSystem, canApprove: isSystem, canExport: isSystem, canPrint: isSystem
        };
      });
      return adminAccess;
    }

    // 2. Main Owner bypass
    if (companyId) {
      const userCompany = await prisma.userCompany.findFirst({
        where: { userId, companyId }
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

    if (!companyId) return {};

    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { 
        role: {
          include: { rolePermissions: true }
        } 
      }
    });

    // 3. Owner role bypass (Company level)
    if (userRoles.some(ur => (ur as any).role.name === 'Owner')) {
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
    // Pre-initialize all modules to false to ensure consistent return format
    Object.keys(PERMISSIONS).forEach(mod => {
      permissions[mod] = {
        canCreate: false, canView: false, canEdit: false, canDelete: false,
        canVerify: false, canApprove: false, canExport: false, canPrint: false
      };
    });

    // 4. Role-based permissions aggregation
    for (const ur of userRoles) {
      // Aggregate from RolePermission records in DB
      (ur as any).role.rolePermissions.forEach((rp: any) => {
        if (!permissions[rp.module]) {
          permissions[rp.module] = {
            canCreate: false, canView: false, canEdit: false, canDelete: false,
            canVerify: false, canApprove: false, canExport: false, canPrint: false
          };
        }
        permissions[rp.module].canCreate ||= rp.canCreate;
        permissions[rp.module].canView ||= rp.canView;
        permissions[rp.module].canEdit ||= rp.canEdit;
        permissions[rp.module].canDelete ||= rp.canDelete;
        permissions[rp.module].canVerify ||= rp.canVerify;
        permissions[rp.module].canApprove ||= rp.canApprove;
        permissions[rp.module].canExport ||= rp.canExport;
        permissions[rp.module].canPrint ||= rp.canPrint;
      });

      // Fallback to hardcoded templates
      const template = (ROLE_TEMPLATES as any)[(ur as any).role.name];
      if (template?.permissions) {
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
    }

    return permissions;
  }

  static async hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });
    return userRoles.some(ur => roles.includes((ur as any).role.name));
  }

  static async getUserRoleLevel(userId: string, companyId: string): Promise<string> {
    const userCompany = await prisma.userCompany.findFirst({
      where: { userId, companyId }
    });
    if (userCompany?.isMainOwner) return 'Owner';

    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });

    if (userRoles.some(ur => (ur as any).role.isSystem)) return 'System';
    if (userRoles.some(ur => (ur as any).role.name === 'Controller')) return 'Controller';
    if (userRoles.some(ur => (ur as any).role.name === 'Accountant')) return 'Accountant';

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
    if (role === 'Owner') return true;
    if (role !== 'Manager') return false; // Non-managers shouldn't be verifying unless they have explicit permission (handled elsewhere)

    if (managerId === createdById) return false; // Cannot verify own entry

    // Check if createdById is a subordinate of managerId
    const subordinate = await prisma.user.findFirst({
      where: { id: createdById, managerId: managerId }
    });

    return !!subordinate;
  }
}