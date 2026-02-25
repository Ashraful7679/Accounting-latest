import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/database';

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

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if ((request.query as any).token) {
      token = (request.query as any).token;
    }

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: { message: 'No token provided', statusCode: 401 },
      });
    }

    const decoded = request.server.jwt.verify(token) as AuthUser;

    if (!decoded || !decoded.id) {
      return reply.status(401).send({
        success: false,
        error: { message: 'Invalid token', statusCode: 401 },
      });
    }

    // Get user with roles
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({
        success: false,
        error: { message: 'User not found or inactive', statusCode: 401 },
      });
    }

    const roleNames = user.userRoles.map((ur) => ur.role.name);
    const isAdmin = roleNames.includes('Admin');

    // Get user's default company
    let companyId: string | undefined;
    if (!isAdmin) {
      const userCompany = await prisma.userCompany.findFirst({
        where: { userId: user.id, isDefault: true },
      });
      if (userCompany) {
        companyId = userCompany.companyId;
      }
    }

    request.user = {
      id: user.id,
      email: user.email,
      companyId,
      isAdmin,
    };
  } catch (error) {
    return reply.status(401).send({
      success: false,
      error: { message: 'Invalid or expired token', statusCode: 401 },
    });
  }
};

export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.user.isAdmin) {
    return reply.status(403).send({
      success: false,
      error: { message: 'Admin access required', statusCode: 403 },
    });
  }
};

export const requireOwner = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = await prisma.user.findUnique({
    where: { id: request.user.id },
    include: { userRoles: { include: { role: true } } },
  });

  const isOwner = user?.userRoles.some((ur) => ur.role.name === 'Owner');
  
  if (!isOwner && !request.user.isAdmin) {
    return reply.status(403).send({
      success: false,
      error: { message: 'Owner access required', statusCode: 403 },
    });
  }
};
