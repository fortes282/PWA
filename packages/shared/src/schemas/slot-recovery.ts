import { z } from "zod";

export const SlotRecoveryPriceMode = z.enum(["FULL", "DISCOUNTED_LAST_MINUTE"]);
export type SlotRecoveryPriceMode = z.infer<typeof SlotRecoveryPriceMode>;

export const SlotRecoveryEventStatus = z.enum(["PENDING", "OFFERED", "FILLED", "EXPIRED"]);
export type SlotRecoveryEventStatus = z.infer<typeof SlotRecoveryEventStatus>;

export const SlotRecoveryOfferStatus = z.enum(["OFFERED", "ACCEPTED", "DECLINED", "EXPIRED", "FAILED"]);
export type SlotRecoveryOfferStatus = z.infer<typeof SlotRecoveryOfferStatus>;

export const SlotRecoveryResponseSchema = z.object({
  offerId: z.number().int().positive(),
  action: z.enum(["ACCEPT", "DECLINE"]),
});
export type SlotRecoveryResponseInput = z.infer<typeof SlotRecoveryResponseSchema>;

export const SlotRecoveryProfileSchema = z.object({
  optIn: z.boolean(),
  preferredWindowHours: z.number().int().min(1).max(168).optional(),
});
export type SlotRecoveryProfileInput = z.infer<typeof SlotRecoveryProfileSchema>;
