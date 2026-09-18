import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName, formatJobTitle } from "@/lib/customers/format";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import {
  buildMonthGrid,
  formatMonthKey,
  getCurrentMonth,
  getMonthGridRange,
  parseMonthKey,
  planOccurrenceKey,
  projectPlanOccurrences,
  resolveSelectedDay,
  shiftMonth,
  toBusinessDateKey,
  type CalendarCell,
} from "@/lib/jobs/tech-calendar";

/**
 * Calendario mensual del técnico: sus trabajos ya creados más las visitas de
 * sus planes recurrentes que el worker aún no ha generado (misma proyección
 * que el calendario de administración). Solo lectura: la planificación la
 * hace el administrador.
 *
 * Estado en la URL (`?month=yyyy-MM&day=yyyy-MM-dd`) para que cada día sea un
 * enlace: funciona sin JavaScript, se puede compartir y el botón atrás vuelve
 * al día anterior.
 */

const CALENDAR_PATH = "/tech/calendar";
/** Un lunes cualquiera al mediodía UTC: base para etiquetar los días de la semana. */
const SAMPLE_MONDAY_UTC = Date.UTC(2026, 0, 5, 12);
const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Día 15 al mediodía: fecha segura para formatear "mes y año" en cualquier zona. */
const MID_MONTH_DAY = 15;
const NOON_HOUR = 12;

const STATUS_LABEL_KEYS: Record<string, string> = {
  SCHEDULED: "jobs.status.scheduled",
  PENDING: "jobs.status.pending",
  ON_THE_WAY: "jobs.status.onTheWay",
  IN_PROGRESS: "jobs.status.inProgress",
  COMPLETED: "jobs.status.completed",
};

const STATUS_TONES: Record<string, string> = {
  COMPLETED: "success",
  IN_PROGRESS: "warning",
  ON_THE_WAY: "warning",
};

const SERVICE_LABEL_KEYS: Record<string, string> = {
  WEEKLY_CLEANING: "jobs.service.weeklyCleaning",
  FILTER_CHECK: "jobs.service.filterCheck",
  CHEM_BALANCE: "jobs.service.chemBalance",
  EQUIPMENT_CHECK: "jobs.service.equipmentCheck",
};

type SearchParams = Record<string, string | string[] | undefined>;

type CalendarEntry = {
  readonly id: string;
  /** Enlace al detalle; `null` para visitas de plan todavía sin trabajo. */
  readonly href: string | null;
  readonly dateKey: string;
  readonly scheduledDate: Date;
  readonly customerName: string;
  readonly address: string;
  readonly serviceType: string;
  /** Estado del trabajo; `null` cuando es una visita planificada. */
  readonly status: string | null;
  readonly priority: string;
  readonly sortOrder: number | null;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function monthHref(monthKey: string, dayKey?: string): string {
  const params = new URLSearchParams({ month: monthKey });
  if (dayKey) {
    params.set("day", dayKey);
  }
  return `${CALENDAR_PATH}?${params.toString()}`;
}

/** Solo la primera letra en mayúscula: "septiembre de 2026" → "Septiembre de 2026". */
function capitalizeFirst(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

/** Fecha UTC al mediodía de una clave `yyyy-MM-dd`, para formatearla sin desfase. */
function dateKeyToUtcNoon(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, NOON_HOUR));
}

function compareEntries(left: CalendarEntry, right: CalendarEntry): number {
  const byTime = left.scheduledDate.getTime() - right.scheduledDate.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  return (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER);
}

function groupByDay(entries: readonly CalendarEntry[]): Map<string, CalendarEntry[]> {
  const byDay = new Map<string, CalendarEntry[]>();
  for (const entry of [...entries].sort(compareEntries)) {
    byDay.set(entry.dateKey, [...(byDay.get(entry.dateKey) ?? []), entry]);
  }
  return byDay;
}

