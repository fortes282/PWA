import { z } from "zod";

export const CreditTransactionType = z.enum([
  "PURCHASE",
  "USE",
  "REFUND",
  "ADJUSTMENT",
]);
export type CreditTransactionType = z.infer<typeof CreditTransactionType>;

export const CreditTransactionSchema = z.object({
  id: z.number(),
  userId: z.number(),
  appointmentId: z.number().nullable().optional(),
  type: CreditTransactionType,
  amount: z.number(),
  balance: z.number(),
  note: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const CreditBalanceSchema = z.object({
  userId: z.number(),
  balance: z.number(),
});

export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;
export type CreditBalance = z.infer<typeof CreditBalanceSchema>;
