import { prisma } from "@/lib/db";
import type { ChecklistItem } from "@/lib/jobs/templates";

export type ServiceTierChecklist = ChecklistItem[];

export const DEFAULT_SERVICE_TIERS: Array<{
  name: string;
  checklist: ServiceTierChecklist;
}> = [
  {
    name: "Standard",
    checklist: [
      { label: "Skim surface debris", completed: false },
      { label: "Brush walls and steps", completed: false },
      { label: "Vacuum pool floor", completed: false },
      { label: "Empty skimmer baskets", completed: false },
    ],
  },
  {
    name: "Gold",
    checklist: [
      { label: "Skim surface debris", completed: false },
      { label: "Brush walls and steps", completed: false },
      { label: "Vacuum pool floor", completed: false },
      { label: "Empty skimmer baskets", completed: false },
      { label: "Backwash/clean filter", completed: false },
      { label: "Test chlorine and pH", completed: false },
    ],
  },
  {
    name: "Premium",
    checklist: [
      { label: "Skim surface debris", completed: false },
      { label: "Brush walls and steps", completed: false },
      { label: "Vacuum pool floor", completed: false },
      { label: "Empty skimmer baskets", completed: false },
      { label: "Backwash/clean filter", completed: false },
      { label: "Test and balance chemicals", completed: false },
      { label: "Inspect equipment and leaks", completed: false },
    ],
  },
];

export async function ensureServiceTiers() {
  const existing = await prisma.serviceTier.count();
  if (existing > 0) {
    return;
  }
  await prisma.serviceTier.createMany({
    data: DEFAULT_SERVICE_TIERS.map((tier) => ({
      name: tier.name,
      checklist: tier.checklist,
    })),
  });
}

export async function getServiceTiers() {
  await ensureServiceTiers();
  return prisma.serviceTier.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function getDefaultServiceTierId() {
  await ensureServiceTiers();
  const tier =
    (await prisma.serviceTier.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.serviceTier.findFirst({ orderBy: { createdAt: "asc" } }));
  return tier?.id ?? null;
}

export async function getServiceTierChecklist(serviceTierId?: string | null) {
  if (!serviceTierId) {
    const fallbackId = await getDefaultServiceTierId();
    if (!fallbackId) {
      return [];
    }
    const fallback = await prisma.serviceTier.findUnique({
      where: { id: fallbackId },
    });
    return normalizeChecklist(fallback?.checklist);
  }

  const tier = await prisma.serviceTier.findUnique({
    where: { id: serviceTierId },
  });
  return normalizeChecklist(tier?.checklist);
}

export function normalizeChecklist(
  value: unknown,
  fallback: ServiceTierChecklist = []
): ServiceTierChecklist {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { label: item.trim(), completed: false };
      }
      if (item && typeof item === "object") {
        const label = String((item as { label?: string }).label ?? "").trim();
        if (!label) {
          return null;
        }
        return { label, completed: false };
      }
      return null;
    })
    .filter((item): item is ChecklistItem => Boolean(item));
}
