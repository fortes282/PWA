import { z } from "zod";

export const ServiceSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  durationMin: z.number().int().positive(),
  price: z.number().nonnegative(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateServiceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  durationMin: z.number().int().positive(),
  price: z.number().nonnegative(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial();

export type Service = z.infer<typeof ServiceSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;
