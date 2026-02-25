import { FastifyRequest, FastifyReply } from 'fastify';

export class AppError extends Error {
  statusCode: number;
  message: string;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation error') {
    super(message, 422);
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
        statusCode: 409,
      },
    });
  }

  if (error.code === 'P2025') {
    return reply.status(404).send({
      success: false,
      error: {
        message: 'Record not found',
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
        statusCode: error.statusCode,
      },
    });
  }

  // Default error
  return reply.status(500).send({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      statusCode: 500,
    },
  });
}
