import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import { startOfCurrentPeriodMonth } from "@/lib/contracts/service";

export type ContractCategory = "SIGNED" | "PENDING" | "STALE" | "NONE";

export type ContractStatusRow = {
  customerId: string;
  customerName: string;
  status: string;
  category: ContractCategory;
  periodMonth: string | null;
  sentAt: string | null;
  signedAt: string | null;
  pdfUrl: string | null;
};

export async function getContractStatusRows(options?: {
  customerIds?: string[];
}): Promise<ContractStatusRow[]> {
  const currentPeriodMonth = startOfCurrentPeriodMonth();
  const customerFilter = options?.customerIds ? { id: { in: options.customerIds } } : undefined;

  const [customers, contracts] = await Promise.all([
    prisma.customer.findMany({
      where: customerFilter,
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, apellidos: true },
    }),
    prisma.serviceContract.findMany({
      where: options?.customerIds ? { customerId: { in: options.customerIds } } : undefined,
      orderBy: [{ periodMonth: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        customerId: true,
        status: true,
        periodMonth: true,
        sentAt: true,
        clientSignedAt: true,
        pdfUrl: true,
      },
    }),
  ]);

  const latestByCustomer = new Map<string, (typeof contracts)[number]>();
  for (const contract of contracts) {
    if (!latestByCustomer.has(contract.customerId)) {
      latestByCustomer.set(contract.customerId, contract);
    }
  }

  return customers.map((customer) => {
    const contract = latestByCustomer.get(customer.id) ?? null;
    const status = contract?.status ?? "NONE";
    const isStale =
      contract !== null &&
      status !== "SIGNED" &&
      contract.periodMonth.getTime() < currentPeriodMonth.getTime();
    const category: ContractCategory =
      status === "NONE" ? "NONE" : isStale ? "STALE" : status === "SIGNED" ? "SIGNED" : "PENDING";

    return {
      customerId: customer.id,
      customerName: formatCustomerName(customer),
      status,
      category,
      periodMonth: contract?.periodMonth.toISOString() ?? null,
      sentAt: contract?.sentAt?.toISOString() ?? null,
      signedAt: contract?.clientSignedAt?.toISOString() ?? null,
      pdfUrl: contract?.pdfUrl ?? null,
    };
  });
}
