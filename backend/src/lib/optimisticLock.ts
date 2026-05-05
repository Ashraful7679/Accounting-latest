import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';

export interface LockableModel {
  modelName: keyof typeof prisma;
  idParam: string;
}

const LOCKABLE_MODELS: Record<string, LockableModel> = {
  'sales-order': { modelName: 'salesOrder', idParam: 'soId' },
  'purchase-order': { modelName: 'purchaseOrder', idParam: 'poId' },
  'invoice': { modelName: 'invoice', idParam: 'invoiceId' },
  'journal-entry': { modelName: 'journalEntry', idParam: 'journalId' },
  'customer': { modelName: 'customer', idParam: 'customerId' },
  'vendor': { modelName: 'vendor', idParam: 'vendorId' },
  'product': { modelName: 'product', idParam: 'productId' },
  'employee': { modelName: 'employee', idParam: 'employeeId' },
};

export async function checkOptimisticLock(
  request: FastifyRequest,
  reply: FastifyReply,
  modelType: keyof typeof LOCKABLE_MODELS
) {
  const config = LOCKABLE_MODELS[modelType];
  if (!config) return;
  
  const clientVersion = request.headers['if-match'] as string;
  const entityId = request.params[config.idParam] || request.params['id'];
  
  if (!clientVersion || !entityId) return;
  
  const model = prisma[config.modelName];
  const entity = await (model as any).findUnique({
    where: { id: entityId },
    select: { updatedAt: true }
  });
  
  if (!entity) {
    throw new NotFoundError(`${modelType.replace('-', ' ')} not found`);
  }
  
  const serverVersion = entity.updatedAt?.toISOString() || '';
  
  if (serverVersion && clientVersion !== serverVersion) {
    reply.code(412).send({
      code: 'OPTIMISTIC_LOCK',
      message: `This record has been modified by another user. Please refresh and try again.`,
      serverVersion,
      localVersion: clientVersion
    });
  }
}