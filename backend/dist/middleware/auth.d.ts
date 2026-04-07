import { FastifyRequest, FastifyReply } from 'fastify';
export interface AuthUser {
    id: string;
    email: string;
    companyId?: string;
    isAdmin: boolean;
}
declare module '@fastify/jwt' {
    interface FastifyJWT {
        user: AuthUser;
    }
}
export declare const authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<never>;
export declare const requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<never>;
export declare const requireOwner: (request: FastifyRequest, reply: FastifyReply) => Promise<never>;
//# sourceMappingURL=auth.d.ts.map