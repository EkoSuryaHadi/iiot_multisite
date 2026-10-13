import { z } from "zod";

// Password Schema Base
const passwordField = z
  .string({ error: "Password is required" })
  .min(8, { message: "Password must be more than 8 characters" })
  .max(15, { message: "Password must be less than 15 characters" })
  .regex(/[a-zA-Z]/, { message: "Contain at least one letter." })
  .regex(/[0-9]/, { message: "Contain at least one number." })
  .regex(/[^a-zA-Z0-9]/, { message: "Contain at least one special character." })
  .trim();

// Email schema base
const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email!");

// Login Schema - validasi password di sini HANYA "wajib diisi", bukan kompleksitas,
// karena aturan panjang/kompleksitas password ditentukan oleh device-mgmt (min 6 karakter)
// saat user dibuat, bukan saat login.
export const loginSchema = z.object({
  email: emailField,
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

// Register Schema
export const registerSchema = loginSchema.extend({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  acceptTerms: z.literal(true, {
    error: "You must accept the terms and conditions",
  }),
});

// Forgot Password Schema
export const forgotPasswordSchema = z.object({
  email: emailField,
});

// Create Password Schema
export const createPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string({
      error: "Confirm Password is required",
    }),
    acceptTerms: z.literal(true, {
      error: "You must accept the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password does not match",
    path: ["confirmPassword"],
  });

export const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type FormSchemaType = z.infer<typeof formSchema>;
