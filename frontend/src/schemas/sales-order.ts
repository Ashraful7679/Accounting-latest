import { z } from 'zod';

export const salesOrderLineSchema = z.object({
  productId: z.string().optional(),
  itemDescription: z.string().min(1, 'Product is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Price must be positive'),
  total: z.number().min(0),
});

export const createSalesOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  soDate: z.string().min(1, 'Order date is required'),
  expectedDeliveryDate: z.string().optional(),
  orderType: z.enum(['local', 'foreign']),
  currency: z.string().default('BDT'),
  exchangeRate: z.number().min(0.01).default(1),
  totalBDT: z.number().min(0).default(0),
  totalForeign: z.number().min(0).default(0),
  lines: z.array(salesOrderLineSchema).min(1, 'At least one line item is required'),
  notes: z.string().optional(),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;

export const salesOrderDefaultValues = {
  customerId: '',
  soDate: new Date().toISOString().split('T')[0],
  expectedDeliveryDate: '',
  orderType: 'local' as const,
  currency: 'BDT',
  exchangeRate: 1,
  totalBDT: 0,
  totalForeign: 0,
  lines: [{ productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }],
  notes: '',
};