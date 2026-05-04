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
  /**
   * Check if a user has permission to perform an action on a module.
   * Falls back to checking UserPermission model, then company ownership.
   */
  static async checkPermission(
    userId: string,
    companyId: string,
    module: string,
    action: 'create' | 'view' | 'edit' | 'delete' | 'verify' | 'approve' | 'export' | 'print'
  ): Promise<boolean> {
    // Check if user is company owner/admin
    const userCompany = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } }
    });
    if (userCompany?.isMainOwner) return true;

    // Check user-specific permission overrides
    const userPerm = await prisma.userPermission.findFirst({
      where: { userId, module }
    });

    if (userPerm) {
      const field = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
      if ((userPerm as any)[field]) return true;
    }

    return false;
  }

  static async getUserPermissions(userId: string, _companyId?: string) {
    const userPerms = await prisma.userPermission.findMany({ where: { userId } });
    const permissions: Record<string, any> = {};

    for (const up of userPerms) {
      if (!permissions[up.module]) permissions[up.module] = {};
      Object.keys(up).forEach(key => {
        if (key !== 'id' && key !== 'userId' && key !== 'module') {
          (permissions[up.module] as any)[key] = (up as any)[key];
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
}