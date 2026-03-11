import { z } from "zod";

export const WaitlistStatus = z.enum(["WAITING", "NOTIFIED", "BOOKED", "CANCELLED"]);
export type WaitlistStatus = z.infer<typeof WaitlistStatus>;

export const WaitlistEntrySchema = z.object({
  id: z.number(),
  clientId: z.number(),
  serviceId: z.number(),
  employeeId: z.number().nullable().optional(),
  preferredDates: z.array(z.string()).optional(),
  status: WaitlistStatus,
  notifiedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateWaitlistEntrySchema = z.object({
  serviceId: z.number(),
  employeeId: z.number().optional(),
  preferredDates: z.array(z.string()).optional(),
});

export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>;
export type CreateWaitlistEntryInput = z.infer<typeof CreateWaitlistEntrySchema>;
