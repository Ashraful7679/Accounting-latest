import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { SYSTEM_MODE } from '../../lib/systemMode';

/**
 * Resolves currency code (e.g. "USD") to Currency.id.
 */
async function resolveCurrencyId(code: string) {
  const currency = await prisma.currency.findUnique({ where: { code } });
  if (!currency) throw new Error(`Currency "${code}" not found`);
  return currency.id;
}

export class ExchangeRateController {
  static async getRates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { from, to } = request.query as { from?: string; to?: string };

      const where: any = {};
      if (from) where.fromCurrency = { code: from };
      if (to) where.toCurrency = { code: to };

      const rates = await prisma.exchangeRate.findMany({
        where,
        orderBy: { rateDate: 'desc' },
        take: 100,
        include: { fromCurrency: true, toCurrency: true }
      });

      return reply.send({ success: true, data: rates });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  }

  static async setRate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { fromCurrencyCode, toCurrencyCode, rate, rateDate } = request.body as any;

      if (!fromCurrencyCode || !toCurrencyCode || !rate) {
        return reply.status(400).send({ success: false, error: 'fromCurrencyCode, toCurrencyCode, and rate are required' });
      }

      const fromCurrencyId = await resolveCurrencyId(fromCurrencyCode);
      const toCurrencyId = await resolveCurrencyId(toCurrencyCode);

      const exchangeRate = await prisma.exchangeRate.create({
        data: {
          fromCurrencyId,
          toCurrencyId,
          rate: Number(rate),
          rateDate: rateDate ? new Date(rateDate) : new Date(),
          source: 'MANUAL'
        },
        include: { fromCurrency: true, toCurrency: true }
      });

      return reply.send({ success: true, data: exchangeRate });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  }

  static async getLatestRates(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Fetch the latest rate for each currency pair
      const allRates = await prisma.exchangeRate.findMany({
        orderBy: { rateDate: 'desc' },
        include: { fromCurrency: true, toCurrency: true }
      });

      const latestByPair = new Map();
      for (const r of allRates) {
        const key = `${r.fromCurrency.code}-${r.toCurrency.code}`;
        if (!latestByPair.has(key)) latestByPair.set(key, r);
      }

      return reply.send({ success: true, data: Array.from(latestByPair.values()) });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  }

  static async revalueCurrency(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true, revalued: [] });
      }
      return reply.send({ success: true, revalued: [], message: 'Revaluation requires LIVE mode' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  }
}