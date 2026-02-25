import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { SYSTEM_MODE } from '../../lib/systemMode';
import { demoUser } from '../../lib/mockData/company';

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const { email, password } = request.body as { email: string; password: string };
    console.log(`[${new Date().toISOString()}] Login attempt: email=${email}, passLength=${password?.length}, mode=${SYSTEM_MODE}`);

    // Offline Demo Mode Logic
    if (SYSTEM_MODE === "OFFLINE") {
      console.log(`[${new Date().toISOString()}] Processing OFFLINE login for ${email}`);
      if (email === "demo@example.com" && (password === "demo123" || password === "password")) {
        console.log(`[${new Date().toISOString()}] --- OFFLINE LOGIN SUCCESS: ${email} ---`);
        const token = reply.server.jwt.sign({
          id: demoUser.id,
          email: demoUser.email,
          isAdmin: true,
        });

        return reply.send({
          success: true,
          data: {
            user: demoUser,
            token,
          },
        });
      }
      
      console.log(`[${new Date().toISOString()}] OFFLINE login failed: check credentials`);
      return reply.status(401).send({
        success: false,
        error: { message: 'Offline mode: Only demo credentials work.' },
      });
    }

    console.log(`[${new Date().toISOString()}] Proceeding with LIVE database login for ${email}`);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: { include: { role: true } },
        userCompanies: { include: { company: true } },
        permissions: true,
      },
    });

    if (!user) {
      console.log(`User not found: ${email}`);
      return reply.status(401).send({
        success: false,
        error: { message: 'Invalid credentials' },
      });
    }

    if (!user.isActive) {
      console.log(`User inactive: ${email}`);
      return reply.status(401).send({
        success: false,
        error: { message: 'Account is inactive' },
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log(`Invalid password for: ${email}`);
      return reply.status(401).send({
        success: false,
        error: { message: 'Invalid credentials' },
      });
    }

    console.log(`Login successful for: ${email}`);

    // Generate token
    const roleNames = (user as any).userRoles.map((ur: any) => ur.role.name);
    const isAdmin = roleNames.includes('Admin');

    const token = reply.server.jwt.sign({
      id: user.id,
      email: user.email,
      isAdmin,
    });

    const { password: _, ...userWithoutPassword } = user;

    return reply.send({
      success: true,
      data: {
        user: {
          ...userWithoutPassword,
          roles: roleNames,
        },
        token,
      },
    });
  }

  async register(request: FastifyRequest, reply: FastifyReply) {
    const { email, password, firstName, lastName } = request.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    };

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: { message: 'User already exists' },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return reply.status(201).send({
      success: true,
      data: userWithoutPassword,
    });
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const user = await prisma.user.findUnique({
      where: { id: (request.user as any).id },
      include: {
        userRoles: { include: { role: true } },
        userCompanies: { include: { company: true } },
      },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { message: 'User not found' },
      });
    }

    const roleNames = user.userRoles.map((ur) => ur.role.name);
    const { password: _, ...userWithoutPassword } = user;

    return reply.send({
      success: true,
      data: {
        ...userWithoutPassword,
        roles: roleNames,
      },
    });
  }

  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const { firstName, lastName, phone, address } = request.body as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
    };

    const updated = await prisma.user.update({
      where: { id: (request.user as any).id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
      },
    });

    const { password: _, ...userWithoutPassword } = updated;
    return reply.send({ success: true, data: userWithoutPassword });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, message: 'Logged out successfully' });
  }

  async getRoles(request: FastifyRequest, reply: FastifyReply) {
    const roles = await prisma.role.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: roles });
  }
}
