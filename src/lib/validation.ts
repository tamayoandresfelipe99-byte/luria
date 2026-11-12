import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from "./security/password";

/**
 * Esquemas de entrada. Regla general: `.strict()` en lo que llega del navegador,
 * para que campos como `amount`, `price`, `status` o `role` se rechacen (A04).
 */

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Escribe tu nombre").max(120),
    email: z.string().trim().toLowerCase().email("Correo no válido").max(254),
    password: z.string().min(PASSWORD_MIN, `Mínimo ${PASSWORD_MIN} caracteres`).max(PASSWORD_MAX),
    phone: z
      .string()
      .trim()
      .regex(/^\+?57?\s?3\d{9}$/, "Celular colombiano no válido")
      .optional()
      .or(z.literal("")),
    acceptTerms: z.literal("on", { error: "Debes aceptar los términos" }),
    acceptPrivacy: z.literal("on", { error: "Debes aceptar el aviso de privacidad" }),
    marketing: z.literal("on").optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.password, { name: v.name });
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
  });

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(PASSWORD_MAX) }).strict();

export const recoverSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();

/** Compra: el cliente NO envía precio ni producto distinto al vigente. */
export const createOrderSchema = z
  .object({
    acceptPurchaseTerms: z.literal(true),
    acknowledgedDesktop: z.literal(true),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export const eligibilitySchema = z
  .object({
    platform: z.enum(["zajuna", "otra"]),
    domain: z.string().trim().max(200).optional().or(z.literal("")),
    browser: z.enum(["chrome", "edge", "firefox", "safari", "otro"]),
    device: z.enum(["escritorio", "portatil", "tableta", "celular"]),
    virtualOnly: z.enum(["si", "no"]),
  })
  .strict();

export const supportSchema = z
  .object({
    category: z.enum(["compra", "instalacion", "compatibilidad", "pago", "renovacion", "tecnica", "otra"]),
    description: z
      .string()
      .trim()
      .min(10)
      .max(2000)
      .refine((v) => !/contrase(ñ|n)a\s*[:=]/i.test(v), "No incluyas contraseñas en la solicitud."),
  })
  .strict();

export const consentSchema = z.object({ purpose: z.enum(["marketing", "analytics"]), granted: z.boolean() }).strict();

export const manualPaymentSchema = z
  .object({
    orderReference: z.string().regex(/^LUR-\d{8}-[A-Z0-9]{10}$/),
    method: z.enum(["nequi", "transferencia", "otro"]),
    externalReference: z.string().trim().min(4).max(80),
    amountCop: z.number().int().positive(),
    paidAt: z.string().datetime(),
    evidenceNote: z.string().trim().min(10).max(1000),
  })
  .strict();
