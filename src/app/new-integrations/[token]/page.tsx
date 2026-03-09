import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicProposalResponseForm from "@/components/new-integrations/PublicProposalResponseForm";
import { isAllowedPublicIntegrationToken } from "@/lib/public-integrations";

type PageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  if (!isAllowedPublicIntegrationToken(token)) {
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
  "Integracion completa de Stripe en la aplicacion, lista para operar en produccion.",
  "Seccion Billing para cliente: metodo de pago, estado de membresia, historial de cobros e invoices.",
  "Seccion Accounting para administracion: suscripciones, transacciones, facturas y control operativo.",
  "Cobro automatico de membresias mensuales a clientes finales segun el plan definido por AcostasPool.",
  "Registro automatico de pagos confirmados el mismo dia dentro del sistema.",
  "Generacion y envio de invoice usando el mismo template actual de factura de AcostasPool.",
  "Historial completo para consulta, auditoria y seguimiento por cliente.",
  "Manejo de cobros fallidos con reintentos y estados claros (ejemplo: past_due).",
  "Base preparada para reportes financieros y conciliacion futura.",
];

const accountingSections = [
  {
    title: "Billing (portal del cliente)",
    points: [
      "Plan de membresia activo y monto mensual.",
      "Proxima fecha de cobro automatica.",
      "Metodo de pago guardado y actualizable.",
      "Historial de transacciones por fecha.",
      "Historial de invoices en PDF.",
      "Estado de cuenta (activo, pendiente, vencido).",
    ],
  },
  {
    title: "Accounting (panel administrativo)",
    points: [
      "Resumen de suscripciones activas, pendientes y canceladas.",
      "Vista de cobros exitosos, fallidos y en recuperacion.",
      "Listado de invoices emitidos, enviados y pagados.",
      "Seguimiento de cuentas con pagos pendientes.",
      "Trazabilidad completa por cliente.",
      "Base lista para reportes y exportaciones contables.",
    ],
  },
];

const flowExamples = [
  {
    title: "Ejemplo 1: alta y primer cobro",
    description: "Un cliente se registra hoy para su membresia mensual.",
    steps: [
      "El cliente autoriza su tarjeta en Billing.",
      "Stripe procesa el primer cobro y confirma el pago.",
      "La membresia queda activa ese mismo dia.",
      "Se registra la transaccion y se envia invoice automatico con el template actual.",
    ],
  },
  {
    title: "Ejemplo 2: renovacion mensual automatica",
    description: "Llega la fecha de renovacion del plan sin intervencion manual.",
    steps: [
      "Stripe ejecuta el cobro en la fecha configurada.",
      "Si el pago entra, el estado sigue activo automaticamente.",
      "El sistema guarda la transaccion en historial.",
      "El cliente recibe su invoice del nuevo periodo.",
    ],
  },
  {
    title: "Ejemplo 3: pago fallido y recuperacion",
    description: "La tarjeta falla por fondos o vencimiento.",
    steps: [
      "Stripe marca el cobro como fallido y notifica el evento.",
      "La cuenta pasa a estado pendiente/past_due.",
      "Se ejecutan reintentos segun la configuracion definida.",
      "Cuando el cliente actualiza tarjeta y paga, todo queda regularizado y registrado.",
    ],
  },
];

const valuePoints = [
  "Un solo ecosistema para cobrar, facturar y auditar.",
  "Menos trabajo manual del equipo administrativo.",
  "Mayor claridad para cliente final y para operacion interna.",
];

const deliveryItems = [
  "Configuracion de Stripe para operacion real (produccion).",
  "Apertura y puesta en marcha de la cuenta Stripe incluida dentro del proyecto.",
  "Flujo completo de alta, cobro y renovacion de membresia.",
  "Registro automatico de pagos y facturas dentro de la aplicacion.",
  "Envio automatico de invoice con el template actual de AcostasPool.",
  "Seccion Billing para cliente y seccion Accounting para administracion.",
  "Pruebas de flujo end-to-end antes de entrega final.",
];

export default async function StripeIntegrationProposalPage({ params }: PageProps) {
  const { token } = await params;
  if (!isAllowedPublicIntegrationToken(token)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#f8fafc_34%,#f8fafc_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-sky-200/70 bg-white shadow-[0_20px_60px_-30px_rgba(14,116,144,0.45)]">
          <div className="bg-[linear-gradient(120deg,#0c4a6e,#0e7490)] px-6 py-8 text-white sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">
              AcostasPool - Documento Comercial
            </p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
              Nueva Integracion Stripe para la Aplicacion
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-50 sm:text-base">
              Esta propuesta explica, en lenguaje claro, que incluye la integracion, como
              funciona el flujo de cobro y que obtiene tu empresa desde el primer dia.
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
                Este pago incluye la integracion completa y tambien la apertura/configuracion
                inicial de cuenta Stripe. No es una suscripcion mensual de desarrollo.
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
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Resumen ejecutivo</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-base">
            El objetivo es centralizar cobros recurrentes, facturacion y control contable en
            un flujo automatico y trazable. Stripe procesa el pago, la aplicacion guarda el
            movimiento y el cliente recibe su invoice el mismo dia.
          </p>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-3 sm:text-base">
            {valuePoints.map((point) => (
              <li key={point} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {point}
              </li>
            ))}
          </ul>
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
            Ejemplos de flujo (casos reales)
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {flowExamples.map((example) => (
              <article key={example.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">{example.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{example.description}</p>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {example.steps.map((step, index) => (
                    <li key={step}>
                      {index + 1}. {step}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
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
                $750 USD pago unico + impuestos aplicables. Este monto incluye apertura y
                configuracion inicial de cuenta Stripe.
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
            Nota: no se contempla un cargo mensual fijo de Stripe por esta configuracion.
            El costo operativo de Stripe se descuenta por transaccion procesada.
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

        <PublicProposalResponseForm token={token} />
      </div>
    </main>
  );
}
