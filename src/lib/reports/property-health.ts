import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import { readPoolCondition } from "@/lib/customers/pool-condition";
import { getTranslations } from "@/i18n/server";

export type PropertyFlag = "RED" | "YELLOW" | "GREEN" | "UNSET";

export type PropertyHealthIssue = {
  key: string;
  label: string;
  statusLabel: string;
  severity: "BROKEN" | "BAD";
};

export type PropertyHealthRow = {
  propertyId: string;
  customerId: string;
  customerName: string;
  propertyName: string;
  propertyAddress: string;
  flag: PropertyFlag;
  issues: PropertyHealthIssue[];
  notes: string | null;
  updatedAt: string;
};

export function computePropertyFlag(poolCondition: unknown) {
  const entries = readPoolCondition(poolCondition);
  const broken = entries.filter((entry) => entry.status === "BROKEN");
  const bad = entries.filter((entry) => entry.status === "BAD");
  const unset = entries.filter((entry) => entry.status === null);
  const flag: PropertyFlag =
    broken.length > 0
      ? "RED"
      : bad.length > 0
        ? "YELLOW"
        : unset.length === entries.length
          ? "UNSET"
          : "GREEN";
  return { flag, broken, bad };
}

export async function getPropertyHealthRows(options?: {
  customerIds?: string[];
}): Promise<PropertyHealthRow[]> {
  const t = await getTranslations();
  const properties = await prisma.property.findMany({
    where: options?.customerIds ? { customerId: { in: options.customerIds } } : undefined,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      address: true,
      poolCondition: true,
      poolConditionNotes: true,
      updatedAt: true,
      customerId: true,
      customer: { select: { nombre: true, apellidos: true } },
    },
  });

  const itemLabel = (key: string) =>
    t(`admin.customers.detail.properties.condition.items.${key}`);
  const statusLabel = (status: string) =>
    t(`admin.customers.detail.properties.condition.status.${status}`);

  return properties.map((property) => {
    const { flag, broken, bad } = computePropertyFlag(property.poolCondition);
    return {
      propertyId: property.id,
      customerId: property.customerId,
      customerName: formatCustomerName(property.customer),
      propertyName: property.name?.trim() || property.address.trim(),
      propertyAddress: property.address,
      flag,
      issues: [...broken, ...bad].map((entry) => ({
        key: entry.key,
        label: itemLabel(entry.key),
        statusLabel: statusLabel(entry.status as string),
        severity: entry.status as "BROKEN" | "BAD",
      })),
      notes: property.poolConditionNotes,
      updatedAt: property.updatedAt.toISOString(),
    };
  });
}