export default async function TechCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await requireRole("TECH");
  const [t, locale, params] = await Promise.all([
    getTranslations(),
    getRequestLocale(),
    searchParams ?? Promise.resolve<SearchParams>({}),
  ]);

  const technician = await prisma.technician.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });

  if (!technician) {
    return (
      <AppShell title={t("tech.calendar.title")} subtitle={t("tech.home.subtitleEmpty")} role="TECH">
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">{t("tech.home.noProfile")}</p>
        </section>
      </AppShell>
    );
  }

  const now = new Date();
  const todayKey = toBusinessDateKey(now);
  const monthRef = parseMonthKey(firstParam(params.month)) ?? getCurrentMonth(now);
  const monthKey = formatMonthKey(monthRef);
  const selectedDay = resolveSelectedDay(firstParam(params.day), monthRef, todayKey);
  const { start, end } = getMonthGridRange(monthRef);

  const [jobs, plans] = await Promise.all([
    prisma.job.findMany({
      where: {
        technicianId: technician.id,
        scheduledDate: { gte: start, lte: end },
      },
      orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        serviceType: true,
        priority: true,
        sortOrder: true,
        planId: true,
        customer: { select: { nombre: true, apellidos: true } },
        property: { select: { name: true, address: true } },
      },
    }),
    prisma.servicePlan.findMany({
      where: {
        technicianId: technician.id,
        isActive: true,
        nextRunAt: { lte: end },
      },
      orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        nextRunAt: true,
        frequency: true,
        serviceType: true,
        priority: true,
        customer: { select: { nombre: true, apellidos: true } },
        property: { select: { name: true, address: true } },
      },
    }),
  ]);

  const existingKeys = new Set(
    jobs
      .filter((job) => job.planId)
      .map((job) => planOccurrenceKey(job.planId as string, job.scheduledDate))
  );
  const occurrences = projectPlanOccurrences(plans, { rangeStart: start, rangeEnd: end, existingKeys });

  const entries: CalendarEntry[] = [
    ...jobs.map((job) => ({
      id: job.id,
      href: `/tech/jobs/${job.id}`,
      dateKey: toBusinessDateKey(job.scheduledDate),
      scheduledDate: job.scheduledDate,
      customerName: formatJobTitle(formatCustomerName(job.customer), job.property),
      address: job.property.address,
      serviceType: job.serviceType,
      status: job.status,
      priority: job.priority,
      sortOrder: job.sortOrder,
    })),
    ...occurrences.map((occurrence) => ({
      id: `plan-${occurrence.plan.id}-${occurrence.dateKey}`,
      href: null,
      dateKey: occurrence.dateKey,
      scheduledDate: occurrence.scheduledDate,
      customerName: formatJobTitle(
        formatCustomerName(occurrence.plan.customer),
        occurrence.plan.property
      ),
      address: occurrence.plan.property.address,
      serviceType: occurrence.plan.serviceType,
      status: null,
      priority: occurrence.plan.priority,
      sortOrder: null,
    })),
  ];

  const entriesByDay = groupByDay(entries);
  const weeks = buildMonthGrid(monthRef);
  const monthTotal = weeks
    .flat()
    .filter((cell) => cell.inMonth)
    .reduce((total, cell) => total + (entriesByDay.get(cell.dateKey)?.length ?? 0), 0);
  const dayEntries = entriesByDay.get(selectedDay) ?? [];

  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdayLabels = Array.from({ length: DAYS_PER_WEEK }, (_, index) =>
    weekdayFormatter.format(new Date(SAMPLE_MONDAY_UTC + index * MS_PER_DAY))
  );
  const monthLabel = capitalizeFirst(
    new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(monthRef.year, monthRef.month - 1, MID_MONTH_DAY, NOON_HOUR))
    )
  );
  const dayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const formatDay = (dateKey: string) => capitalizeFirst(dayFormatter.format(dateKeyToUtcNoon(dateKey)));
  const formatTime = (value: Date) =>
    value.toLocaleTimeString(locale, { timeZone: BUSINESS_TIMEZONE, hour: "2-digit", minute: "2-digit" });

  const previousMonthKey = formatMonthKey(shiftMonth(monthRef, -1));
  const nextMonthKey = formatMonthKey(shiftMonth(monthRef, 1));
  const navButtonClass =
    "app-button-secondary inline-flex min-h-10 items-center justify-center px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]";

  const renderCell = (cell: CalendarCell) => {
    const count = entriesByDay.get(cell.dateKey)?.length ?? 0;
    const isSelected = cell.dateKey === selectedDay;
    const isToday = cell.dateKey === todayKey;
    const cellClass = [
      "flex min-h-14 w-full flex-col items-center gap-1 rounded-xl border px-1 py-1.5 text-sm transition",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500",
      isSelected
        ? "border-sky-500 bg-sky-50 text-sky-900"
        : "border-slate-200 bg-white text-slate-700 hover:border-sky-300",
      cell.inMonth ? "" : "opacity-50",
    ].join(" ");
    const dayNumberClass = [
      "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
      isToday ? "bg-sky-600 text-white" : "",
    ].join(" ");

    return (
      <td key={cell.dateKey} className="p-0 align-top">
        <Link
          href={monthHref(monthKey, cell.dateKey)}
          aria-current={isSelected ? "date" : undefined}
          aria-label={`${formatDay(cell.dateKey)}, ${t.plural("tech.calendar.dayCount", count)}`}
          className={cellClass}
        >
          <span className={dayNumberClass}>{cell.dayOfMonth}</span>
          {count > 0 ? (
            <span className="app-chip px-1.5 py-0 text-[11px]" data-tone={isSelected ? "success" : "info"}>
              {count}
            </span>
          ) : (
            <span className="h-4" aria-hidden="true" />
          )}
        </Link>
      </td>
    );
  };

  return (
    <AppShell title={t("tech.calendar.title")} subtitle={t("tech.calendar.subtitle")} role="TECH" wide>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="app-card p-4 shadow-contrast sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                {t("tech.calendar.kicker")}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{monthLabel}</h2>
              <p className="text-xs text-slate-500">{t.plural("tech.calendar.monthTotal", monthTotal)}</p>
            </div>
            <nav aria-label={t("tech.calendar.navigation")} className="flex items-center gap-2">
              <Link
                href={monthHref(previousMonthKey)}
                className={navButtonClass}
                aria-label={t("tech.calendar.previousMonth")}
              >
                <span aria-hidden="true">‹</span>
              </Link>
              <Link href={CALENDAR_PATH} className={navButtonClass}>
                {t("tech.calendar.today")}
              </Link>
              <Link
                href={monthHref(nextMonthKey)}
                className={navButtonClass}
                aria-label={t("tech.calendar.nextMonth")}
              >
                <span aria-hidden="true">›</span>
              </Link>
            </nav>
          </div>

          <table
            className="mt-4 w-full table-fixed border-separate border-spacing-1"
            aria-label={t("tech.calendar.gridLabel")}
          >
            <thead>
              <tr>
                {weekdayLabels.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0].dateKey}>{week.map(renderCell)}</tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="app-card p-4 shadow-contrast sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">{formatDay(selectedDay)}</h2>
          <p className="text-xs text-slate-500">{t.plural("tech.calendar.dayCount", dayEntries.length)}</p>
          <ol className="mt-4 space-y-3 text-sm">
            {dayEntries.length === 0 ? (
              <li>
                <p className="text-sm text-slate-500">{t("tech.calendar.empty")}</p>
              </li>
            ) : (
              dayEntries.map((entry) => (
                <li key={entry.id} className="app-callout px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{entry.customerName}</p>
                      <p className="text-xs text-slate-500">{entry.address}</p>
                    </div>
                    <span className="app-chip px-2 py-1 text-xs" data-tone="success">
                      {formatTime(entry.scheduledDate)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="app-chip px-2 py-1 text-xs" data-tone="info">
                      {SERVICE_LABEL_KEYS[entry.serviceType]
                        ? t(SERVICE_LABEL_KEYS[entry.serviceType])
                        : entry.serviceType}
                    </span>
                    {entry.priority === "URGENT" ? (
                      <span className="app-chip px-2 py-1 text-xs" data-tone="danger">
                        {t("jobs.priority.urgent")}
                      </span>
                    ) : null}
                    <span
                      className="app-chip px-2 py-1 text-xs"
                      data-tone={entry.status ? (STATUS_TONES[entry.status] ?? "info") : "warning"}
                    >
                      {entry.status
                        ? t(STATUS_LABEL_KEYS[entry.status] ?? "jobs.status.scheduled")
                        : t("tech.calendar.planned")}
                    </span>
                    {entry.href ? (
                      <Link
                        href={entry.href}
                        className="ml-auto inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-sky-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                      >
                        {t("tech.calendar.openJob")}
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ol>
        </div>
      </section>
    </AppShell>
  );
}
