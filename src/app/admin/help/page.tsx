import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import { requireRole } from "@/lib/auth/guards";
import { getRequestLocale, getTranslations } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Centro de ayuda admin | AcostasPool",
  description:
    "Guia completa para administradores: rutas, tecnicos, clientes, facturas, reportes, notificaciones y ajustes.",
};

type HelpSection = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  tips: string[];
  warnings?: string[];
};

const HELP_SECTIONS: HelpSection[] = [
  {
    id: "inicio-rapido",
    title: "Inicio rapido (primer dia)",
    summary:
      "Configura lo esencial para operar sin friccion y evitar errores de datos desde el principio.",
    steps: [
      "Valida que la zona horaria de trabajo sea Eastern Time (America/New_York).",
      "Revisa Ajustes: datos de empresa, telefono, email, branding y textos de factura.",
      "Crea o revisa paquetes/tipos de servicio con checklist estandar.",
      "Carga tecnicos activos y confirma telefono/email correcto de cada uno.",
      "Da de alta clientes y sus propiedades antes de programar trabajos.",
      "Revisa que cada propiedad tenga direccion completa y datos de piscina.",
      "Haz una programacion de prueba para confirmar flujo de calendario.",
      "Verifica que notificaciones y reportes muestren la data esperada.",
    ],
    tips: [
      "No programes trabajos sin propiedad y sin tecnico definido, salvo pendientes intencionales.",
      "Usa nombres de propiedad claros para encontrar rapido en busqueda.",
      "Mantener datos limpios mejora reportes y facturacion automaticamente.",
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard administrativo",
    summary:
      "Es tu lectura operativa rapida: volumen del dia, estado del equipo y senales de riesgo.",
    steps: [
      "Revisa total de trabajos del dia y cuantas visitas estan pendientes.",
      "Confirma finalizacion y evidencia para medir calidad real de ejecucion.",
      "Detecta backlog temprano para reasignar antes de que se acumule.",
      "Usa accesos rapidos del dashboard para saltar a rutas, clientes o facturas.",
      "Si ves picos de on-demand, ajusta capacidad del dia siguiente.",
    ],
    tips: [
      "Toma decisiones desde tendencias, no solo desde una cifra aislada.",
      "Cruza dashboard + reportes para ver causa raiz de retrasos.",
      "Usa el dashboard como rutina de apertura y cierre diario.",
    ],
  },
  {
    id: "rutas-calendario",
    title: "Rutas y calendario",
    summary:
      "Aqui controlas agenda, carga diaria y calidad del plan de trabajo por fecha.",
    steps: [
      "Navega por mes para visualizar volumen y distribucion de carga.",
      "Activa modo editar para mover trabajos entre dias cuando haga falta.",
      "En desktop, arrastra trabajos para reubicar rapidamente en el calendario.",
      "En movil, abre el modal del dia y usa editar desde adentro para mover/eliminar.",
      "Abre el trabajo con click para editar detalles, no desde boton externo.",
      "Si un trabajo no aplica, eliminacion se hace dentro del modal del trabajo.",
      "Guarda cambios en bloque cuando termines una ronda de ajustes.",
      "Valida que estado, prioridad y tecnico queden coherentes despues de mover.",
    ],
    tips: [
      "Evita sobrecargar dias con demasiados urgentes en la misma ruta.",
      "Mover trabajo de dia debe conservar hora local ET correctamente.",
      "No cierres sin guardar cuando hay cambios pendientes en modo edicion.",
    ],
    warnings: [
      "Cambiar fecha sin revisar tecnico puede crear huecos en una ruta y saturacion en otra.",
      "Si mueves trabajos completados, documenta el motivo para trazabilidad interna.",
    ],
  },
  {
    id: "programacion-filtros",
    title: "Programacion de trabajos y filtros",
    summary:
      "Usa filtros para operar con precision y tablas compactas sin perder contexto.",
    steps: [
      "Define rango (semana/mes/custom) segun objetivo operativo del momento.",
      "Filtra por estado, prioridad, tecnico y texto para encontrar casos rapido.",
      "Mantente en vista compacta para reducir filas y mejorar densidad visual.",
      "Abre una fila para ver/editar trabajo; evita botones redundantes en tabla.",
      "Quita acciones externas si el flujo principal vive dentro del modal.",
      "Aplica y resetea filtros con disciplina para evitar lecturas confusas.",
      "En movil, prioriza 1 linea por dato clave y usa chips para estados.",
    ],
    tips: [
      "Filtrar primero y luego editar evita errores por contexto mezclado.",
      "Usa prioridad + tecnico para revisar balance de carga del equipo.",
      "Cuando termines, vuelve a filtros base para no dejar vista sesgada.",
    ],
  },
  {
    id: "tecnicos",
    title: "Gestion de tecnicos",
    summary:
      "Controla disponibilidad, productividad y seguimiento operativo por tecnico.",
    steps: [
      "Crea tecnico con datos completos y estado activo/inactivo correcto.",
      "Usa busqueda por nombre, email o telefono para soporte rapido.",
      "Haz click en la fila del tecnico para abrir su perfil detallado.",
      "Revisa pendientes, completados y ultima actividad por persona.",
      "Valida asignaciones para que no haya trabajos sin responsable.",
      "Usa filtros de tabla para enfocar activos, inactivos o con atraso.",
    ],
    tips: [
      "Mantener telefonos correctos acelera resolucion en campo.",
      "Tecnicos sin actividad reciente deben revisarse al cierre del dia.",
      "Si desactivas un tecnico, reubica sus trabajos pendientes primero.",
    ],
  },
  {
    id: "clientes-propiedades",
    title: "Clientes y propiedades",
    summary:
      "La calidad de estos datos impacta rutas, facturas, reportes y comunicacion.",
    steps: [
      "Crea cliente con contacto principal y canales de comunicacion validos.",
      "Registra propiedades con direccion completa y nombre identificable.",
      "Completa datos tecnicos: volumen, sistema, filtro, acceso y notas de ubicacion.",
      "Revisa historial de trabajos e invoices desde la vista del cliente.",
      "Manten consistencia de nombres para busqueda y reportes limpios.",
      "Cuando haya cambios de acceso, actualiza la propiedad el mismo dia.",
    ],
    tips: [
      "Una propiedad bien documentada reduce errores de visita.",
      "Notas de acceso claras ahorran tiempo y evitan reprogramaciones.",
      "Evita duplicados: busca antes de crear cliente o propiedad.",
    ],
  },
  {
    id: "repositorio",
    title: "Repositorio del cliente",
    summary:
      "Centraliza archivos, evidencia y documentos para trazabilidad completa.",
    steps: [
      "Usa el repositorio para guardar evidencia relevante y archivos de soporte.",
      "Nombra archivos con formato consistente (fecha + tipo + cliente).",
      "Agrupa por tipo de documento para ubicacion rapida.",
      "Revisa ultima modificacion para detectar actividad reciente.",
      "Comparte internamente el path exacto cuando pidas revision.",
    ],
    tips: [
      "Evita nombres genericos como foto1 o doc-final-final.",
      "Sube solo archivos utiles para operacion y auditoria.",
      "Si un archivo queda obsoleto, marca o reemplaza para no confundir.",
    ],
  },
  {
    id: "facturas",
    title: "Facturas (mas control operativo)",
    summary:
      "Asegura ciclo completo: borrador, envio, seguimiento y conciliacion.",
    steps: [
      "Genera facturas desde trabajos correctos y valida cliente/propiedad.",
      "Usa estado (borrador/enviada/pagada/atrasada) como semaforo financiero.",
      "Controla tema, fecha y trabajo asociado para evitar inconsistencias.",
      "Abre factura con click en fila para ver detalle completo.",
      "Usa filtros por estado, cliente y rango para cobranza semanal.",
      "Revisa templates en ajustes para mantener formato profesional.",
      "Confirma que titulos de correo y contenido esten en el mismo idioma.",
    ],
    tips: [
      "No envies factura sin validar monto, servicio y fecha en ET.",
      "Si editas una enviada, deja nota interna de la correccion.",
      "Consolida cobros con reportes para decisiones de caja.",
    ],
  },
  {
    id: "reportes",
    title: "Reportes y analitica",
    summary:
      "Convierte datos diarios en decisiones de capacidad, calidad y rentabilidad.",
    steps: [
      "Define rango de fechas antes de comparar rendimiento.",
      "Filtra por tecnico, tipo de servicio y prioridad para lectura accionable.",
      "Revisa total trabajos, tasa de finalizacion y on-demand.",
      "Observa tiempo promedio de completado para detectar cuellos de botella.",
      "Usa reportes semanales para planificar la carga de la semana siguiente.",
      "Contrasta reportes con calendario para entender desbalances.",
    ],
    tips: [
      "Mide tendencia, no solo fotografia de un dia.",
      "Si la finalizacion baja, revisa primero calidad de agenda y asignacion.",
      "Un buen reporte necesita datos consistentes en origen.",
    ],
  },
  {
    id: "notificaciones",
    title: "Centro de notificaciones",
    summary:
      "Te ayuda a no perder eventos criticos: solicitudes, cambios de ruta y fallos.",
    steps: [
      "Usa filtros por leidas/no leidas, severidad y entrega.",
      "Ajusta rango por hoy, 7 dias, 30 dias o personalizado.",
      "Marca como leido para mantener foco en pendientes reales.",
      "Limpia ruido periodicamente, pero sin borrar evidencia importante.",
      "Abre la entidad vinculada (trabajo, cliente o factura) desde la notificacion.",
    ],
    tips: [
      "Configura preferencias por rol para reducir alert fatigue.",
      "Prioriza CRITICAL y FAILED al inicio del turno.",
      "Mantener inbox limpio acelera toma de decisiones.",
    ],
  },
  {
    id: "ajustes",
    title: "Ajustes globales",
    summary:
      "Desde aqui defines reglas y presentacion general de la plataforma.",
    steps: [
      "Configura identidad visual, datos de empresa y textos institucionales.",
      "Revisa template de factura: encabezado, pie y notas legales.",
      "Manten coherencia de idioma en comunicacion al cliente.",
      "Ajusta opciones operativas solo con criterio y pruebas rapidas.",
      "Documenta internamente cambios importantes de configuracion.",
    ],
    tips: [
      "No hagas varios cambios criticos al mismo tiempo.",
      "Cambios de texto deben validarse en vista final antes de usar en produccion.",
      "Ajustes claros reducen errores repetitivos del equipo.",
    ],
  },
  {
    id: "cuenta-seguridad",
    title: "Cuenta, seguridad y control de acceso",
    summary:
      "Protege la operacion y evita accesos no autorizados a secciones sensibles.",
    steps: [
      "Mantener cuentas activas solo para usuarios vigentes del equipo.",
      "Desactivar usuarios que ya no operan para evitar riesgo.",
      "Revisar permisos por rol (admin, tecnico, cliente).",
      "Usar logs de cambios para trazabilidad en ajustes delicados.",
      "Mantener el acceso a Agreement Service para usuarios ADMIN y revisar permisos periodicamente.",
    ],
    tips: [
      "No compartas cuentas entre personas.",
      "Cada accion debe poder trazarse a un usuario real.",
      "Revisa accesos al menos una vez por mes.",
    ],
  },
  {
    id: "movil",
    title: "Operacion en movil (buenas practicas)",
    summary:
      "Optimiza espacio visual y evita friccion en pantallas pequenas.",
    steps: [
      "Prioriza chips, etiquetas cortas y botones en una sola linea.",
      "Abre detalles por click en fila y evita botones duplicados.",
      "En tablas largas, compacta columnas y elimina espacios muertos.",
      "Ubica acciones destructivas dentro del modal de detalle, no afuera.",
      "Valida que filtros importantes queden accesibles en modal.",
      "Prueba en tamanos pequenos y grandes antes de cerrar cambios UI.",
    ],
    tips: [
      "En movil, menos controles visibles = mas claridad operativa.",
      "Mantener consistencia desktop/movil reduce errores de uso.",
      "Usa texto corto, accion clara y feedback inmediato.",
    ],
  },
  {
    id: "rutinas",
    title: "Rutinas recomendadas (diaria, semanal y mensual)",
    summary:
      "Un proceso estable evita atrasos y mantiene calidad continua.",
    steps: [
      "Rutina diaria apertura: dashboard, pendientes, urgentes y reasignaciones.",
      "Rutina diaria cierre: completados, evidencia faltante y facturas pendientes.",
      "Rutina semanal: balance de carga por tecnico y clientes con atrasos.",
      "Rutina semanal: limpieza de notificaciones y validacion de datos incompletos.",
      "Rutina mensual: revisar KPIs, tiempos promedio y calidad de cobro.",
      "Rutina mensual: depurar catlogos y estandarizar procesos detectados.",
    ],
    tips: [
      "Las rutinas cortas y constantes ganan a revisiones largas esporadicas.",
      "Si aparece un patron de error, crea checklist operativo interno.",
      "Estandarizar reduce dependencia de memoria individual.",
    ],
  },
  {
    id: "faq",
    title: "FAQ y resolucion de problemas",
    summary:
      "Guia rapida para los casos mas comunes en operacion administrativa.",
    steps: [
      "No veo un trabajo: verifica rango, filtros activos y tecnico asignado.",
      "No puedo editar: confirma si estas en modo editar o modo vista.",
      "No puedo eliminar: abre el detalle del trabajo y elimina desde el modal.",
      "Fechas no cuadran: valida que filtro y datos esten en Eastern Time.",
      "Factura no aparece: revisa estado, rango de fecha y cliente asociado.",
      "Notificacion no llega: valida preferencias y estado de entrega.",
      "Vista movil rota: revisa breakpoints y densidad de columnas/acciones.",
    ],
    tips: [
      "Antes de escalar, reproduce el problema con filtros limpios.",
      "Captura pantalla + ruta exacta + hora ET para diagnostico rapido.",
      "Si el problema impacta cobro o agenda, prioriza solucion inmediata.",
    ],
    warnings: [
      "No borres datos para 'probar'; usa registros de prueba controlados.",
      "Evita cambios en caliente sin validar impacto en movil y desktop.",
    ],
  },
];

export default async function AdminHelpPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const isSpanish = locale.startsWith("es");

  return (
    <AppShell
      role="ADMIN"
      title={t("admin.help.title")}
      subtitle={t("admin.help.subtitle")}
      wide
    >
      <section className="app-card p-5 shadow-contrast sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {isSpanish ? "Centro de ayuda" : "Help center"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {isSpanish
                ? "Guia completa para administradores"
                : "Complete administrator guide"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              {isSpanish
                ? "Aqui tienes una referencia operativa de punta a punta para ejecutar la plataforma con orden, velocidad y control. Incluye procesos diarios, filtros, vistas moviles y solucion de problemas."
                : "End-to-end operational reference to run the platform with structure, speed, and control. Includes daily workflows, filters, mobile behavior, and troubleshooting."}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700">
            <p className="font-semibold">
              {isSpanish ? "Hora oficial del sistema" : "Official system time"}
            </p>
            <p className="mt-1">Eastern Time (America/New_York)</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <p className="font-semibold">
            {isSpanish ? "Nota de acceso" : "Access note"}
          </p>
          <p className="mt-1">
            {isSpanish
              ? "El apartado de acuerdo de servicio esta disponible para administradores."
              : "The service agreement section is available to administrators."}
          </p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {isSpanish ? "Navegacion rapida" : "Quick navigation"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {HELP_SECTIONS.map((section, index) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                {index + 1}. {section.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {HELP_SECTIONS.map((section, index) => (
          <article
            key={section.id}
            id={section.id}
            className="app-card scroll-mt-24 p-5 shadow-contrast sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {isSpanish ? "Seccion" : "Section"} {index + 1}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              {section.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{section.summary}</p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {isSpanish ? "Como hacerlo" : "How to do it"}
                </p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    {isSpanish ? "Buenas practicas" : "Best practices"}
                  </p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-emerald-900">
                    {section.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>

                {section.warnings?.length ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
                      {isSpanish ? "Evitar errores" : "Avoid errors"}
                    </p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-rose-900">
                      {section.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
