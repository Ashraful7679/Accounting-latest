import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { FinanceRepository } from '../../repositories/FinanceRepository';

export class LCController {
  async getLCs(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const lcs = await FinanceRepository.findLCs(companyId);
    return reply.send({ success: true, data: lcs });
  }

  async createLC(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const data = request.body as any;

    const lc = await prisma.lC.create({
      data: {
        ...data,
        companyId,
        issueDate: new Date(data.issueDate),
        expiryDate: new Date(data.expiryDate),
        amount: Number(data.amount),
        conversionRate: data.conversionRate ? Number(data.conversionRate) : 1
      }
    });

    return reply.status(201).send({ success: true, data: lc });
  }

  async updateLC(request: FastifyRequest, reply: FastifyReply) {
    const { lcId } = request.params as { lcId: string };
    const data = request.body as any;

    const lc = await prisma.lC.update({
      where: { id: lcId },
      data: {
        ...data,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        amount: data.amount ? Number(data.amount) : undefined,
        conversionRate: data.conversionRate ? Number(data.conversionRate) : undefined
      }
    });

    return reply.send({ success: true, data: lc });
  }

  async deleteLC(request: FastifyRequest, reply: FastifyReply) {
    const { lcId } = request.params as { lcId: string };
    await prisma.lC.delete({ where: { id: lcId } });
    return reply.send({ success: true, message: 'LC deleted' });
  }

  async approveLC(request: FastifyRequest, reply: FastifyReply) {
    const { lcId } = request.params as { lcId: string };

    // LC Mandatory Attachment Rule (RMG Best Practice)
    const attachmentCount = await prisma.attachment.count({
      where: { entityType: 'LC', entityId: lcId, isActive: true }
    });

    if (attachmentCount === 0) {
      return reply.status(400).send({ 
        success: false, 
        message: 'RMG Policy: At least one document (LC Copy) must be attached before approval.' 
      });
    }

    const lc = await prisma.lC.update({
      where: { id: lcId },
      data: { status: 'APPROVED' }
    });

    return reply.send({ success: true, data: lc });
  }
}
