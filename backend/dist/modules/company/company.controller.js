"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const base_controller_1 = require("./base.controller");
class CompanyController extends base_controller_1.BaseCompanyController {
    async getCompany(request, reply) {
        const { id } = request.params;
        const company = await database_1.default.company.findUnique({
            where: { id },
            include: {
                branches: true,
                settings: true
            },
        });
        if (!company)
            throw new errorHandler_1.NotFoundError('Company not found');
        return reply.send({ success: true, data: company });
    }
    async getCompanies(request, reply) {
        const companies = await database_1.default.company.findMany({
            include: {
                branches: true,
                settings: true
            },
        });
        return reply.send({ success: true, data: companies });
    }
}
exports.CompanyController = CompanyController;
//# sourceMappingURL=company.controller.js.map