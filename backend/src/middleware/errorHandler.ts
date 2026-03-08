import { FastifyRequest, FastifyReply } from 'fastify';

export class AppError extends Error {
  statusCode: number;
  message: string;
  remedy?: string;
  code?: string;

  constructor(message: string, statusCode: number = 500, remedy?: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.remedy = remedy;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', remedy?: string) {
    super(message, 404, remedy, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', remedy?: string) {
    super(message, 401, remedy, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', remedy?: string) {
    super(message, 403, remedy, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', remedy?: string) {
    super(message, 409, remedy, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation error', remedy?: string) {
    super(message, 422, remedy, 'VALIDATION_ERROR');
  }
}

export async function errorHandler(
  error: Error | any,
  request: FastifyRequest,
  reply: FastifyReply
) {
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
