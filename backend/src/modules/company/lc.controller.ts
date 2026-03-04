import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { FinanceRepository } from '../../repositories/FinanceRepository';

export class LCController {
  async getLCs(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const lcs = await (prisma as any).lC.findMany({
      where: { companyId },
      include: {
        customer: { select: { name: true, code: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ success: true, data: lcs });
  }

  async getLCDetail(request: FastifyRequest, reply: FastifyReply) {
    const { lcId } = request.params as { lcId: string };
    const lc = await (prisma as any).lC.findUnique({
      where: { id: lcId },
      include: {
        customer: true,
        pis: {
          orderBy: { piDate: 'desc' }
        },
        payments: {
          orderBy: { date: 'desc' },
          include: {
            piAllocations: {
              include: { pi: true }
            }
          }
        },
        _count: {
          select: { pis: true, payments: true }
        }
      }
    });


    if (!lc) {
      return reply.status(404).send({ success: false, message: 'LC not found' });
    }

    return reply.send({ success: true, data: lc });
  }


  async createLC(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { piIds, ...data } = request.body as any;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the LC
      const lc = await tx.lC.create({
        data: {
          ...data,
          companyId,
          issueDate: new Date(data.issueDate),
          expiryDate: new Date(data.expiryDate),
          amount: Number(data.amount),
          conversionRate: data.conversionRate ? Number(data.conversionRate) : 1,
          loanValue: data.loanValue ? Number(data.loanValue) : 0,
          customerId: data.customerId,
          receivedDate: data.receivedDate ? new Date(data.receivedDate) : null
        }
      });

      // 2. Link PIs if provided
      if (piIds && Array.isArray(piIds) && piIds.length > 0) {
        // Validate total PI amount vs LC amount if needed (optional based on business flow)
        const pis = await (tx as any).pI.findMany({
          where: { id: { in: piIds } }
        });

        const totalPIAmount = pis.reduce((sum: number, pi: any) => sum + pi.amount, 0);
        if (totalPIAmount > Number(data.amount)) {
          throw new Error(`Total PI amount (${totalPIAmount}) cannot exceed LC amount (${data.amount})`);
        }

        await (tx as any).pI.updateMany({
          where: { id: { in: piIds } },
          data: { lcId: lc.id }
        });
      }



      return lc;
    });

    return reply.status(201).send({ success: true, data: result });
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
        conversionRate: data.conversionRate ? Number(data.conversionRate) : undefined,
        loanValue: data.loanValue ? Number(data.loanValue) : undefined,
        customerId: data.customerId,
        receivedDate: data.receivedDate ? new Date(data.receivedDate) : undefined
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
