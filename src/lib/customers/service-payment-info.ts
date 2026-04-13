import { parseBusinessDateInput, startOfBusinessDay } from "@/lib/timezone";

export const SERVICE_PAYMENT_TYPE_VALUES = [
  "AUTO_CARD",
  "CARD",
  "ACH",
  "ZELLE",
  "CHECK",
  "CASH",
  "OTHER",
] as const;

export type ServicePaymentType = (typeof SERVICE_PAYMENT_TYPE_VALUES)[number];

export type ServicePaymentInfoData = {
  serviceStartDate: Date | null;
  paymentDay: number | null;
  servicePrice: number | null;
  paymentType: ServicePaymentType | null;
  paymentNotes: string | null;
};

export function normalizeServicePaymentType(
  value: string
): ServicePaymentType | null {
  const normalized = value.trim().toUpperCase().replace(/[\s/-]+/g, "_");
  if (
    SERVICE_PAYMENT_TYPE_VALUES.includes(
      normalized as ServicePaymentType
    )
  ) {
    return normalized as ServicePaymentType;
  }
  return null;
}

export function parseServicePaymentInfoInput(input: {
  serviceStartDate?: string | null;
  paymentDay?: string | null;
  servicePrice?: string | null;
  paymentType?: string | null;
  paymentNotes?: string | null;
}): ServicePaymentInfoData | null {
  const serviceStartDateRaw = String(input.serviceStartDate ?? "").trim();
  const paymentDayRaw = String(input.paymentDay ?? "").trim();
  const servicePriceRaw = String(input.servicePrice ?? "").trim();
  const paymentTypeRaw = String(input.paymentType ?? "").trim();
  const paymentNotes = String(input.paymentNotes ?? "").trim() || null;

  const parsedServiceStartDate = serviceStartDateRaw
    ? parseBusinessDateInput(serviceStartDateRaw)
    : null;
  if (serviceStartDateRaw && !parsedServiceStartDate) {
    return null;
  }

  const parsedPaymentDay = paymentDayRaw ? Number(paymentDayRaw) : null;
  if (
    paymentDayRaw &&
    (!Number.isInteger(parsedPaymentDay) ||
      Number(parsedPaymentDay) < 1 ||
      Number(parsedPaymentDay) > 31)
  ) {
    return null;
  }

  const parsedServicePrice = servicePriceRaw ? Number(servicePriceRaw) : null;
  if (
    servicePriceRaw &&
    (!Number.isFinite(parsedServicePrice) || Number(parsedServicePrice) < 0)
  ) {
    return null;
  }

  const normalizedPaymentType = paymentTypeRaw
    ? normalizeServicePaymentType(paymentTypeRaw)
    : null;
  if (paymentTypeRaw && !normalizedPaymentType) {
    return null;
  }

  return {
    serviceStartDate: parsedServiceStartDate
      ? (startOfBusinessDay(parsedServiceStartDate) ?? parsedServiceStartDate)
      : null,
    paymentDay: parsedPaymentDay,
    servicePrice:
      parsedServicePrice === null
        ? null
        : Math.round(parsedServicePrice * 100) / 100,
    paymentType: normalizedPaymentType,
    paymentNotes,
  };
}
