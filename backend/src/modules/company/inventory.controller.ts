import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';

export class InventoryController {
  // ─── Warehouses ───────────────────────────────────────────────
  async getWarehouses(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: warehouses });
  }

  async createWarehouse(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { name, code, address, isDefault } = request.body as any;
    const warehouse = await prisma.warehouse.create({
      data: { companyId, name, code, address, isDefault: isDefault || false },
    });
    return reply.status(201).send({ success: true, data: warehouse });
  }

  async updateWarehouse(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, warehouseId } = request.params as { id: string; warehouseId: string };
    const { name, code, address, isDefault } = request.body as any;
    const warehouse = await prisma.warehouse.update({
      where: { id: warehouseId, companyId },
      data: { name, code, address, isDefault },
    });
    return reply.send({ success: true, data: warehouse });
  }

  async deleteWarehouse(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, warehouseId } = request.params as { id: string; warehouseId: string };
    await prisma.warehouse.delete({ where: { id: warehouseId, companyId } });
    return reply.send({ success: true, message: 'Warehouse deleted' });
  }

  // ─── Stock Transfers ──────────────────────────────────────────
  async getStockTransfers(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const transfers = await prisma.stockTransfer.findMany({
      where: { companyId },
      include: {
        lines: { include: { product: true } },
        fromWarehouse: true,
        toWarehouse: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: transfers });
  }

  async getStockTransfer(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, transferId } = request.params as { id: string; transferId: string };
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, companyId },
      include: {
        lines: { include: { product: true } },
        fromWarehouse: true,
        toWarehouse: true,
      },
    });
    if (!transfer) return reply.status(404).send({ success: false, error: { message: 'Transfer not found' } });
    return reply.send({ success: true, data: transfer });
  }

  async createStockTransfer(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { fromWarehouseId, toWarehouseId, lines, notes } = request.body as any;

    if (!fromWarehouseId || !toWarehouseId || !lines || lines.length === 0) {
      return reply.status(422).send({ success: false, error: { message: 'fromWarehouseId, toWarehouseId, and lines are required' } });
    }

    // Verify warehouses belong to company
    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: fromWarehouseId, companyId } }),
      prisma.warehouse.findUnique({ where: { id: toWarehouseId, companyId } }),
    ]);
    if (!fromWh || !toWh) return reply.status(404).send({ success: false, error: { message: 'Warehouse not found' } });
    if (fromWarehouseId === toWarehouseId) return reply.status(422).send({ success: false, error: { message: 'Cannot transfer to same warehouse' } });

    // Generate transfer number
    const count = await prisma.stockTransfer.count({ where: { companyId } });
    const transferNumber = `ST-${String(count + 1).padStart(5, '0')}`;

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.stockTransfer.create({
        data: {
          companyId,
          transferNumber,
          fromWarehouseId,
          toWarehouseId,
          notes,
          lines: {
            create: lines.map((line: any) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          },
        },
        include: { lines: true },
      });

      return created;
    });

    return reply.status(201).send({ success: true, data: transfer });
  }

  async approveStockTransfer(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, transferId } = request.params as { id: string; transferId: string };
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, companyId },
      include: { lines: true },
    });
    if (!transfer) return reply.status(404).send({ success: false, error: { message: 'Transfer not found' } });
    if (transfer.status === 'APPROVED') return reply.status(400).send({ success: false, error: { message: 'Already approved' } });

    const approved = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'APPROVED' },
      include: { lines: true },
    });

    return reply.send({ success: true, data: approved });
  }

  async deleteStockTransfer(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, transferId } = request.params as { id: string; transferId: string };
    const transfer = await prisma.stockTransfer.findFirst({ where: { id: transferId, companyId } });
    if (!transfer) return reply.status(404).send({ success: false, error: { message: 'Transfer not found' } });
    if (transfer.status === 'APPROVED') return reply.status(400).send({ success: false, error: { message: 'Cannot delete approved transfer' } });

    await prisma.stockTransfer.delete({ where: { id: transferId } });
    return reply.send({ success: true, message: 'Transfer deleted' });
  }
}
