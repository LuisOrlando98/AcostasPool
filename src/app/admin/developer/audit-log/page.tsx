import AppShell from "@/components/layout/AppShell";
import { requireDeveloper } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export default async function DeveloperAuditLogPage() {
  await requireDeveloper();

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
          role: true,
        },
      },
    },
  });

  return (
    <AppShell
      role="ADMIN"
      title="Audit Log"
      subtitle="Registro de eventos criticos con actor, entidad y metadata."
      wide
    >
      <section className="app-card overflow-hidden shadow-contrast">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-600">
            Ultimos {logs.length} eventos
          </p>
        </div>
        {logs.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            No hay eventos de auditoria registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Accion</th>
                  <th className="px-4 py-3 font-semibold">Entidad</th>
                  <th className="px-4 py-3 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((entry) => {
                  const metadataText = entry.metadata
                    ? JSON.stringify(entry.metadata, null, 2)
                    : "";
                  return (
                    <tr key={entry.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {entry.createdAt.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p className="font-semibold text-slate-800">
                          {entry.user.fullName}
                        </p>
                        <p className="text-xs text-slate-500">{entry.user.email}</p>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                          {entry.user.role}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                        {entry.action}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {entry.entity}
                        {entry.entityId ? (
                          <p className="mt-1 text-xs text-slate-500">
                            ID: {entry.entityId}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {metadataText ? (
                          <details>
                            <summary className="cursor-pointer text-sky-700">
                              Ver metadata
                            </summary>
                            <pre className="mt-2 max-w-[52rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">
                              {metadataText}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
