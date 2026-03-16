import { FastifyRequest, FastifyReply } from 'fastify';
export declare class AppError extends Error {
    statusCode: number;
    message: string;
    remedy?: string;
    code?: string;
    constructor(message: string, statusCode?: number, remedy?: string, code?: string);
}
export declare class NotFoundError extends AppError {
    constructor(message?: string, remedy?: string);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string, remedy?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string, remedy?: string);
}
export declare class ConflictError extends AppError {
    constructor(message?: string, remedy?: string);
}
export declare class ValidationError extends AppError {
    constructor(message?: string, remedy?: string);
}
export declare function errorHandler(error: Error | any, request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=errorHandler.d.ts.map