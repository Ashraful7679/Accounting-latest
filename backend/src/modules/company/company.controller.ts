import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { NotFoundError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';

export class CompanyController extends BaseCompanyController {
  
  async getCompany(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        branches: true,
        settings: true
      },
    });

    if (!company) throw new NotFoundError('Company not found');
    return reply.send({ success: true, data: company });
  }

  async getCompanies(request: FastifyRequest, reply: FastifyReply) {
    const companies = await prisma.company.findMany({
      include: {
        branches: true,
        settings: true
      },
    });
    return reply.send({ success: true, data: companies });
  }
}
