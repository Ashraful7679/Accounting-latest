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
        settings: true
      },
    });

    if (!company) throw new NotFoundError('Company not found');
    return reply.send({ success: true, data: company });
  }

  async getCompanies(request: FastifyRequest, reply: FastifyReply) {
    const companies = await prisma.company.findMany({
      include: {
        settings: true
      },
    });
    return reply.send({ success: true, data: companies });
  }

  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { baseCurrency, lastUsedRate } = request.body as { baseCurrency?: string, lastUsedRate?: number };

    // Update Company Base Currency if provided
    if (baseCurrency) {
      await prisma.company.update({
        where: { id: companyId },
        data: { baseCurrency }
      });
    }

    // Upsert Settings
    const settings = await prisma.companySettings.upsert({
      where: { companyId },
      create: {
        companyId,
        lastUsedRate: lastUsedRate ?? 1,
      },
      update: {
        ...(lastUsedRate !== undefined ? { lastUsedRate } : {})
      }
    });

    return reply.send({ success: true, data: settings });
  }
}
