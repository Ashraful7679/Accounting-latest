import { z } from 'zod';

export const salesInvoiceLineSchema = z.object({
  productId: z.string().optional(),
  itemDescription: z.string().min(1, 'Product required'),
  quantity: z.number().min(1, 'Min 1'),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).default(0),
  taxAmount: z.number().default(0),
  amount: z.number(),
});

export const createSalesInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  invoiceDate: z.string().min(1, 'Date required'),
  dueDate: z.string().optional(),
  orderType: z.enum(['local', 'foreign']),
  lines: z.array(salesInvoiceLineSchema).min(1),
  notes: z.string().optional(),
});

export type SalesInvoiceFormData = z.infer<typeof createSalesInvoiceSchema>;

export const salesInvoiceDefaultValues = {
  customerId: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  orderType: 'local' as const,
  lines: [{ productId: '', itemDescription: '', quantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, amount: 0 }],
  notes: '',
};