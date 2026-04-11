"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DimensionController = void 0;
const database_1 = __importDefault(require("../../config/database"));
class DimensionController {
    // Branches
    async getBranches(request, reply) {
        const { id: companyId } = request.params;
        const branches = await database_1.default.branch.findMany({ where: { companyId } });
        return reply.send({ success: true, data: branches });
    }
    // Projects
    async getProjects(request, reply) {
        const { id: companyId } = request.params;
        const projects = await database_1.default.project.findMany({ where: { companyId } });
        return reply.send({ success: true, data: projects });
    }
    async createProject(request, reply) {
        const { id: companyId } = request.params;
        const { code, name } = request.body;
        const project = await database_1.default.project.create({
            data: { code, name, companyId }
        });
        return reply.status(201).send({ success: true, data: project });
    }
    // Cost Centers
    async getCostCenters(request, reply) {
        const { id: companyId } = request.params;
        const costCenters = await database_1.default.costCenter.findMany({ where: { companyId } });
        return reply.send({ success: true, data: costCenters });
    }
    async createCostCenter(request, reply) {
        const { id: companyId } = request.params;
        const { code, name } = request.body;
        const costCenter = await database_1.default.costCenter.create({
            data: { code, name, companyId }
        });
        return reply.status(201).send({ success: true, data: costCenter });
    }
}
exports.DimensionController = DimensionController;
//# sourceMappingURL=dimension.controller.js.map