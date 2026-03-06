import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';

export class PIController {
  async getPIs(request: FastifyRequest, reply: FastifyReply) {
    const { id: lcId } = request.params as { id: string };
    const pis = await (prisma as any).pI.findMany({
      where: { lcId },
      orderBy: { piDate: 'desc' }
    });
    return reply.send({ success: true, data: pis });
  }

  async getAllPIs(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { type } = request.query as { type?: string };

    const whereClause: any = {
      OR: [
        { lc: { companyId } },
        { companyId } // Standalone PIs
      ]
    };

    if (type === 'export') {
      whereClause.customerId = { not: null };
    } else if (type === 'import') {
      whereClause.vendorId = { not: null };
    }

    const pis = await (prisma as any).pI.findMany({
      where: whereClause,
      include: {
        lc: {
          include: { customer: { select: { name: true } } }
        },
        customer: { select: { name: true } }
      },
      orderBy: { piDate: 'desc' }
    });
    return reply.send({ success: true, data: pis });
  }

  async getPIDetail(request: FastifyRequest, reply: FastifyReply) {
    const { piId } = request.params as { piId: string };
    const pi = await (prisma as any).pI.findUnique({
      where: { id: piId },
      include: {
        lc: {
          include: { customer: { select: { name: true } } }
        },
        customer: { select: { name: true } }
      }
    });
    if (!pi) return reply.status(404).send({ success: false, message: 'PI not found' });
    return reply.send({ success: true, data: pi });
  }




  async createPI(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    let companyId = id;
    let lcId = data.lcId || null;

    // If route is /lcs/:id/pis, then id is lcId
    if (request.url.includes('/lcs/')) {
      lcId = id;
      const lc = await (prisma as any).lC.findUnique({ where: { id: lcId } });
      if (!lc) return reply.status(404).send({ success: false, message: 'LC not found' });
      companyId = lc.companyId;
    }

    if (lcId) {
      const lc = await (prisma as any).lC.findUnique({
        where: { id: lcId },
        include: { pis: true }
      });
      if (lc) {
        const currentTotalPI = (lc.pis as any[]).reduce((sum: number, pi: any) => sum + pi.amount, 0);
        const newTotalPI = currentTotalPI + Number(data.amount);
        if (newTotalPI > lc.amount) {
          return reply.status(400).send({ 
            success: false, 
            message: `Sum of PIs ($${newTotalPI}) cannot exceed LC total ($${lc.amount})` 
          });
        }
      }
    }

    const pi = await (prisma as any).pI.create({
      data: {
        piNumber: data.piNumber,
        piDate: new Date(data.piDate || new Date()),
        amount: Number(data.amount),
        currency: data.currency || 'USD',
        status: data.status || 'OPEN',
        lcId: lcId,
        companyId: companyId,
        invoiceNumber: data.invoiceNumber,
        submissionToBuyerDate: data.submissionToBuyerDate ? new Date(data.submissionToBuyerDate) : null,
        submissionToBankDate: data.submissionToBankDate ? new Date(data.submissionToBankDate) : null,
        bankAcceptanceDate: data.bankAcceptanceDate ? new Date(data.bankAcceptanceDate) : null,
        maturityDate: data.maturityDate ? new Date(data.maturityDate) : null,
        purchaseApplicationDate: data.purchaseApplicationDate ? new Date(data.purchaseApplicationDate) : null,
        purchaseAmount: data.purchaseAmount ? Number(data.purchaseAmount) : null,
        idbpNumber: data.idbpNumber,
        customerId: data.customerId
      }
    });

    return reply.status(201).send({ success: true, data: pi });
  }


  async updatePI(request: FastifyRequest, reply: FastifyReply) {
    const { piId } = request.params as { piId: string };
    const data = request.body as any;

    if (data.amount) {
      const pi = await (prisma as any).pI.findUnique({ where: { id: piId } });
      if (pi && pi.lcId) {
        const lc = await (prisma as any).lC.findUnique({
          where: { id: pi.lcId },
          include: { pis: true }
        });

        if (lc) {
          const currentTotalPI = (lc.pis as any[]).reduce((sum: number, item: any) => item.id === piId ? sum : sum + item.amount, 0);

          const newTotalPI = currentTotalPI + Number(data.amount);
          if (newTotalPI > lc.amount) {
            return reply.status(400).send({ 
              success: false, 
              message: `Sum of PIs ($${newTotalPI}) cannot exceed LC total ($${lc.amount})` 
            });
          }
        }
      }
    }

    const updatedPI = await (prisma as any).pI.update({

      where: { id: piId },
      data: {
        ...data,
        piDate: data.piDate ? new Date(data.piDate) : undefined,
        amount: data.amount ? Number(data.amount) : undefined,
        invoiceNumber: data.invoiceNumber,
        submissionToBuyerDate: data.submissionToBuyerDate ? new Date(data.submissionToBuyerDate) : undefined,
        submissionToBankDate: data.submissionToBankDate ? new Date(data.submissionToBankDate) : undefined,
        bankAcceptanceDate: data.bankAcceptanceDate ? new Date(data.bankAcceptanceDate) : undefined,
        maturityDate: data.maturityDate ? new Date(data.maturityDate) : undefined,
        purchaseApplicationDate: data.purchaseApplicationDate ? new Date(data.purchaseApplicationDate) : undefined,
        purchaseAmount: data.purchaseAmount ? Number(data.purchaseAmount) : undefined,
        idbpNumber: data.idbpNumber,
        customerId: data.customerId
      }

    });

    return reply.send({ success: true, data: updatedPI });
  }

  async deletePI(request: FastifyRequest, reply: FastifyReply) {
    const { piId } = request.params as { piId: string };
    await (prisma as any).pI.delete({ where: { id: piId } });

    return reply.send({ success: true, message: 'PI deleted' });
  }
}
