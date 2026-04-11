"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCompanyController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const sequence_service_1 = require("./sequence.service");
class BaseCompanyController {
    async getUserRole(userId, companyId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: { userRoles: { include: { role: true } } },
        });
        if (!user)
            return 'User';
        const userCompany = await database_1.default.userCompany.findUnique({
            where: { userId_companyId: { userId, companyId } },
        });
        if (!userCompany) {
            const isAdmin = user.userRoles.some(ur => ur.role.name === 'Admin');
            if (isAdmin)
                return 'Admin';
            throw new errorHandler_1.ForbiddenError('Access denied: You are not a member of this company');
        }
        return user.userRoles[0]?.role?.name || 'User';
    }
    canEdit(status, role, userId, createdById) {
        const lockedStatuses = ['VERIFIED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CLOSED'];
        if (lockedStatuses.includes(status))
            return false;
        if (role === 'Owner' || role === 'Admin' || role === 'Manager')
            return true;
        if (userId && createdById && userId === createdById) {
            return status === 'DRAFT' || status === 'REJECTED';
        }
        if (role === 'Accountant')
            return status === 'DRAFT' || status === 'REJECTED';
        return false;
    }
    canDelete(status, role) {
        if (status !== 'DRAFT')
            return false;
        if (role === 'Owner' || role === 'Admin')
            return true;
        return false;
    }
    canVerify(status, role) {
        const allowedRoles = ['Owner', 'Manager', 'Admin'];
        if (allowedRoles.includes(role)) {
            return status === 'PENDING_VERIFICATION' || status === 'DRAFT' || status === 'OPEN';
        }
        return false;
    }
    canApprove(status, role) {
        const allowedRoles = ['Owner', 'Admin', 'Manager'];
        if (allowedRoles.includes(role)) {
            return status === 'VERIFIED';
        }
        return false;
    }
    async generateDocumentNumber(companyId, type, prismaOverride) {
        return sequence_service_1.SequenceService.generateDocumentNumber(companyId, type, prismaOverride);
    }
}
exports.BaseCompanyController = BaseCompanyController;
//# sourceMappingURL=base.controller.js.map