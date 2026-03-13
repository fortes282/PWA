import { z } from "zod";

export const UserRole = z.enum(["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  role: UserRole,
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export const UpdateNotificationPrefsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export type User = z.infer<typeof UserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UpdateNotificationPrefsInput = z.infer<typeof UpdateNotificationPrefsSchema>;

export const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  CLIENT: "/client",
  RECEPTION: "/reception",
  EMPLOYEE: "/employee",
  ADMIN: "/admin",
};
