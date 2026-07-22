import AppShell from "@/components/layout/AppShell";
import { requireDeveloper } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import { getTranslations } from "@/i18n/server";

export default async function ServiceContractPage() {
  await requireDeveloper();
  const t = await getTranslations();

  const customers = await prisma.customer.findMany({
    orderBy: [{ nombre: "asc" }, { apellidos: "asc" }],
    select: { id: true, nombre: true, apellidos: true, email: true },
  });

  return (
    <AppShell
      role="ADMIN"
      title={t("admin.developer.serviceContract.title")}
      subtitle={t("admin.developer.serviceContract.subtitle")}
    >
      <div className="app-card max-w-2xl p-6 shadow-contrast">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {t("admin.developer.serviceContract.draftNotice")}
        </div>

        <form
          method="GET"
          action="/api/admin/developer/service-contract/pdf"
          target="_blank"
          className="mt-5 space-y-4"
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("admin.developer.serviceContract.selectCustomer")}
            </label>
            <select
              name="customerId"
              required
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="">{t("admin.customers.detail.properties.options.select")}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {formatCustomerName(customer)}
                  {customer.email ? ` (${customer.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="app-button-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em]"
          >
            {t("admin.developer.serviceContract.generate")}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
