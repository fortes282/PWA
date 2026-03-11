import { z } from "zod";

export const InvoiceStatus = z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const InvoiceItemSchema = z.object({
  id: z.number(),
  invoiceId: z.number(),
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const InvoiceSchema = z.object({
  id: z.number(),
  invoiceNumber: z.string(),
  clientId: z.number(),
  status: InvoiceStatus,
  items: z.array(InvoiceItemSchema),
  total: z.number().nonnegative(),
  dueDate: z.string().datetime(),
  paidAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
