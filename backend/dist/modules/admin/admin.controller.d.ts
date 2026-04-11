import { FastifyRequest, FastifyReply } from 'fastify';
export declare class AdminController {
    private generateCompanyCode;
    private ensureCOA;
    getCompanies(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    createCompany(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    updateCompany(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    deleteCompany(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    toggleCompanyStatus(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getOwners(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    createOwner(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    deleteOwner(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    resetOwnerPassword(request: FastifyRequest, reply: FastifyReply): Promise<never>;
}
//# sourceMappingURL=admin.controller.d.ts.map