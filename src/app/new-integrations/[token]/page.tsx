import type { Metadata } from "next";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ token: string }>;
};

const ALLOWED_PUBLIC_TOKENS = new Set([
  "n7x4v2k9q1m8c5p3r6t0z4a9h2w7y5d1",
]);

function isAllowedToken(token: string) {
  return ALLOWED_PUBLIC_TOKENS.has(token);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  if (!isAllowedToken(token)) {
    return {
      title: "Not Found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: "Propuesta de Integracion Stripe | AcostasPool",
    description:
      "Documento comercial de integracion Stripe para AcostasPool: alcance, flujo, entregables y costos.",
    robots: {
      index: false,
      follow: false,
    },
  };
}

const implementationItems = [
  "Integracion completa de Stripe en la aplicacion (configuracion segura y entorno de produccion).",
  "Apartado nuevo de Billing para cliente: metodo de pago, estado de membresia, historial de cobros y facturas.",
  "Apartado nuevo de Accounting para administracion: suscripciones, transacciones, facturas, estados y control operativo.",
  "Cobro automatico recurrente de membresia mensual a clientes finales (segun plan que ustedes definan).",
  "Registro automatico de cada pago confirmado el mismo dia en el sistema.",
  "Generacion y envio automatico de invoice al cliente final usando el mismo template actual de factura de AcostasPool.",
  "Historial completo de transacciones e invoices para consulta y auditoria.",
  "Manejo de intentos fallidos de cobro con estados claros (ejemplo: past_due) y acciones de recuperacion.",
  "Notificaciones internas y al cliente para eventos importantes de facturacion.",
  "Panel listo para crecer con reportes financieros y conciliacion.",
];

const accountingSections = [
  {
    title: "Billing (portal del cliente)",
    points: [
      "Plan de membresia activo y monto.",
      "Proxima fecha de cobro.",
      "Metodo de pago guardado.",
      "Historial de transacciones.",
      "Historial de invoices en PDF.",
      "Estado de cuenta (activo, pendiente, etc.).",
    ],
  },
  {
    title: "Accounting (panel administrativo)",
    points: [
      "Resumen de suscripciones activas y pendientes.",
      "Vista de cobros exitosos y fallidos.",
      "Listado de invoices emitidos y pagados.",
      "Seguimiento de cuentas con pagos pendientes.",
      "Trazabilidad completa por cliente.",
      "Base para reportes y exportaciones contables.",
    ],
  },
];

const deliveryItems = [
  "Configuracion tecnica de Stripe para la operacion.",
  "Flujo completo de alta, cobro y renovacion de membresia.",
  "Registro automatico de pagos y facturas dentro de la aplicacion.",
  "Envio automatico de invoice con el template actual de AcostasPool.",
  "Seccion Billing para cliente + seccion Accounting para admin.",
  "Pruebas de flujo end-to-end antes de entrega final.",
];

export default async function StripeIntegrationProposalPage({ params }: PageProps) {
  const { token } = await params;
  if (!isAllowedToken(token)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#f8fafc_34%,#f8fafc_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-sky-200/70 bg-white shadow-[0_20px_60px_-30px_rgba(14,116,144,0.45)]">
          <div className="bg-[linear-gradient(120deg,#0c4a6e,#0e7490)] px-6 py-8 text-white sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">
              AcostasPool · Documento Comercial
            </p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
              Nueva Integracion Stripe para la Aplicacion
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-50 sm:text-base">
              Esta propuesta explica en lenguaje claro lo que se implementa, como funciona
              el flujo de cobro y exactamente que obtiene tu empresa con esta integracion.
            </p>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:px-8 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Inversion de Implementacion
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">$750 USD</p>
              <p className="mt-1 text-sm text-slate-600">
                Pago unico (one-time payment) + impuestos aplicables.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Este pago es por la integracion completa. No es una suscripcion mensual de
                desarrollo.
              </p>
            </article>

            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Costos Stripe
              </p>
              <p className="mt-2 text-lg font-semibold text-emerald-900">
                2.9% + $0.30 / transaccion
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-900/90">
                Sin costo mensual fijo de Stripe por esta configuracion.
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Que incluye esta integracion
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700 sm:text-base">
            {implementationItems.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Como funciona el flujo de cobro
          </h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700 sm:text-base">
            <li>1. El cliente final registra/autoriza su metodo de pago en Billing.</li>
            <li>2. Stripe procesa el cobro y confirma el resultado.</li>
            <li>3. El pago se registra en la aplicacion el mismo dia automaticamente.</li>
            <li>4. Se genera y envia invoice con el template actual de AcostasPool.</li>
            <li>5. Todo queda guardado en historial de transacciones e invoices.</li>
            <li>6. En renovaciones mensuales, Stripe cobra automaticamente segun el plan.</li>
          </ol>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {accountingSections.map((section) => (
            <article
              key={section.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700 sm:text-base">
                {section.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Costos y condiciones claras
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                Integracion
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                $750 USD pago unico + impuestos aplicables.
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                Procesamiento Stripe
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                2.9% + $0.30 por transaccion de tarjeta. Este costo lo descuenta Stripe de
                cada cobro recibido.
              </p>
            </article>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            Nota: no se contempla un cargo mensual fijo de Stripe por esta integracion.
            Los costos recurrentes de Stripe vienen por transaccion procesada.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Entregables finales
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700 sm:text-base">
            {deliveryItems.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 sm:p-6">
          <p className="font-semibold uppercase tracking-[0.14em]">Enlace privado por token</p>
          <p className="mt-2">
            Este documento vive en una ruta publica con token dificil de adivinar y permanece
            disponible hasta que ustedes decidan eliminarlo.
          </p>
          <p className="mt-2 font-semibold">
            Solo abre con el token exacto compartido por AcostasPool.
          </p>
        </section>
      </div>
    </main>
  );
}

