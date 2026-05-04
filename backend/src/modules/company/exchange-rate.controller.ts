import { FastifyRequest, FastifyReply } from 'fastify';
import prismaBase from '../../config/database';
import { SYSTEM_MODE } from '../../lib/systemMode';

// Cast to any to allow dynamic ExchangeRate model usage
const prisma = prismaBase as any;

export class ExchangeRateController {
  static async getRates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const { from, to } = request.query as { from?: string; to?: string };

      const where: any = { companyId };
      if (from) where.fromCurrency = from;
      if (to) where.toCurrency = to;

      const rates = await prisma.exchangeRate.findMany({
        where,
        orderBy: { effectiveDate: 'desc' },
        take: 100
      });

      return reply.send(rates);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async setRate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const { fromCurrency, toCurrency, rate, effectiveDate, isSystem } = request.body as any;

      const exchangeRate = await prisma.exchangeRate.upsert({
        where: {
          companyId_fromCurrency_toCurrency_effectiveDate: {
            companyId, fromCurrency, toCurrency,
            effectiveDate: new Date(effectiveDate)
          }
        },
        create: { companyId, fromCurrency, toCurrency, rate, effectiveDate: new Date(effectiveDate), isSystem: isSystem || false },
        update: { rate, isSystem: isSystem || false }
      });

      return reply.send(exchangeRate);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async getLatestRates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };

      const rates = await prisma.exchangeRate.findMany({
        where: { companyId },
        orderBy: { effectiveDate: 'desc' }
      });

      const latestByPair = new Map();
      for (const r of rates) {
        const key = `${r.fromCurrency}-${r.toCurrency}`;
        if (!latestByPair.has(key)) latestByPair.set(key, r);
      }

      return reply.send(Array.from(latestByPair.values()));
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async revalueCurrency(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true, revalued: [] });
      }
      return reply.send({ success: true, revalued: [], message: 'Revaluation requires LIVE mode' });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }
}