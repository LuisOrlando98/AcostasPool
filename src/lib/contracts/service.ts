import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { BUSINESS_TIMEZONE, formatInBusinessTimeZone } from "@/lib/timezone";
import { formatCustomerAddress, formatCustomerName } from "@/lib/customers/format";
import { formatUsPhone } from "@/lib/phones";
import { normalizeChecklist } from "@/lib/service-tiers";
import { readPoolCondition } from "@/lib/customers/pool-condition";
import { getInvoiceTemplateConfig } from "@/lib/site-settings";
import { getTranslations } from "@/i18n/server";
import {
  storePublicAsset,
  readStoredAsset,
} from "@/lib/storage/object-store";
import {
  buildContractPdfAssetPath,
  buildContractSignatureAssetPath,
} from "@/lib/storage/paths";
import {
  buildServiceContractPdfBytes,
  type PoolConditionRow,
} from "@/lib/contracts/service-contract-pdf";
import type { ServiceContractLocale } from "@/lib/contracts/service-contract-content";
import type { Prisma, ServiceContract } from "@prisma/client";

export function startOfCurrentPeriodMonth(): Date {
  return DateTime.now().setZone(BUSINESS_TIMEZONE).startOf("month").toUTC().toJSDate();
}

export function customerLocale(idiomaPreferencia: string): ServiceContractLocale {
  return idiomaPreferencia === "ES" ? "es" : "en";
}

type CustomerWithPropertyAndTier = Prisma.CustomerGetPayload<{
  include: {
    properties: true;
    contractedServiceTier: { select: { name: true; checklist: true } };
  };
}>;

export async function loadCustomerForContract(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      properties: { orderBy: { createdAt: "asc" }, take: 1 },
      contractedServiceTier: { select: { name: true, checklist: true } },
    },
  });
  return customer as CustomerWithPropertyAndTier | null;
}

export function buildSnapshotFields(customer: CustomerWithPropertyAndTier) {
  const primaryProperty = customer.properties[0] ?? null;
  return {
    customerNameSnapshot: formatCustomerName(customer),
    customerEmailSnapshot: customer.email || null,
    customerPhoneSnapshot: formatUsPhone(customer.telefono) || null,
    customerAddressSnapshot: formatCustomerAddress(customer) || null,
    propertyAddressSnapshot: primaryProperty?.address ?? null,
    poolTypeSnapshot: primaryProperty?.poolType ?? null,
    planNameSnapshot: customer.contractedServiceTier?.name ?? null,
    servicePriceSnapshot: primaryProperty?.servicePrice ?? null,
    paymentDaySnapshot: primaryProperty?.paymentDay ?? null,
    paymentMethodSnapshot: customer.paymentMethod ?? null,
    paymentTypeSnapshot: primaryProperty?.paymentType ?? null,
    poolConditionSnapshot: readPoolCondition(
      primaryProperty?.poolCondition
    ) as unknown as Prisma.InputJsonValue,
    propertyId: primaryProperty?.id ?? null,
  };
}

export function getPlanServiceLabels(customer: CustomerWithPropertyAndTier) {
  return normalizeChecklist(customer.contractedServiceTier?.checklist).map(
    (item) => item.label
  );
}

async function readSignatureBytes(url: string | null): Promise<Uint8Array | null> {
  if (!url) {
    return null;
  }
  try {
    return await readStoredAsset(url);
  } catch (error) {
    console.error("service-contract: could not read signature asset", url, error);
    return null;
  }
}

export async function renderContractPdfBytes(
  contract: ServiceContract
): Promise<Uint8Array> {
  const locale: ServiceContractLocale = contract.locale === "es" ? "es" : "en";
  const t = await getTranslations(locale);
  const company = await getInvoiceTemplateConfig();

  const poolConditionRaw = readPoolCondition(contract.poolConditionSnapshot);
  const poolCondition: PoolConditionRow[] = poolConditionRaw
    .filter((entry) => entry.status)
    .map((entry) => ({
      label: t(`admin.customers.detail.properties.condition.items.${entry.key}`),
      status: entry.status,
      statusLabel: entry.status
        ? t(`admin.customers.detail.properties.condition.status.${entry.status}`)
        : null,
    }));

  const [companySignatureImageBytes, clientSignatureImageBytes] = await Promise.all([
    readSignatureBytes(contract.companySignatureUrl),
    readSignatureBytes(contract.clientSignatureUrl),
  ]);

  return buildServiceContractPdfBytes({
    locale,
    customerName: contract.customerNameSnapshot,
    customerEmail: contract.customerEmailSnapshot,
    customerPhone: contract.customerPhoneSnapshot,
    customerAddress: contract.customerAddressSnapshot,
    propertyAddress: contract.propertyAddressSnapshot,
    poolType: contract.poolTypeSnapshot,
    planName: contract.planNameSnapshot,
    planServices: [],
    servicePrice:
      contract.servicePriceSnapshot != null ? Number(contract.servicePriceSnapshot) : null,
    paymentDayLabel:
      contract.paymentDaySnapshot != null
        ? t("admin.invoices.servicePayment.dayOfMonth", {
            day: String(contract.paymentDaySnapshot),
          })
        : null,
    paymentTypeLabel: contract.paymentTypeSnapshot
      ? t(`admin.invoices.servicePayment.paymentTypes.${contract.paymentTypeSnapshot}`)
      : null,
    paymentMethodLabel: contract.paymentMethodSnapshot
      ? t(`admin.customers.detail.financials.paymentMethods.${contract.paymentMethodSnapshot}`)
      : null,
    serviceStartDateLabel: null,
    poolCondition,
    company,
    generatedAt: formatInBusinessTimeZone(contract.createdAt, locale, { dateStyle: "long" }),
    companySignatureImageBytes,
    clientSignatureImageBytes,
    clientSignedAtLabel: contract.clientSignedAt
      ? formatInBusinessTimeZone(contract.clientSignedAt, locale, { dateStyle: "long" })
      : null,
  });
}

export async function renderAndStoreContractPdf(
  contract: ServiceContract
): Promise<string | null> {
  try {
    const bytes = await renderContractPdfBytes(contract);
    const pdfUrl = await storePublicAsset({
      relativePath: buildContractPdfAssetPath(contract.customerId, contract.id),
      buffer: Buffer.from(bytes),
      contentType: "application/pdf",
      cacheControl: "private, max-age=0, must-revalidate",
    });
    await prisma.serviceContract.update({
      where: { id: contract.id },
      data: { pdfUrl, pdfError: null },
    });
    return pdfUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("service-contract: failed to render/store PDF", contract.id, error);
    await prisma.serviceContract
      .update({ where: { id: contract.id }, data: { pdfError: message } })
      .catch(() => undefined);
    return null;
  }
}

export async function storeSignatureDataUrl(
  customerId: string,
  contractId: string,
  who: "client" | "company",
  dataUrl: string
) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const buffer = Buffer.from(base64, "base64");
  return storePublicAsset({
    relativePath: buildContractSignatureAssetPath(customerId, contractId, who),
    buffer,
    contentType: "image/png",
    cacheControl: "private, max-age=0, must-revalidate",
  });
}
