import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getInvoiceTemplateConfig } from "@/lib/site-settings";
import { buildServiceContractPdfBytes } from "@/lib/contracts/service-contract-pdf";
import { formatCustomerAddress, formatCustomerName } from "@/lib/customers/format";
import { formatUsPhone } from "@/lib/phones";
import { formatInBusinessTimeZone } from "@/lib/timezone";
import { normalizeChecklist } from "@/lib/service-tiers";
import { readPoolCondition } from "@/lib/customers/pool-condition";
import { normalizeLocale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN" || !session.isDeveloper) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId") ?? "";
  const locale = normalizeLocale(searchParams.get("locale"));
  if (!customerId) {
    return NextResponse.json({ error: "customerId requerido" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      properties: { orderBy: { createdAt: "asc" }, take: 1 },
      contractedServiceTier: { select: { name: true, checklist: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  try {
    const [company, t] = await Promise.all([
      getInvoiceTemplateConfig(),
      getTranslations(locale),
    ]);
    const primaryProperty = customer.properties[0] ?? null;

    const planServices = normalizeChecklist(customer.contractedServiceTier?.checklist).map(
      (item) => item.label
    );

    const poolCondition = readPoolCondition(primaryProperty?.poolCondition).map((entry) => ({
      label: t(`admin.customers.detail.properties.condition.items.${entry.key}`),
      status: entry.status,
      statusLabel: entry.status
        ? t(`admin.customers.detail.properties.condition.status.${entry.status}`)
        : null,
    }));

    const pdfBytes = await buildServiceContractPdfBytes({
      locale,
      customerName: formatCustomerName(customer),
      customerEmail: customer.email || null,
      customerPhone: formatUsPhone(customer.telefono) || null,
      customerAddress: formatCustomerAddress(customer) || null,
      propertyAddress: primaryProperty?.address ?? null,
      poolType: primaryProperty?.poolType ?? null,
      planName: customer.contractedServiceTier?.name ?? null,
      planServices,
      servicePrice:
        primaryProperty?.servicePrice != null ? Number(primaryProperty.servicePrice) : null,
      paymentDayLabel:
        primaryProperty?.paymentDay != null
          ? t("admin.invoices.servicePayment.dayOfMonth", {
              day: String(primaryProperty.paymentDay),
            })
          : null,
      paymentTypeLabel: primaryProperty?.paymentType
        ? t(`admin.invoices.servicePayment.paymentTypes.${primaryProperty.paymentType}`)
        : null,
      paymentMethodLabel: customer.paymentMethod
        ? t(`admin.customers.detail.financials.paymentMethods.${customer.paymentMethod}`)
        : null,
      serviceStartDateLabel: primaryProperty?.serviceStartDate
        ? formatInBusinessTimeZone(primaryProperty.serviceStartDate, locale, { dateStyle: "long" })
        : null,
      poolCondition,
      company,
      generatedAt: formatInBusinessTimeZone(new Date(), locale, { dateStyle: "long" }),
    });

    const fileSafeName = formatCustomerName(customer)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contrato-servicio-${fileSafeName || "cliente"}.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("service-contract-pdf-error", error);
    return NextResponse.json(
      { error: "No se pudo generar el contrato" },
      { status: 500 }
    );
  }
}
