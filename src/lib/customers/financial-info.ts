export const PAYMENT_METHOD_VALUES = [
  "CASH",
  "ZELLE",
  "CARD",
  "CHECK",
  "TRANSFER",
  "OTHER",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

export function normalizePaymentMethod(value: string): PaymentMethod | null {
  const normalized = value.trim().toUpperCase();
  return (PAYMENT_METHOD_VALUES as readonly string[]).includes(normalized)
    ? (normalized as PaymentMethod)
    : null;
}
