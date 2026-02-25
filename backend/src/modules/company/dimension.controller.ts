import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';

export class DimensionController {
  
  // Projects
  async getProjects(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const projects = await prisma.project.findMany({ where: { companyId } });
    return reply.send({ success: true, data: projects });
  }

  async createProject(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { code, name } = request.body as any;
    const project = await prisma.project.create({
      data: { code, name, companyId }
    });
    return reply.status(201).send({ success: true, data: project });
  }

  // Cost Centers
  async getCostCenters(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const costCenters = await prisma.costCenter.findMany({ where: { companyId } });
    return reply.send({ success: true, data: costCenters });
  }

  async createCostCenter(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { code, name } = request.body as any;
    const costCenter = await prisma.costCenter.create({
      data: { code, name, companyId }
    });
    return reply.status(201).send({ success: true, data: costCenter });
  }
}
