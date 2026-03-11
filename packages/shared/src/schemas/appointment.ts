import { z } from "zod";

export const AppointmentStatus = z.enum([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatus>;

export const AppointmentSchema = z.object({
  id: z.number(),
  clientId: z.number(),
  employeeId: z.number(),
  serviceId: z.number(),
  roomId: z.number().nullable().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: AppointmentStatus,
  notes: z.string().nullable().optional(),
  price: z.number().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateAppointmentSchema = z.object({
  clientId: z.number(),
  employeeId: z.number(),
  serviceId: z.number(),
  roomId: z.number().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
  price: z.number().optional(),
});

export const UpdateAppointmentSchema = CreateAppointmentSchema.partial().extend({
  status: AppointmentStatus.optional(),
});

export type Appointment = z.infer<typeof AppointmentSchema>;
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;
