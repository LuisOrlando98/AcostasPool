export type EditableInvoiceLineItem = {
  label: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  serviceCode?: string | null;
};

export function roundCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeInvoiceLineItems(value: unknown): EditableInvoiceLineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const label = typeof entry?.label === "string" ? entry.label.trim() : "";
      const serviceCode =
        typeof entry?.serviceCode === "string" && entry.serviceCode.trim()
          ? entry.serviceCode.trim()
          : null;
      const quantityRaw = Number(entry?.quantity ?? 1);
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
      const unitPriceRaw = Number(entry?.unitPrice ?? entry?.amount ?? 0);
      const unitPrice = Number.isFinite(unitPriceRaw) && unitPriceRaw >= 0 ? unitPriceRaw : 0;
      const amount = roundCurrency(quantity * unitPrice);

      return {
        label,
        quantity,
        unitPrice,
        amount,
        serviceCode,
      };
    })
    .filter((item) => item.label.length > 0 && item.quantity > 0 && item.amount >= 0);
}
