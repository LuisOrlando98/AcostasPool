import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import CustomersClient from "@/app/admin/customers/CustomersClient";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { sendCustomerInvite } from "@/lib/customers/invite";
import { normalizeUsPhone } from "@/lib/phones";
import { getTranslations } from "@/i18n/server";
import type { Prisma } from "@prisma/client";

async function createCustomer(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellidos = String(formData.get("apellidos") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefonoRaw = String(formData.get("telefono") ?? "").trim();
  const telefonoSecundarioRaw = String(
    formData.get("telefonoSecundario") ?? ""
  ).trim();
  const idiomaPreferencia = String(formData.get("idiomaPreferencia") ?? "EN");
  const estadoCuenta = String(formData.get("estadoCuenta") ?? "ACTIVE");
  const tipoCliente = String(formData.get("tipoCliente") ?? "RESIDENTIAL");
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

  const telefono = normalizeUsPhone(telefonoRaw);
  const telefonoSecundario = telefonoSecundarioRaw
    ? normalizeUsPhone(telefonoSecundarioRaw)
    : null;

  if (!nombre || !apellidos || !email || !telefono) {
    return;
  }
  if (telefonoSecundarioRaw && !telefonoSecundario) {
    return;
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
      direccionLinea1: direccionLinea1 || null,
      direccionLinea2: direccionLinea2 || null,
      ciudad: ciudad || null,
      estadoProvincia: estadoProvincia || null,
      codigoPostal: codigoPostal || null,
      notas: notas || null,
    },
  });

  if (enviarInvitacion) {
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
}

type CustomersPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
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
  const rawSort = parseParam("sort") ?? "name";
  const status =
    rawStatus === "ACTIVE" || rawStatus === "INACTIVE" ? rawStatus : "ALL";
  const sort =
    rawSort === "jobs" || rawSort === "properties" ? rawSort : "name";
  const pageParam = parseParam("page");
  const requestedPage = Number(pageParam);
  const pageSize = 25;

  const where: Prisma.CustomerWhereInput = {
    ...(status === "ACTIVE" || status === "INACTIVE"
      ? { estadoCuenta: status }
      : {}),
    ...(query
      ? {
          OR: [
            { nombre: { contains: query, mode: "insensitive" } },
            { apellidos: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

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
      wide
    >
      <CustomersClient
        rows={customers.map((customer) => ({
          id: customer.id,
          name: formatCustomerName(customer),
          email: customer.email,
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
          sort,
        }}
        createCustomer={createCustomer}
      />
    </AppShell>
  );
}
