import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { FinanceRepository } from '../../repositories/FinanceRepository';

export class LoanController {
  async getLoans(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const loans = await FinanceRepository.findLoans(companyId);
    return reply.send({ success: true, data: loans });
  }

  async createLoan(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const data = request.body as any;

    const loan = await prisma.loan.create({
      data: {
        ...data,
        companyId,
        principalAmount: Number(data.principalAmount),
        outstandingBalance: Number(data.outstandingBalance),
        interestRate: Number(data.interestRate),
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null
      }
    });

    return reply.status(201).send({ success: true, data: loan });
  }

  async updateLoan(request: FastifyRequest, reply: FastifyReply) {
    const { loanId } = request.params as { loanId: string };
    const data = request.body as any;

    const loan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        ...data,
        principalAmount: data.principalAmount ? Number(data.principalAmount) : undefined,
        outstandingBalance: data.outstandingBalance ? Number(data.outstandingBalance) : undefined,
        interestRate: data.interestRate ? Number(data.interestRate) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined
      }
    });

    return reply.send({ success: true, data: loan });
  }

  async deleteLoan(request: FastifyRequest, reply: FastifyReply) {
    const { loanId } = request.params as { loanId: string };
    await prisma.loan.delete({ where: { id: loanId } });
    return reply.send({ success: true, message: 'Loan deleted' });
  }
}
