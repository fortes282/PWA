import { z } from "zod";

export const NotificationType = z.enum([
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_REMINDER",
  "APPOINTMENT_CANCELLED",
  "WAITLIST_AVAILABLE",
  "INVOICE",
  "GENERAL",
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const NotificationSchema = z.object({
  id: z.number(),
  userId: z.number(),
  type: NotificationType,
  title: z.string(),
  message: z.string(),
  isRead: z.boolean().default(false),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof NotificationSchema>;
