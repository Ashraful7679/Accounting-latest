"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../../config/database"));
const systemMode_1 = require("../../lib/systemMode");
const company_1 = require("../../lib/mockData/company");
class AuthController {
    async login(request, reply) {
        const { email, password } = request.body;
        console.log(`[${new Date().toISOString()}] Login attempt: email=${email}, passLength=${password?.length}, mode=${systemMode_1.SYSTEM_MODE}`);
        // Offline Demo Mode Logic
        if (systemMode_1.SYSTEM_MODE === "OFFLINE") {
            console.log(`[${new Date().toISOString()}] Processing OFFLINE login for ${email}`);
            if (email === "demo@example.com" && (password === "demo123" || password === "password")) {
                console.log(`[${new Date().toISOString()}] --- OFFLINE LOGIN SUCCESS: ${email} ---`);
                const token = reply.server.jwt.sign({
                    id: company_1.demoUser.id,
                    email: company_1.demoUser.email,
                    isAdmin: true,
                });
                return reply.send({
                    success: true,
                    data: {
                        user: company_1.demoUser,
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
        const user = await database_1.default.user.findUnique({
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
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            console.log(`Invalid password for: ${email}`);
            return reply.status(401).send({
                success: false,
                error: { message: 'Invalid credentials' },
            });
        }
        console.log(`Login successful for: ${email}`);
        // Generate token
        const roleNames = user.userRoles.map((ur) => ur.role.name);
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
    async register(request, reply) {
        const { email, password, firstName, lastName } = request.body;
        // Check if user exists
        const existingUser = await database_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return reply.status(409).send({
                success: false,
                error: { message: 'User already exists' },
            });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create user
        const user = await database_1.default.user.create({
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
    async getMe(request, reply) {
        const user = await database_1.default.user.findUnique({
            where: { id: request.user.id },
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
    async updateMe(request, reply) {
        const { firstName, lastName, phone, address } = request.body;
        const updated = await database_1.default.user.update({
            where: { id: request.user.id },
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
    async logout(request, reply) {
        return reply.send({ success: true, message: 'Logged out successfully' });
    }
    async getRoles(request, reply) {
        const roles = await database_1.default.role.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        return reply.send({ success: true, data: roles });
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map