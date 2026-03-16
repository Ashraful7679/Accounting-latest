"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.ConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.AppError = void 0;
exports.errorHandler = errorHandler;
class AppError extends Error {
    constructor(message, statusCode = 500, remedy, code) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.remedy = remedy;
        this.code = code;
    }
}
exports.AppError = AppError;
class NotFoundError extends AppError {
    constructor(message = 'Resource not found', remedy) {
        super(message, 404, remedy, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', remedy) {
        super(message, 401, remedy, 'UNAUTHORIZED');
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', remedy) {
        super(message, 403, remedy, 'FORBIDDEN');
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends AppError {
    constructor(message = 'Conflict', remedy) {
        super(message, 409, remedy, 'CONFLICT');
    }
}
exports.ConflictError = ConflictError;
class ValidationError extends AppError {
    constructor(message = 'Validation error', remedy) {
        super(message, 422, remedy, 'VALIDATION_ERROR');
    }
}
exports.ValidationError = ValidationError;
async function errorHandler(error, request, reply) {
    console.error('Error:', error);
    // Handle Prisma errors
    if (error.code === 'P2002') {
        return reply.status(409).send({
            success: false,
            error: {
                message: 'A record with this value already exists',
                remedy: 'Please use a unique value for this field.',
                code: 'DUPLICATE_RECORD',
                statusCode: 409,
            },
        });
    }
    if (error.code === 'P2025') {
        return reply.status(404).send({
            success: false,
            error: {
                message: 'Record not found',
                remedy: 'The record you are trying to access does not exist or has been deleted.',
                code: 'NOT_FOUND',
                statusCode: 404,
            },
        });
    }
    // Handle custom errors
    if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
            success: false,
            error: {
                message: error.message,
                remedy: error.remedy,
                code: error.code,
                statusCode: error.statusCode,
            },
        });
    }
    // Default error
    return reply.status(500).send({
        success: false,
        error: {
            message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
            remedy: 'If this persists, please contact support.',
            code: 'INTERNAL_SERVER_ERROR',
            statusCode: 500,
        },
    });
}
//# sourceMappingURL=errorHandler.js.map