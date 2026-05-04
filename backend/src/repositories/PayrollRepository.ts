import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export class PayrollRepository {
  static async findMany(where = {}) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.payrollRun.findMany({
          where,
          include: { _count: { select: { payslips: true } } },
          orderBy: { runDate: 'desc' }
        });
      } catch (e) { console.error('Error:', e); return []; }
    }
    return [];
  }

  static async findById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.payrollRun.findUnique({
          where: { id },
          include: { payslips: { include: { employee: true } } }
        });
      } catch (e) { console.error('Error:', e); return null; }
    }
    return null;
  }

  static async create(data: any) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.payrollRun.create({
        data,
        include: { payslips: true }
      });
    }
    return { ...data, id: `offline-${Date.now()}` };
  }

  static async update(id: string, data: any) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.payrollRun.update({
        where: { id },
        data,
        include: { payslips: { include: { employee: true } } }
      });
    }
    return null;
  }

  static async delete(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.payrollRun.delete({ where: { id } });
    }
    return null;
  }

  static async upsertPayslip(data: any) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.payrollPayslip.upsert({
        where: { payrollRunId_employeeId: { payrollRunId: data.payrollRunId, employeeId: data.employeeId } },
        create: data,
        update: data
      });
    }
    return null;
  }

  static async markPayslipPaid(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.payrollPayslip.update({
        where: { id },
        data: { status: 'PAID' }
      });
    }
    return null;
  }
}