import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});

export const RegisterSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
  name: z.string().min(2, "Jméno musí mít alespoň 2 znaky"),
  role: z.enum(["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"]).default("CLIENT"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
