import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-6 py-20 text-center">
      <div className="app-card p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
          Offline
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          No hay conexion a internet
        </h1>
        <p className="mt-4 text-sm text-slate-600">
          Cuando vuelva la conexion, recarga para seguir usando la app.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/login"
            className="app-button-secondary inline-flex h-11 items-center px-5 text-sm font-semibold"
          >
            Ir a login
          </Link>
        </div>
      </div>
    </main>
  );
}
