import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getInvoiceTemplateConfig } from "@/lib/site-settings";
import { buildServiceContractPdfBytes } from "@/lib/contracts/service-contract-pdf";
import { formatCustomerAddress, formatCustomerName } from "@/lib/customers/format";
import { formatUsPhone } from "@/lib/phones";
import { formatInBusinessTimeZone } from "@/lib/timezone";

const PAYMENT_METHOD_LABELS_ES: Record<string, string> = {
  CASH: "Efectivo",
  ZELLE: "Zelle",
  CARD: "Tarjeta",
  CHECK: "Cheque",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

const PAYMENT_TYPE_LABELS_ES: Record<string, string> = {
  TO_WORK: "Mes por trabajar",
  WORKED: "Mes trabajado",
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN" || !session.isDeveloper) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId") ?? "";
  if (!customerId) {
    return NextResponse.json({ error: "customerId requerido" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      properties: { orderBy: { createdAt: "asc" }, take: 1 },
      contractedServiceTier: { select: { name: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  try {
    const company = await getInvoiceTemplateConfig();
    const primaryProperty = customer.properties[0] ?? null;

    const pdfBytes = await buildServiceContractPdfBytes({
      customerName: formatCustomerName(customer),
      customerEmail: customer.email || null,
      customerPhone: formatUsPhone(customer.telefono) || null,
      customerAddress: formatCustomerAddress(customer) || null,
      propertyAddress: primaryProperty?.address ?? null,
      poolType: primaryProperty?.poolType ?? null,
      planName: customer.contractedServiceTier?.name ?? null,
      servicePrice:
        primaryProperty?.servicePrice != null ? Number(primaryProperty.servicePrice) : null,
      paymentDayLabel:
        primaryProperty?.paymentDay != null ? `Dia ${primaryProperty.paymentDay} de cada mes` : null,
      paymentTypeLabel: primaryProperty?.paymentType
        ? PAYMENT_TYPE_LABELS_ES[primaryProperty.paymentType] ?? primaryProperty.paymentType
        : null,
      paymentMethodLabel: customer.paymentMethod
        ? PAYMENT_METHOD_LABELS_ES[customer.paymentMethod] ?? customer.paymentMethod
        : null,
      serviceStartDateLabel: primaryProperty?.serviceStartDate
        ? formatInBusinessTimeZone(primaryProperty.serviceStartDate, "es", { dateStyle: "long" })
        : null,
      company,
      generatedAt: formatInBusinessTimeZone(new Date(), "es", { dateStyle: "long" }),
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
