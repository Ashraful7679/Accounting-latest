export declare class BaseCompanyController {
    protected getUserRole(userId: string, companyId: string): Promise<string>;
    protected canEdit(status: string, role: string, userId?: string, createdById?: string): boolean;
    protected canDelete(status: string, role: string): boolean;
    protected canVerify(status: string, role: string): boolean;
    protected canApprove(status: string, role: string): boolean;
    protected generateDocumentNumber(companyId: string, type: 'invoice' | 'journal' | 'po' | 'pi' | 'lc' | 'customer' | 'vendor' | 'product' | 'employee', prismaOverride?: any): Promise<string>;
}
//# sourceMappingURL=base.controller.d.ts.map