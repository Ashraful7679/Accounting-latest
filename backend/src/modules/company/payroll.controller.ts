import { FastifyRequest, FastifyReply } from 'fastify';
import { PayrollRepository } from '../../repositories/PayrollRepository';
import { SequenceService } from './sequence.service';
import prisma from '../../config/database';
import { SYSTEM_MODE } from '../../lib/systemMode';

export class PayrollController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const data: any = { ...(request.body as any) };

      const sequence = await SequenceService.generateDocumentNumber(companyId, 'payroll-run');
      data.runNumber = sequence;
      data.companyId = companyId;

      const run = await PayrollRepository.create(data);
      return reply.send(run);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async findAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const runs = await PayrollRepository.findMany({ companyId });
      return reply.send(runs);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { runId } = request.params as { runId: string };
      const run = await PayrollRepository.findById(runId);
      return reply.send(run);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { runId } = request.params as { runId: string };
      const data: any = request.body;
      const run = await PayrollRepository.update(runId, data);
      return reply.send(run);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { runId } = request.params as { runId: string };
      await PayrollRepository.delete(runId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async process(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const { period, runDate, options = {} } = request.body as any;
      const { taxRate = 0, generateJournal = true } = options;

      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true, payslips: [] });
      }

      const employees = await prisma.employee.findMany({
        where: { companyId, isActive: true }
      });

      const advances = await prisma.employeeAdvance.findMany({
        where: { employee: { companyId }, status: 'APPROVED' },
        include: { employee: true }
      });
      const loans = await prisma.employeeLoan.findMany({
        where: { employee: { companyId }, status: 'APPROVED' },
        include: { employee: true, repayments: true }
      });

      const runNumber = await SequenceService.generateDocumentNumber(companyId, 'payroll-run');
      const payrollRun = await prisma.payrollRun.create({
        data: { runNumber, companyId, period, runDate: new Date(runDate), status: 'PROCESSED' }
      });

      const payslips = [];
      for (const emp of employees) {
        const basicSalary = (emp as any).salary || 0;
        const grossSalary = basicSalary;

        const empAdvances = advances.filter((a: any) => a.employeeId === emp.id);
        const advanceDeduction = empAdvances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);

        const empLoans = loans.filter((l: any) => l.employeeId === emp.id);
        const loanDeduction = empLoans.reduce((sum: number, l: any) => {
          const currentRep = l.repayments.find((r: any) => r.status === 'PENDING');
          return sum + (currentRep?.amount || 0);
        }, 0);

        const taxDeduction = grossSalary * (taxRate / 100);
        const totalDeductions = taxDeduction + advanceDeduction + loanDeduction;
        const netSalary = grossSalary - totalDeductions;

        const payslip = await PayrollRepository.upsertPayslip({
          payrollRunId: payrollRun.id,
          employeeId: emp.id,
          basicSalary,
          allowances: 0,
          overtime: 0,
          grossSalary,
          taxDeduction,
          advanceDeduction,
          loanDeduction,
          otherDeductions: 0,
          totalDeductions,
          netSalary,
          paymentMethod: (emp as any).paymentTerms || 'BANK',
          status: 'PROCESSED'
        });

        payslips.push(payslip);
      }

      const totalGross = payslips.reduce((sum: number, p: any) => sum + (p.grossSalary || 0), 0);
      const totalDeductionsAll = payslips.reduce((sum: number, p: any) => sum + (p.totalDeductions || 0), 0);
      const totalNet = payslips.reduce((sum: number, p: any) => sum + (p.netSalary || 0), 0);

      await prisma.payrollRun.update({
        where: { id: payrollRun.id },
        data: { totalGross, totalDeductions: totalDeductionsAll, totalNet, status: 'PROCESSED' }
      });

      return reply.send({ success: true, payslips });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async approve(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { runId } = request.params as { runId: string };

      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true });
      }

      const run = await prisma.payrollRun.findUnique({ where: { id: runId } });
      if (!run) return reply.status(404).send({ error: 'Payroll run not found' });

      const updated = await prisma.payrollRun.update({
        where: { id: runId },
        data: { status: 'APPROVED' },
        include: { payslips: { include: { employee: true } } }
      });

      return reply.send(updated);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async markPaid(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { payslipId } = request.params as { payslipId: string };
      await PayrollRepository.markPayslipPaid(payslipId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }
}