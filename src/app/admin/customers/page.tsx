import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import CustomersClient from "@/app/admin/customers/CustomersClient";
import ActionFeedbackToast from "@/components/ui/ActionFeedbackToast";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerAddress, formatCustomerName } from "@/lib/customers/format";
import { sendCustomerInvite } from "@/lib/customers/invite";
import {
  buildCustomerListWhere,
  normalizeCustomerAccountFilter,
  normalizeCustomerPortalFilter,
} from "@/lib/customers/admin-filters";
import { hasActiveCustomerPortal } from "@/lib/customers/portal-status";
import { normalizeUsPhone } from "@/lib/phones";
import { getTranslations } from "@/i18n/server";
import type { Prisma } from "@prisma/client";
import { normalizeEmail } from "@/lib/auth/email";
import {
  resolveSafeReturnTo,
  withFeedbackParam,
} from "@/lib/ui/action-feedback";

async function createCustomer(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const returnTo = resolveSafeReturnTo(
    formData.get("returnTo"),
    "/admin/customers",
    ["/admin/customers"]
  );

  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellidos = String(formData.get("apellidos") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const telefonoRaw = String(formData.get("telefono") ?? "").trim();
  const telefonoSecundarioRaw = String(
    formData.get("telefonoSecundario") ?? ""
  ).trim();
  const idiomaPreferencia = String(formData.get("idiomaPreferencia") ?? "EN");
  const estadoCuenta = String(formData.get("estadoCuenta") ?? "ACTIVE");
  const tipoCliente = String(formData.get("tipoCliente") ?? "RESIDENTIAL");
  const allowWeekendBooking = formData.get("allowWeekendBooking") === "on";
  const direccionLinea1 = String(
    formData.get("direccionLinea1") ?? ""
  ).trim();
  const direccionLinea2 = String(
    formData.get("direccionLinea2") ?? ""
  ).trim();
  const ciudad = String(formData.get("ciudad") ?? "").trim();
  const estadoProvincia = String(
    formData.get("estadoProvincia") ?? ""
  ).trim();
  const codigoPostal = String(formData.get("codigoPostal") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();
  const enviarInvitacion = Boolean(formData.get("enviarInvitacion"));

  const telefono = telefonoRaw ? normalizeUsPhone(telefonoRaw) ?? "" : "";
  const telefonoSecundario = telefonoSecundarioRaw
    ? normalizeUsPhone(telefonoSecundarioRaw)
    : null;

  if (!nombre) {
    return;
  }
  if (telefonoRaw && !telefono) {
    return;
  }
  if (telefonoSecundarioRaw && !telefonoSecundario) {
    return;
  }

  if (email) {
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true },
    });
    if (existingUser && existingUser.role !== "CUSTOMER") {
      return;
    }
    if (existingUser) {
      const linkedCustomer = await prisma.customer.findFirst({
        where: { userId: existingUser.id },
        select: { id: true },
      });
      if (linkedCustomer) {
        return;
      }
    }
  }

  const hasAddress =
    direccionLinea1 || ciudad || estadoProvincia || codigoPostal;
  if (hasAddress && (!direccionLinea1 || !ciudad || !estadoProvincia || !codigoPostal)) {
    return;
  }

  const customer = await prisma.customer.create({
    data: {
      nombre,
      apellidos,
      email,
      telefono,
      telefonoSecundario,
      idiomaPreferencia: idiomaPreferencia === "EN" ? "EN" : "ES",
      estadoCuenta: estadoCuenta === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      tipoCliente: tipoCliente === "COMMERCIAL" ? "COMMERCIAL" : "RESIDENTIAL",
      allowWeekendBooking,
      direccionLinea1: direccionLinea1 || null,
      direccionLinea2: direccionLinea2 || null,
      ciudad: ciudad || null,
      estadoProvincia: estadoProvincia || null,
      codigoPostal: codigoPostal || null,
      notas: notas || null,
    },
  });

  if (enviarInvitacion && customer.email) {
    try {
      const result = await sendCustomerInvite(customer.id);
      if (!result.ok) {
        console.error("Invite failed:", result.error);
      }
    } catch (error) {
      console.error("Invite failed:", error);
    }
  }

  revalidatePath("/admin/customers");
  revalidatePath("/admin/invoices");
  redirect(withFeedbackParam(returnTo, "customer-created"));
}

type CustomersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const parseParam = (key: string) => {
    const value = resolvedSearchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const query = (parseParam("q") ?? "").trim();
  const rawStatus = parseParam("status") ?? "ALL";
  const rawPortal = parseParam("portal") ?? "ALL";
  const rawSort = parseParam("sort") ?? "name";
  const feedback = parseParam("feedback") ?? "";
  const status = normalizeCustomerAccountFilter(rawStatus);
  const portal = normalizeCustomerPortalFilter(rawPortal);
  const sort =
    rawSort === "jobs" || rawSort === "properties" ? rawSort : "name";
  const pageParam = parseParam("page");
  const requestedPage = Number(pageParam);
  const pageSize = 25;
  const now = new Date();

  const where: Prisma.CustomerWhereInput = buildCustomerListWhere({
    query,
    status,
    portal,
  });

  const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
    sort === "jobs"
      ? [{ jobs: { _count: "desc" } }, { nombre: "asc" }]
      : sort === "properties"
        ? [{ properties: { _count: "desc" } }, { nombre: "asc" }]
        : [{ nombre: "asc" }, { apellidos: "asc" }];

  const totalMatching = await prisma.customer.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1;
  const skip = (currentPage - 1) * pageSize;

  const [customers, totalCustomers, activeCustomers, totalProperties, totalJobs] =
    await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          email: true,
          telefono: true,
          direccionLinea1: true,
          direccionLinea2: true,
          ciudad: true,
          estadoProvincia: true,
          codigoPostal: true,
          properties: {
            select: {
              name: true,
              address: true,
            },
            orderBy: { createdAt: "asc" },
            take: 6,
          },
          user: {
            select: {
              passwordResetTokens: {
                where: { purpose: "INVITE" },
                select: {
                  expiresAt: true,
                  usedAt: true,
                },
              },
            },
          },
          estadoCuenta: true,
          _count: {
            select: {
              properties: true,
              jobs: true,
              invoices: true,
            },
          },
        },
      }),
      prisma.customer.count(),
      prisma.customer.count({ where: { estadoCuenta: "ACTIVE" } }),
      prisma.property.count(),
      prisma.job.count(),
    ]);

  return (
    <AppShell
      title={t("admin.customers.title")}
      subtitle={t("admin.customers.subtitle")}
      role="ADMIN"
    >
      {feedback === "customer-created" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.created")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "customer-deleted" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.deleted")}
          dismissLabel={t("common.actions.close")}
        />
      ) : null}
      <CustomersClient
        rows={customers.map((customer) => ({
          id: customer.id,
          name: formatCustomerName(customer),
          email: customer.email,
          phone: customer.telefono,
          address: formatCustomerAddress(customer),
          propertyNames: customer.properties
            .map((property) => property.name?.trim() || property.address?.trim() || "")
            .filter(Boolean),
          portalStatus: hasActiveCustomerPortal(customer, now) ? "ACTIVE" : "INACTIVE",
          status: customer.estadoCuenta,
          properties: customer._count.properties,
          jobs: customer._count.jobs,
          invoices: customer._count.invoices,
        }))}
        summary={{
          total: totalCustomers,
          active: activeCustomers,
          inactive: totalCustomers - activeCustomers,
          properties: totalProperties,
          jobs: totalJobs,
        }}
        pagination={{
          page: currentPage,
          pageSize,
          total: totalMatching,
          totalPages,
        }}
        filters={{
          query,
          status,
          portal,
          sort,
        }}
        createCustomer={createCustomer}
      />
    </AppShell>
  );
}
