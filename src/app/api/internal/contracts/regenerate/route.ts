import { NextResponse } from "next/server";
import type { ServiceContract } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCompanySignatureUrl } from "@/lib/site-settings";
import {
  buildSnapshotFields,
  customerLocale,
  loadCustomerForContract,
  renderAndStoreContractPdf,
  startOfCurrentPeriodMonth,
} from "@/lib/contracts/service";

function hasValidCronSecret(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return false;
  }
  const received = request.headers.get("x-cron-secret")?.trim();
  return received === expected;
}

export async function POST(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentPeriod = startOfCurrentPeriodMonth();

  const allContracts = await prisma.serviceContract.findMany({
    orderBy: [{ customerId: "asc" }, { periodMonth: "desc" }],
  });

  const latestByCustomer = new Map<string, ServiceContract>();
  for (const contract of allContracts) {
    if (!latestByCustomer.has(contract.customerId)) {
      latestByCustomer.set(contract.customerId, contract);
    }
  }

  let regeneratedCount = 0;
  let skippedCount = 0;

  for (const [customerId, latest] of latestByCustomer) {
    if (
      latest.status !== "SIGNED" ||
      latest.periodMonth.getTime() === currentPeriod.getTime()
    ) {
      skippedCount += 1;
      continue;
    }

    const customer = await loadCustomerForContract(customerId);
    if (!customer) {
      skippedCount += 1;
      continue;
    }

    const snapshot = buildSnapshotFields(customer);
    const locale = customerLocale(customer.idiomaPreferencia);
    const companySignatureUrl = await getCompanySignatureUrl();

    const created = await prisma.serviceContract.create({
      data: {
        customerId,
        locale,
        status: "SIGNED",
        periodMonth: currentPeriod,
        companySignatureUrl,
        clientSignatureUrl: latest.clientSignatureUrl,
        clientSignedAt: latest.clientSignedAt,
        clientSignedVia: latest.clientSignedVia,
        clientSignedByUserId: latest.clientSignedByUserId,
        ...snapshot,
      },
    });

    await renderAndStoreContractPdf(created);
    regeneratedCount += 1;
  }

  return NextResponse.json({
    ok: true,
    regeneratedCount,
    skippedCount,
    period: currentPeriod.toISOString(),
  });
}
