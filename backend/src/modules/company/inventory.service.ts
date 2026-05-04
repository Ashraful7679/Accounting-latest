import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InventoryService {
  /**
   * Increases the stock amount for a product (e.g., when a GRN is approved).
   * Skips stock adjustment for service items.
   */
  static async increaseStock(tx: any, productId: string, quantity: number) {
    if (!productId || quantity <= 0) return;

    // Skip for services
    const product = await tx.product.findUnique({ where: { id: productId }, select: { isService: true } });
    if (product?.isService) return;

    await tx.product.update({
      where: { id: productId },
      data: {
        stockAmount: {
          increment: quantity
        }
      }
    });
  }

  /**
   * Decreases the stock amount for a product (e.g., when a DN is approved).
   * Skips stock adjustment for service items.
   */
  static async decreaseStock(tx: any, productId: string, quantity: number) {
    if (!productId || quantity <= 0) return;

    // Skip for services
    const product = await tx.product.findUnique({ where: { id: productId }, select: { isService: true } });
    if (product?.isService) return;

    await tx.product.update({
      where: { id: productId },
      data: {
        stockAmount: {
          decrement: quantity
        }
      }
    });
  }

  /**
   * Processes all lines in a GRN and increases stock.
   */
  static async processGRN(tx: any, grnId: string) {
    const grn = await tx.gRN.findUnique({
      where: { id: grnId },
      include: { lines: true }
    });

    if (!grn || grn.status !== 'RECEIVED') return;

    for (const line of grn.lines) {
      if (line.productId) {
        await this.increaseStock(tx, line.productId, line.quantity);
      }
    }
  }

  /**
   * Processes all lines in a DN and decreases stock.
   */
  static async processDN(tx: any, dnId: string) {
    const dn = await tx.dN.findUnique({
      where: { id: dnId },
      include: { lines: true }
    });

    if (!dn || dn.status !== 'SHIPPED') return;

    for (const line of dn.lines) {
      if (line.productId) {
        await this.decreaseStock(tx, line.productId, line.quantity);
      }
    }
  }

  /**
   * Reverts all lines in a GRN and decreases stock.
   */
  static async revertGRN(tx: any, grnId: string) {
    const grn = await tx.gRN.findUnique({
      where: { id: grnId },
      include: { lines: true }
    });

    if (!grn) return;

    for (const line of grn.lines) {
      if (line.productId) {
        await this.decreaseStock(tx, line.productId, line.quantity);
      }
    }
  }

  /**
   * Reverts all lines in a DN and increases stock.
   */
  static async revertDN(tx: any, dnId: string) {
    const dn = await tx.dN.findUnique({
      where: { id: dnId },
      include: { lines: true }
    });

    if (!dn) return;

    for (const line of dn.lines) {
      if (line.productId) {
        await this.increaseStock(tx, line.productId, line.quantity);
      }
    }
  }
}
