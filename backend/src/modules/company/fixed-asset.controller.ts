import { FastifyRequest, FastifyReply } from 'fastify';
import { FixedAssetRepository } from '../../repositories/FixedAssetRepository';
import { SequenceService } from './sequence.service';
import prismaBase from '../../config/database';
import { SYSTEM_MODE } from '../../lib/systemMode';

const prisma = prismaBase as any;

export class FixedAssetController {
  static async getAssets(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const { page = 1, limit = 20, search } = request.query as any;
      const assets = await FixedAssetRepository.findMany({ companyId, page, limit, search });
      return reply.send({ success: true, data: assets });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async createAsset(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const data: any = request.body;

      const sequence = await SequenceService.generateDocumentNumber(companyId, 'fixed-asset');
      data.assetNumber = sequence;
      data.companyId = companyId;

      const asset = await FixedAssetRepository.create(data);
      return reply.send({ success: true, data: asset });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async getAsset(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { assetId } = request.params as { assetId: string };
      const asset = await FixedAssetRepository.findById(assetId);
      return reply.send({ success: true, data: asset });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async updateAsset(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { assetId } = request.params as { assetId: string };
      const data: any = request.body;
      const asset = await FixedAssetRepository.update(assetId, data);
      return reply.send({ success: true, data: asset });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async deleteAsset(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { assetId } = request.params as { assetId: string };
      await FixedAssetRepository.delete(assetId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async runDepreciation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      
      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true, depreciated: [] });
      }
      
      const depreciated = await FixedAssetRepository.runDepreciation(companyId);
      return reply.send({ success: true, depreciated });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async dispose(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { assetId } = request.params as { assetId: string };
      const { saleValue, createJournal } = request.body as any;
      
      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true });
      }
      
      const result = await FixedAssetRepository.dispose(assetId, saleValue, createJournal);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }
}