import { FastifyRequest, FastifyReply } from 'fastify';
import { FixedAssetRepository } from '../../repositories/FixedAssetRepository';
import { SequenceService } from './sequence.service';
import prismaBase from '../../config/database';
import { SYSTEM_MODE } from '../../lib/systemMode';

// FixedAsset model not yet in Prisma schema — cast to any for forward-compatibility
const prisma = prismaBase as any;

export class FixedAssetController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const data: any = request.body;

      const sequence = await SequenceService.generateDocumentNumber(companyId, 'fixed-asset');
      data.assetNumber = sequence;
      data.companyId = companyId;

      const asset = await FixedAssetRepository.create(data);
      return reply.send(asset);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async findAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const assets = await FixedAssetRepository.findMany({ companyId });
      return reply.send(assets);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { assetId } = request.params as { assetId: string };
      const asset = await FixedAssetRepository.findById(assetId);
      return reply.send(asset);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { assetId } = request.params as { assetId: string };
      const data: any = request.body;
      const asset = await FixedAssetRepository.update(assetId, data);
      return reply.send(asset);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
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
      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true, depreciated: [] });
      }
      // FixedAsset model not yet in schema — return stub
      return reply.send({ success: true, depreciated: [], message: 'FixedAsset model pending migration' });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async dispose(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true });
      }
      return reply.send({ success: true, message: 'FixedAsset model pending migration' });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }
}