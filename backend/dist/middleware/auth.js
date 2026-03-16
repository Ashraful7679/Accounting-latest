"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOwner = exports.requireAdmin = exports.authenticate = void 0;
const database_1 = __importDefault(require("../config/database"));
const authenticate = async (request, reply) => {
    try {
        const authHeader = request.headers.authorization;
        let token = '';
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
        else if (request.query.token) {
            token = request.query.token;
        }
        if (!token) {
            return reply.status(401).send({
                success: false,
                error: { message: 'No token provided', statusCode: 401 },
            });
        }
        const decoded = request.server.jwt.verify(token);
        if (!decoded || !decoded.id) {
            return reply.status(401).send({
                success: false,
                error: { message: 'Invalid token', statusCode: 401 },
            });
        }
        // Get user with roles
        const user = await database_1.default.user.findUnique({
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
        let companyId;
        if (!isAdmin) {
            const userCompany = await database_1.default.userCompany.findFirst({
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
    }
    catch (error) {
        return reply.status(401).send({
            success: false,
            error: { message: 'Invalid or expired token', statusCode: 401 },
        });
    }
};
exports.authenticate = authenticate;
const requireAdmin = async (request, reply) => {
    if (!request.user.isAdmin) {
        return reply.status(403).send({
            success: false,
            error: { message: 'Admin access required', statusCode: 403 },
        });
    }
};
exports.requireAdmin = requireAdmin;
const requireOwner = async (request, reply) => {
    const user = await database_1.default.user.findUnique({
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
exports.requireOwner = requireOwner;
//# sourceMappingURL=auth.js.map