import { z } from "zod";

export const paymentMethodSchema = z.object({
  cardNumber: z.string().length(16),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/),
  cvv: z.string().length(3),
  cardholderName: z.string().min(2),
});

export const storageTierSchema = z.object({
  tier: z.enum(["GB_5", "GB_20", "GB_50", "GB_100"]),
});
