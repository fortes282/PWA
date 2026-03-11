import { z } from "zod";

export const RoomSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  capacity: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

export const UpdateRoomSchema = CreateRoomSchema.partial();

export type Room = z.infer<typeof RoomSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
