"use client";

import { useCallback, useId, useMemo, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import {
  CUSTOM_SERVICE_PLAN_NAME,
  getRecurringPlanLabelKey,
} from "@/lib/jobs/recurring-plan-templates";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import { TECH_DAILY_CAPACITY, toDateKey } from "@/lib/jobs/capacity";
import { getAssetUrl } from "@/lib/assets";
import { formatUsPhone } from "@/lib/phones";
import { formatJobTitle, formatPropertyLabel } from "@/lib/customers/format";
import { useI18n } from "@/i18n/client";
import { useIsHydrated } from "@/lib/ui/use-is-hydrated";
import RoutesSectionTabs from "@/components/routes/RoutesSectionTabs";
import AppModal from "@/components/ui/AppModal";
import {
  applyBusinessTime,
  BUSINESS_TIMEZONE,
  endOfBusinessDay,
  getBusinessTimeParts,
  parseBusinessDateInput,
  parseBusinessDateTimeInput,
  startOfBusinessDay,
} from "@/lib/timezone";

type JobItem = {
  id: string;
  scheduledDate: string;
  entryKind: "job";
  status: string;
  type: string;
  priority: string;
  serviceTierId: string | null;
  serviceType: string;
  estimatedDurationMinutes: number | null;
  technicianId: string | null;
  sortOrder?: number | null;
  planId?: string | null;
  planName?: string | null;
  showScheduledTime: boolean;
  notes?: string | null;
  customerNotes?: string | null;
  checklist?: { label?: string; completed?: boolean }[] | null;
  photos: { id: string; url: string; takenAt: string }[];
  customer: { id: string; name: string; email?: string | null; phone?: string | null };
  property: {
    id: string;
    name?: string | null;
    address: string;
    poolType?: string | null;
    sanitizerType?: string | null;
    poolVolumeGallons?: number | null;
    filterType?: string | null;
    accessInfo?: string | null;
    locationNotes?: string | null;
    hasSpa?: boolean | null;
  };
  technician: { id: string; name: string } | null;
};

type PlanOccurrence = {
  id: string;
  scheduledDate: string;
  entryKind: "plan";
  status: string;
  type: string;
  priority: string;
  serviceTierId: string | null;
  serviceType: string;
  estimatedDurationMinutes: number | null;
  technicianId: string | null;
  sortOrder?: number | null;
  planId: string;
  planName: string;
  showScheduledTime: boolean;
  notes?: string | null;
  checklist?: { label?: string; completed?: boolean }[] | null;
  photos: { id: string; url: string; takenAt: string }[];
  customer: { id: string; name: string; email?: string | null; phone?: string | null };
  property: {
    id: string;
    name?: string | null;
    address: string;
    poolType?: string | null;
    sanitizerType?: string | null;
    poolVolumeGallons?: number | null;
    filterType?: string | null;
    accessInfo?: string | null;
    locationNotes?: string | null;
    hasSpa?: boolean | null;
  };
  technician: { id: string; name: string } | null;
};

type CalendarItem = JobItem | PlanOccurrence;

type Technician = {
  id: string;
  name: string;
  colorHex?: string | null;
};

type Customer = {
  id: string;
  name: string;
  properties: { id: string; address: string }[];
};

type JobDraft = {
  id: string;
  customerId: string;
  propertyId: string;
  technicianId: string;
  scheduledTime: string;
  serviceTierId: string;
  serviceType: string;
  priority: string;
  type: string;
  estimatedDuration: string;
  notes: string;
};

type PendingUpdate = {
  scheduledDate?: string;
  sortOrder?: number | null;
  technicianId?: string | null;
};

type JobModalState = {
  jobId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  propertyName: string;
  propertyAddress: string;
  propertyPoolType: string;
  propertySanitizerType: string;
  propertyPoolVolume: string;
  propertyFilterType: string;
  propertyAccessInfo: string;
  propertyLocationNotes: string;
  propertyHasSpa: boolean;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  priority: string;
  serviceTierId: string;
  serviceType: string;
  technicianId: string;
  type: string;
  notes: string;
  customerNotes: string;
  checklist: { label?: string; completed?: boolean }[];
  photos: { id: string; url: string; takenAt: string }[];
  /** Destino del bloque "Mover a" (mismo camino de guardado que soltar la tarjeta). */
  moveDate: string;
  moveTime: string;
};

type ServiceTier = {
  id: string;
  name: string;
  isActive: boolean;
  checklist?: { label?: string; completed?: boolean }[] | null;
};

type SortKey =
  | "date"
  | "status"
  | "priority"
  | "technician"
  | "customer"
  | "service"
  | "address";

type ScheduledFiltersState = {
  statusFilter: string;
  techFilter: string;
  priorityFilter: string;
  searchFilter: string;
  rangeFilter: "WEEK" | "MONTH" | "CUSTOM";
  customStart: string;
  customEnd: string;
};

type RoutesCalendarProps = {
  jobs: JobItem[];
  planOccurrences: PlanOccurrence[];
  technicians: Technician[];
  customers: Customer[];
  serviceTiers: ServiceTier[];
  monthKey: string;
  nextMonthJobsCount: number;
};

const buildDaysShort = (locale: string) => {
  const base = new Date(2024, 0, 7); // Sunday
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: BUSINESS_TIMEZONE,
    })
      .format(new Date(base.getTime() + index * 86400000))
      .replace(".", "")
      .toUpperCase()
  );
};

const parseMonthKey = (value: string) => {
  const parsed = DateTime.fromFormat(value, "yyyy-MM", {
    zone: BUSINESS_TIMEZONE,
  });
  if (!parsed.isValid) {
    return null;
  }
  return parsed.startOf("month").toUTC().toJSDate();
};

const toMonthKey = (value: Date) =>
  DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE).toFormat("yyyy-MM");

const getBusinessDayNumber = (value: Date) =>
  DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE).day;

const getBusinessWeekdayIndex = (value: Date) =>
  DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE).weekday % 7;

const getJobTimestamp = (value: string) => {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return 0;
  }
  return time;
};

const sortJobsChronologically = <T extends { id: string; scheduledDate: string; sortOrder?: number | null }>(
  list: T[]
) =>
  [...list].sort((a, b) => {
    const byDate = getJobTimestamp(a.scheduledDate) - getJobTimestamp(b.scheduledDate);
    if (byDate !== 0) {
      return byDate;
    }
    if (a.sortOrder != null && b.sortOrder != null) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.sortOrder != null) {
      return -1;
    }
    if (b.sortOrder != null) {
      return 1;
    }
    return a.id.localeCompare(b.id);
  });

// Contador de respaldo para entornos sin crypto.randomUUID (ids solo de cliente).
let draftIdFallbackCounter = 0;

const createDraftId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  draftIdFallbackCounter += 1;
  return `draft-${draftIdFallbackCounter}`;
};

const createDraft = (
  customers: Customer[],
  serviceTiers: ServiceTier[]
): JobDraft => {
  const firstCustomer = customers[0];
  const firstProperty = firstCustomer?.properties[0];
  return {
    id: createDraftId(),
    customerId: firstCustomer?.id ?? "",
    propertyId: firstProperty?.id ?? "",
    technicianId: "",
    scheduledTime: "09:00",
    serviceTierId: serviceTiers[0]?.id ?? "",
    serviceType: "WEEKLY_CLEANING",
    priority: "NORMAL",
    type: "ROUTINE",
    estimatedDuration: "",
    notes: "",
  };
};

// Payload que espera /api/jobs/bulk-create: excluye el id local del borrador.
const toDraftPayload = (draft: JobDraft) => ({
  customerId: draft.customerId,
  propertyId: draft.propertyId,
  technicianId: draft.technicianId,
  scheduledTime: draft.scheduledTime,
  serviceTierId: draft.serviceTierId,
  serviceType: draft.serviceType,
  priority: draft.priority,
  type: draft.type,
  notes: draft.notes,
  estimatedDurationMinutes: draft.estimatedDuration
    ? Number(draft.estimatedDuration)
    : null,
});

const normalizeChecklist = (value?: { label?: string; completed?: boolean }[] | null) =>
  Array.isArray(value)
    ? value
        .map((item) => ({
          label: String(item?.label ?? "").trim(),
          completed: false,
        }))
        .filter((item) => item.label)
    : [];

const HIGHLIGHT_DURATION_MS = 7000;
const SAVE_SUCCESS_FEEDBACK_MS = 1600;

// Boton invisible para el raton (sin espacio ni clics) que aparece al recibir
// foco: alternativa de teclado a las acciones que dependen de arrastrar o de
// pulsar una zona de la celda.
const FOCUS_ONLY_ACTION_CLASS =
  "pointer-events-none absolute right-2 top-2 z-20 inline-flex items-center rounded-full border border-sky-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-700 opacity-0 focus:pointer-events-auto focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-sky-200";

const resolveRangeStart = (
  rangeFilter: ScheduledFiltersState["rangeFilter"],
  customStart: string,
  weekStart: Date,
  monthStart: Date
) => {
  if (rangeFilter === "MONTH") {
    return startOfBusinessDay(monthStart) ?? monthStart;
  }
  if (rangeFilter === "CUSTOM") {
    const date = parseBusinessDateInput(customStart);
    if (date) {
      return startOfBusinessDay(date) ?? date;
    }
  }
  return weekStart;
};

const resolveRangeEnd = (
  rangeFilter: ScheduledFiltersState["rangeFilter"],
  customEnd: string,
  weekEnd: Date,
  monthEnd: Date
) => {
  if (rangeFilter === "MONTH") {
    return endOfBusinessDay(monthEnd) ?? monthEnd;
  }
  if (rangeFilter === "CUSTOM") {
    const date = parseBusinessDateInput(customEnd);
    if (date) {
      return endOfBusinessDay(date) ?? date;
    }
  }
  return weekEnd;
};

export default function RoutesCalendar({
  jobs,
  planOccurrences,
  technicians,
  customers,
  serviceTiers,
  monthKey,
  nextMonthJobsCount,
}: RoutesCalendarProps) {
  const { t, locale } = useI18n();
  const [jobsState, setJobsState] = useState(() =>
    sortJobsChronologically(jobs.map((job) => ({ ...job, scheduledDate: job.scheduledDate })))
  );
  const [pendingChanges, setPendingChanges] = useState<
    Record<string, PendingUpdate>
  >({});
  const [editMode, setEditMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<JobDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightJobId, setHighlightJobId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    dateKey: string;
    jobId?: string;
    position?: "before" | "after";
  } | null>(null);
  const [activeTechJobId, setActiveTechJobId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [jobModal, setJobModal] = useState<JobModalState | null>(null);
  const [mobileDayKey, setMobileDayKey] = useState<string | null>(null);
  const [mobileDeleteConfirmId, setMobileDeleteConfirmId] = useState<string | null>(null);
  const mounted = useIsHydrated();
  const modalIdBase = useId();
  const filtersTitleId = `${modalIdBase}-filters-title`;
  const mobileDayKickerId = `${modalIdBase}-mobile-day-kicker`;
  const mobileDayTitleId = `${modalIdBase}-mobile-day-title`;
  const assignKickerId = `${modalIdBase}-assign-kicker`;
  const assignTitleId = `${modalIdBase}-assign-title`;
  const jobDetailKickerId = `${modalIdBase}-job-detail-kicker`;
  const jobDetailTitleId = `${modalIdBase}-job-detail-title`;
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [techFilter, setTechFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [searchFilter, setSearchFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState<"WEEK" | "MONTH" | "CUSTOM">(
    "WEEK"
  );
  const [customStart, setCustomStart] = useState(() => toDateKey(new Date()));
  const [customEnd, setCustomEnd] = useState(() => toDateKey(new Date()));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState<ScheduledFiltersState>({
    statusFilter: "ALL",
    techFilter: "ALL",
    priorityFilter: "ALL",
    searchFilter: "",
    rangeFilter: "WEEK",
    customStart: toDateKey(new Date()),
    customEnd: toDateKey(new Date()),
  });
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const daysShort = useMemo(() => buildDaysShort(locale), [locale]);
  const techniciansById = useMemo(
    () =>
      new Map(
        technicians.map((tech) => [tech.id, { name: tech.name, color: tech.colorHex }])
      ),
    [technicians]
  );
  const serviceTiersById = useMemo(
    () => new Map(serviceTiers.map((tier) => [tier.id, tier])),
    [serviceTiers]
  );
  const getTierChecklist = (tierId: string) =>
    normalizeChecklist(serviceTiersById.get(tierId)?.checklist);
  const activeServiceTiers = useMemo(
    () => serviceTiers.filter((tier) => tier.isActive),
    [serviceTiers]
  );
  const tierOptions = activeServiceTiers.length > 0 ? activeServiceTiers : serviceTiers;
  const getPlanDisplayName = (planName?: string | null) => {
    if (!planName) {
      return "";
    }
    if (planName === CUSTOM_SERVICE_PLAN_NAME) {
      return CUSTOM_SERVICE_PLAN_NAME;
    }
    const labelKey = getRecurringPlanLabelKey(planName);
    return labelKey ? t(labelKey) : planName;
  };

  // Sincroniza estado derivado de la URL solo en cliente (tras hidratar),
  // con la misma semantica que tenia el efecto previo.
  const searchParamsKey = searchParams.toString();
  const [syncedSearchParamsKey, setSyncedSearchParamsKey] = useState<string | null>(null);
  if (mounted && searchParamsKey !== syncedSearchParamsKey) {
    setSyncedSearchParamsKey(searchParamsKey);
    const highlight = searchParams.get("highlight");
    if (highlight) {
      setHighlightJobId(highlight);
    }
    const techParam = searchParams.get("tech");
    if (techParam) {
      setTechFilter(techParam);
    }
  }

  useEffect(() => {
    if (!searchParams.get("highlight")) {
      return;
    }
    const timeout = setTimeout(() => setHighlightJobId(null), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [searchParams]);

  const [syncedMobileDayKey, setSyncedMobileDayKey] = useState(mobileDayKey);
  if (mobileDayKey !== syncedMobileDayKey) {
    setSyncedMobileDayKey(mobileDayKey);
    if (!mobileDayKey) {
      setMobileDeleteConfirmId(null);
    }
  }

  useEffect(() => {
    if (!mobileDeleteConfirmId) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setMobileDeleteConfirmId(null);
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [mobileDeleteConfirmId]);

  // El estado local se reinicia al cambiar de mes o cuando el servidor trae datos
  // nuevos: el padre monta el componente con `key={monthKey:dataVersion}`
  // (ver src/app/admin/routes/page.tsx).

  if (selectedJobId && !jobsState.some((job) => job.id === selectedJobId)) {
    setSelectedJobId(null);
  }

  const businessNow = DateTime.now().setZone(BUSINESS_TIMEZONE);
  const today = businessNow.toUTC().toJSDate();
  const todayKey = businessNow.toFormat("yyyy-MM-dd");
  const startOfToday = startOfBusinessDay(today) ?? today;
  const viewedMonthStart = parseMonthKey(monthKey) ?? businessNow.startOf("month").toUTC().toJSDate();
  const viewedMonth = DateTime.fromJSDate(viewedMonthStart).setZone(BUSINESS_TIMEZONE).startOf("month");
  const monthStart = viewedMonth.startOf("month").toUTC().toJSDate();
  const monthEnd = viewedMonth.endOf("month").toUTC().toJSDate();
  const viewedMonthKey = viewedMonth.toFormat("yyyy-MM");
  const calendarStart = viewedMonth
    .minus({ days: viewedMonth.weekday % 7 })
    .startOf("day");
  const monthEndDt = viewedMonth.endOf("month");
  const calendarEnd = monthEndDt
    .plus({ days: 6 - (monthEndDt.weekday % 7) })
    .endOf("day");

  const calendarDays: Date[] = [];
  for (
    let cursor = calendarStart;
    cursor.toMillis() <= calendarEnd.toMillis();
    cursor = cursor.plus({ days: 1 })
  ) {
    calendarDays.push(cursor.toUTC().toJSDate());
  }

  const jobsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const matchesTechFilter = (technicianId: string | null) => {
      if (techFilter === "ALL") {
        return true;
      }
      if (techFilter === "UNASSIGNED") {
        return !technicianId;
      }
      return technicianId === techFilter;
    };
    for (const job of jobsState) {
      if (!matchesTechFilter(job.technicianId)) {
        continue;
      }
      const date = new Date(job.scheduledDate);
      const key = toDateKey(date);
      const list = map.get(key) ?? [];
      list.push(job);
      map.set(key, list);
    }
    for (const plan of planOccurrences) {
      if (!matchesTechFilter(plan.technicianId)) {
        continue;
      }
      const date = new Date(plan.scheduledDate);
      const key = toDateKey(date);
      const list = map.get(key) ?? [];
      list.push(plan);
      map.set(key, list);
    }
    return map;
  }, [jobsState, planOccurrences, techFilter]);

  const sortJobsForDay = (list: CalendarItem[]) => {
    return sortJobsChronologically(list);
  };

  const monthLabelRaw = monthStart.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: BUSINESS_TIMEZONE,
  });
  const monthLabel =
    monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);
  const nextMonthJobsLabel = t("admin.routes.labels.nextMonthJobs");

  const moveMonth = (offset: number) => {
    const nextMonth = viewedMonth.plus({ months: offset }).startOf("month").toUTC().toJSDate();
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", toMonthKey(nextMonth));
    router.push(`${pathname}?${params.toString()}`);
  };
  const currentMonthKey = businessNow.toFormat("yyyy-MM");
  const isCurrentMonthViewed = viewedMonthKey === currentMonthKey;
  const goToCurrentMonth = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", currentMonthKey);
    router.push(`${pathname}?${params.toString()}`);
  };

  const summary = {
    todayJobs: jobsState.filter(
      (job) => toDateKey(new Date(job.scheduledDate)) === todayKey
    ).length,
    urgent: jobsState.filter((job) => job.priority === "URGENT").length,
    unassigned: jobsState.filter((job) => !job.technicianId).length,
  };

  const todayBusinessStart = businessNow.startOf("day");
  const weekStart = todayBusinessStart
    .minus({ days: todayBusinessStart.weekday % 7 })
    .startOf("day")
    .toUTC()
    .toJSDate();
  const weekEnd = DateTime.fromJSDate(weekStart)
    .setZone(BUSINESS_TIMEZONE)
    .plus({ days: 6 })
    .endOf("day")
    .toUTC()
    .toJSDate();

  if (rangeFilter === "CUSTOM" && !customStart) {
    setCustomStart(toDateKey(weekStart));
  }
  if (rangeFilter === "CUSTOM" && !customEnd) {
    setCustomEnd(toDateKey(weekEnd));
  }

  const rangeStart = resolveRangeStart(rangeFilter, customStart, weekStart, monthStart);
  const rangeEnd = resolveRangeEnd(rangeFilter, customEnd, weekEnd, monthEnd);

  const rangeJobs = jobsState.filter((job) => {
    const date = new Date(job.scheduledDate);
    return date >= rangeStart && date <= rangeEnd;
  });

  const filteredRangeJobs = rangeJobs.filter((job) => {
    if (statusFilter !== "ALL" && job.status !== statusFilter) {
      return false;
    }
    if (techFilter === "UNASSIGNED") {
      if (job.technicianId) {
        return false;
      }
    } else if (techFilter !== "ALL" && job.technicianId !== techFilter) {
      return false;
    }
    if (priorityFilter !== "ALL" && job.priority !== priorityFilter) {
      return false;
    }
    if (searchFilter.trim()) {
      const query = searchFilter.trim().toLowerCase();
      const haystack = [
        job.customer.name,
        job.customer.email ?? "",
        job.customer.phone ?? "",
        job.property.name ?? "",
        job.property.address,
        job.technician?.name ?? "",
        job.serviceType,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const statusOrder = [
    "PLANNED",
    "SCHEDULED",
    "PENDING",
    "ON_THE_WAY",
    "IN_PROGRESS",
    "COMPLETED",
  ];
  const priorityOrder = ["URGENT", "NORMAL"];
  const statusMeta: Record<
    string,
    { label: string; className: string }
  > = {
    PLANNED: {
      label: t("admin.routes.labels.statusPlanned"),
      className: "border-violet-200 bg-violet-50 text-violet-700",
    },
    SCHEDULED: {
      label: t("jobs.status.scheduled"),
      className: "border-sky-200 bg-sky-50 text-sky-700",
    },
    PENDING: {
      label: t("jobs.status.pending"),
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    ON_THE_WAY: {
      label: t("jobs.status.onTheWay"),
      className: "border-cyan-200 bg-cyan-50 text-cyan-700",
    },
    IN_PROGRESS: {
      label: t("jobs.status.inProgress"),
      className: "border-blue-200 bg-blue-50 text-blue-700",
    },
    COMPLETED: {
      label: t("jobs.status.completed"),
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
  };
  const priorityMeta: Record<
    string,
    { label: string; className: string }
  > = {
    URGENT: {
      label: t("jobs.priority.urgent"),
      className: "border-rose-200 bg-rose-50 text-rose-700",
    },
    NORMAL: {
      label: t("jobs.priority.normal"),
      className: "border-slate-200 bg-slate-50 text-slate-600",
    },
  };

  const sortDirection = sortDir === "asc" ? 1 : -1;
  const getSortValue = (job: JobItem) => {
    switch (sortKey) {
      case "status":
        return statusOrder.indexOf(job.status);
      case "priority":
        return priorityOrder.indexOf(job.priority);
      case "technician":
        return job.technician?.name ?? "";
      case "customer":
        return job.customer.name;
      case "service": {
        const serviceOption = serviceTypeOptions.find(
          (option) => option.value === job.serviceType
        );
        return serviceOption?.labelKey
          ? t(serviceOption.labelKey)
          : serviceOption?.label ?? job.serviceType;
      }
      case "address":
        return job.property.address;
      case "date":
      default:
        return new Date(job.scheduledDate).getTime();
    }
  };
  const sortedRangeJobs = [...filteredRangeJobs].sort((a, b) => {
    const aValue = getSortValue(a);
    const bValue = getSortValue(b);
    if (typeof aValue === "number" && typeof bValue === "number") {
      return (aValue - bValue) * sortDirection;
    }
    return String(aValue).localeCompare(String(bValue)) * sortDirection;
  });

  const formatRangeDate = (value: Date) =>
    value.toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: BUSINESS_TIMEZONE,
    });
  const rangeLabel = `${formatRangeDate(rangeStart)} - ${formatRangeDate(
    rangeEnd
  )}`;
  const activeFiltersCount = [
    rangeFilter !== "WEEK",
    statusFilter !== "ALL",
    techFilter !== "ALL",
    priorityFilter !== "ALL",
    searchFilter.trim().length > 0,
  ].filter(Boolean).length;

  const openFiltersModal = () => {
    setFiltersDraft({
      statusFilter,
      techFilter,
      priorityFilter,
      searchFilter,
      rangeFilter,
      customStart,
      customEnd,
    });
    setFiltersOpen(true);
  };

  const applyScheduledFilters = () => {
    const next = { ...filtersDraft };
    if (next.rangeFilter === "CUSTOM") {
      if (!next.customStart && next.customEnd) {
        next.customStart = next.customEnd;
      }
      if (!next.customEnd && next.customStart) {
        next.customEnd = next.customStart;
      }
      if (!next.customStart || !next.customEnd) {
        next.rangeFilter = "WEEK";
        next.customStart = toDateKey(weekStart);
        next.customEnd = toDateKey(weekEnd);
      } else if (next.customStart > next.customEnd) {
        next.customEnd = next.customStart;
      }
    }
    setStatusFilter(next.statusFilter);
    setTechFilter(next.techFilter);
    setPriorityFilter(next.priorityFilter);
    setSearchFilter(next.searchFilter);
    setRangeFilter(next.rangeFilter);
    setCustomStart(next.customStart);
    setCustomEnd(next.customEnd);
    setFiltersOpen(false);
  };

  const resetScheduledFilters = () => {
    const defaultStart = toDateKey(weekStart);
    const defaultEnd = toDateKey(weekEnd);
    setStatusFilter("ALL");
    setTechFilter("ALL");
    setPriorityFilter("ALL");
    setSearchFilter("");
    setRangeFilter("WEEK");
    setCustomStart(defaultStart);
    setCustomEnd(defaultEnd);
    setFiltersDraft({
      statusFilter: "ALL",
      techFilter: "ALL",
      priorityFilter: "ALL",
      searchFilter: "",
      rangeFilter: "WEEK",
      customStart: defaultStart,
      customEnd: defaultEnd,
    });
    setFiltersOpen(false);
  };

  const handleSort = (key: SortKey) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return current;
      }
      setSortDir("asc");
      return key;
    });
  };

  const renderSortButton = (
    label: string,
    key: SortKey,
    variant: "light" | "dark" = "light"
  ) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className={`group flex w-full items-center justify-between gap-1 text-left text-[11px] font-semibold uppercase tracking-[0.2em] ${
        variant === "dark"
          ? "text-slate-100/80 hover:text-white"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <span>{label}</span>
      {sortKey === key ? (
        <span
          className={`text-[11px] ${
            variant === "dark" ? "text-white/80" : "text-slate-400"
          }`}
        >
          {sortDir === "asc" ? "^" : "v"}
        </span>
      ) : null}
    </button>
  );

  const dayCapacity = Math.max(1, technicians.length * TECH_DAILY_CAPACITY);
  const getCapacityRatio = (jobsCount: number) =>
    Math.max(0, Math.min(1, jobsCount / dayCapacity));
  const getCapacityColor = (jobsCount: number) => {
    const ratio = getCapacityRatio(jobsCount);
    const hue = Math.round(135 - ratio * 135);
    return `hsl(${hue} 72% 44%)`;
  };
  const getCapacitySoftColor = (jobsCount: number) => {
    const ratio = getCapacityRatio(jobsCount);
    const hue = Math.round(135 - ratio * 135);
    return `hsl(${hue} 78% 95%)`;
  };

  const mobileDayJobs = useMemo(
    () => (mobileDayKey ? sortJobsForDay(jobsByDate.get(mobileDayKey) ?? []) : []),
    [mobileDayKey, jobsByDate]
  );
  const mobileDayDate = mobileDayKey ? parseBusinessDateInput(mobileDayKey) : null;

  const cellPadding = "px-3 py-2.5 xl:px-4 xl:py-3";
  const tableTextSize = "text-[11px] xl:text-xs";
  const modalStatus = jobModal
    ? statusMeta[jobModal.status] ?? {
        label: jobModal.status,
        className: "border-slate-200 bg-slate-50 text-slate-600",
      }
    : null;
  const modalPriority = jobModal
    ? priorityMeta[jobModal.priority] ?? {
        label: jobModal.priority,
        className: "border-slate-200 bg-slate-50 text-slate-600",
      }
    : null;

  const setPendingForJob = (jobId: string, patch: PendingUpdate) => {
    setPendingChanges((current) => ({
      ...current,
      [jobId]: { ...(current[jobId] ?? {}), ...patch },
    }));
  };

  const moveJobToDate = (targetDate: Date, jobId: string) => {
    if (!editMode) {
      return;
    }
    const current = jobsState;
    const jobMap = new Map(current.map((job) => [job.id, { ...job }]));
    const dragged = jobMap.get(jobId);
    if (!dragged) {
      return;
    }

    const originalDate = new Date(dragged.scheduledDate);
    const sourceKey = toDateKey(originalDate);
    const targetKey = toDateKey(targetDate);

    const updatedDate = applyBusinessTime(targetDate, originalDate) ?? new Date(targetDate);

    const pendingUpdates: Record<string, PendingUpdate> = {};
    const addPending = (id: string, patch: PendingUpdate) => {
      pendingUpdates[id] = { ...(pendingUpdates[id] ?? {}), ...patch };
    };

    if (sourceKey !== targetKey) {
      dragged.scheduledDate = updatedDate.toISOString();
      const timeParts = getBusinessTimeParts(updatedDate);
      dragged.sortOrder = (timeParts?.hour ?? 0) * 60 + (timeParts?.minute ?? 0);
      jobMap.set(jobId, dragged);
      addPending(jobId, {
        scheduledDate: dragged.scheduledDate,
        sortOrder: dragged.sortOrder,
      });
    }

    setJobsState(sortJobsChronologically(Array.from(jobMap.values())));
    if (Object.keys(pendingUpdates).length > 0) {
      setPendingChanges((currentChanges) => ({
        ...currentChanges,
        ...pendingUpdates,
      }));
    }
  };

  const openModalForDate = (date: Date) => {
    if (!editMode) {
      return;
    }
    if (customers.length === 0) {
      setErrorMessage(t("admin.routes.errors.needCustomers"));
      return;
    }
    setSelectedDate(toDateKey(date));
    setDrafts([createDraft(customers, tierOptions)]);
  };

  const openJobModal = (job: JobItem) => {
    const scheduled = new Date(job.scheduledDate);
    const scheduledDate = toDateKey(scheduled);
    const scheduledTime = DateTime.fromJSDate(scheduled)
      .setZone(BUSINESS_TIMEZONE)
      .toFormat("HH:mm");
    const checklistItems = Array.isArray(job.checklist)
      ? job.checklist.map((item) => ({
          label: item?.label,
          completed: Boolean(item?.completed),
        }))
      : [];
    const resolvedTierId =
      job.serviceTierId ?? tierOptions[0]?.id ?? "";
    const propertyName = formatPropertyLabel(
      job.property,
      t("admin.routes.labels.propertyFallback")
    );
    setActiveTechJobId(null);
    setJobModal({
      jobId: job.id,
      customerName: job.customer.name,
      customerEmail: job.customer.email ?? "",
      customerPhone: job.customer.phone ?? "",
      propertyName,
      propertyAddress: job.property.address,
      propertyPoolType: job.property.poolType ?? "",
      propertySanitizerType: job.property.sanitizerType ?? "",
      propertyPoolVolume:
        job.property.poolVolumeGallons != null
          ? String(job.property.poolVolumeGallons)
          : "",
      propertyFilterType: job.property.filterType ?? "",
      propertyAccessInfo: job.property.accessInfo ?? "",
      propertyLocationNotes: job.property.locationNotes ?? "",
      propertyHasSpa: Boolean(job.property.hasSpa),
      scheduledDate,
      scheduledTime,
      status: job.status,
      priority: job.priority,
      serviceTierId: resolvedTierId,
      serviceType: job.serviceType,
      technicianId: job.technicianId ?? "",
      type: job.type,
      notes: job.notes ?? "",
      customerNotes: job.customerNotes ?? "",
      checklist:
        checklistItems.length > 0
          ? checklistItems
          : resolvedTierId
            ? getTierChecklist(resolvedTierId)
            : [],
      photos: Array.isArray(job.photos) ? job.photos : [],
      moveDate: scheduledDate,
      moveTime: scheduledTime,
    });
  };

  const updateJobModal = (patch: Partial<JobModalState>) => {
    setJobModal((current) => (current ? { ...current, ...patch } : current));
  };

  const updateJobChecklist = (index: number, completed: boolean) => {
    setJobModal((current) => {
      if (!current) {
        return current;
      }
      const checklist = current.checklist.map((item, idx) =>
        idx === index ? { ...item, completed } : item
      );
      return { ...current, checklist };
    });
  };

  const updateDraft = (draftId: string, patch: Partial<JobDraft>) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === draftId ? { ...draft, ...patch } : draft))
    );
  };

  const handleCustomerChange = (draftId: string, customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    updateDraft(draftId, {
      customerId,
      propertyId: customer?.properties[0]?.id ?? "",
    });
  };

  const addDraft = () => {
    setDrafts((current) => [...current, createDraft(customers, tierOptions)]);
  };

  const removeDraft = (draftId: string) => {
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
  };

  const handleCreateJobs = async () => {
    if (!selectedDate || drafts.length === 0) {
      return;
    }
    const hasInvalid = drafts.some(
      (draft) => !draft.customerId || !draft.propertyId
    );
    if (hasInvalid) {
      setErrorMessage(t("admin.routes.errors.selectCustomerProperty"));
      return;
    }
    setErrorMessage(null);
    setCreating(true);
    const payload = {
      date: selectedDate,
      jobs: drafts.map(toDraftPayload),
    };
    try {
      const res = await fetch("/api/jobs/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({ jobs: [] }));
      if (res.ok && Array.isArray(data.jobs)) {
        setJobsState((current) => sortJobsChronologically([...data.jobs, ...current]));
        setSelectedDate(null);
        setDrafts([]);
      } else {
        setErrorMessage(t("admin.routes.errors.createFailed"));
      }
    } catch {
      setErrorMessage(t("admin.routes.errors.network"));
    } finally {
      setCreating(false);
    }
  };

  const showSaveSuccess = useCallback(() => {
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), SAVE_SUCCESS_FEEDBACK_MS);
  }, []);

  const saveSingleUpdate = async (
    jobId: string,
    patch: PendingUpdate
  ) => {
    setErrorMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/routes/bulk-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ updates: [{ jobId, ...patch }] }),
      });
      if (!res.ok) {
        setErrorMessage(t("admin.routes.errors.saveFailed"));
        return false;
      }
      showSaveSuccess();
      return true;
    } catch {
      setErrorMessage(t("admin.routes.errors.network"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteJobById = useCallback(
    async (jobId: string) => {
      if (!jobId) {
        return false;
      }
      setErrorMessage(null);
      setSaving(true);
      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const error = await res.json().catch(() => null);
          setErrorMessage(
            error?.error || t("admin.routes.errors.deleteJobFailed")
          );
          return false;
        }
        setJobsState((current) => current.filter((job) => job.id !== jobId));
        setPendingChanges((current) => {
          if (!current[jobId]) {
            return current;
          }
          const next = { ...current };
          delete next[jobId];
          return next;
        });
        setSelectedJobId((current) => (current === jobId ? null : current));
        setHighlightJobId((current) => (current === jobId ? null : current));
        setActiveTechJobId((current) => (current === jobId ? null : current));
        showSaveSuccess();
        return true;
      } catch {
        setErrorMessage(t("admin.routes.errors.network"));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [t, showSaveSuccess]
  );

  const handleTechnicianAssign = async (
    jobId: string,
    technicianId: string
  ) => {
    const nextTechnicianId = technicianId || null;
    const techInfo = nextTechnicianId
      ? techniciansById.get(nextTechnicianId)
      : null;
    const techName = techInfo?.name ?? null;
    // Snapshot para revertir la asignacion optimista si el guardado falla.
    const previousJob = jobsState.find((job) => job.id === jobId);
    setJobsState((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              technicianId: nextTechnicianId,
              technician: nextTechnicianId
                ? {
                    id: nextTechnicianId,
                    name: techName ?? t("admin.routes.labels.technicianFallback"),
                  }
                : null,
            }
          : job
      )
    );
    if (editMode) {
      setPendingForJob(jobId, { technicianId: nextTechnicianId });
    } else {
      const saved = await saveSingleUpdate(jobId, { technicianId: nextTechnicianId });
      if (!saved && previousJob) {
        setJobsState((current) =>
          current.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  technicianId: previousJob.technicianId,
                  technician: previousJob.technician,
                }
              : job
          )
        );
      }
    }
    setActiveTechJobId(null);
  };

  const handleJobModalSave = async () => {
    if (!jobModal) {
      return;
    }
    const scheduledDateTime = parseBusinessDateTimeInput(
      jobModal.scheduledDate,
      jobModal.scheduledTime || "00:00"
    );
    if (!scheduledDateTime) {
      setErrorMessage(t("admin.routes.errors.saveJobFailed"));
      return;
    }
    setErrorMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobModal.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jobId: jobModal.jobId,
          scheduledDate: scheduledDateTime.toISOString(),
          status: jobModal.status,
          priority: jobModal.priority,
          serviceTierId: jobModal.serviceTierId,
          serviceType: jobModal.serviceType,
          technicianId: jobModal.technicianId || null,
          notes: jobModal.notes || null,
          checklist: jobModal.checklist,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setErrorMessage(
          error?.error || t("admin.routes.errors.saveJobFailed")
        );
        return;
      }
      const techInfo = jobModal.technicianId
        ? techniciansById.get(jobModal.technicianId)
        : null;
      const timeParts = getBusinessTimeParts(scheduledDateTime);
      const nextSortOrder = (timeParts?.hour ?? 0) * 60 + (timeParts?.minute ?? 0);
      setJobsState((current) =>
        sortJobsChronologically(current.map((job) =>
          job.id === jobModal.jobId
            ? {
                ...job,
                scheduledDate: scheduledDateTime.toISOString(),
                sortOrder: nextSortOrder,
                status: jobModal.status,
                priority: jobModal.priority,
                serviceTierId: jobModal.serviceTierId || null,
                serviceType: jobModal.serviceType,
                technicianId: jobModal.technicianId || null,
                technician: jobModal.technicianId
                  ? {
                      id: jobModal.technicianId,
                      name: techInfo?.name ?? t("admin.routes.labels.technicianFallback"),
                    }
                  : null,
                notes: jobModal.notes || null,
                checklist: jobModal.checklist,
              }
            : job
        ))
      );
      setJobModal(null);
    } catch {
      setErrorMessage(t("admin.routes.errors.network"));
    } finally {
      setSaving(false);
    }
  };

  // Alternativa de teclado/tactil a soltar la tarjeta en otro dia. Reutiliza
  // el mismo camino de guardado que el drop: en modo edicion queda en
  // pendingChanges (se envia con "Guardar cambios"); fuera de el se guarda al
  // momento con saveSingleUpdate, igual que la asignacion de tecnico.
  const handleMoveJob = async () => {
    if (!jobModal) {
      return;
    }
    const targetDateTime = parseBusinessDateTimeInput(
      jobModal.moveDate,
      jobModal.moveTime || "00:00"
    );
    if (!targetDateTime) {
      setErrorMessage(t("admin.routes.errors.saveJobFailed"));
      return;
    }
    const jobId = jobModal.jobId;
    const previousJob = jobsState.find((job) => job.id === jobId);
    const timeParts = getBusinessTimeParts(targetDateTime);
    const scheduledDate = targetDateTime.toISOString();
    const sortOrder = (timeParts?.hour ?? 0) * 60 + (timeParts?.minute ?? 0);
    const applySchedule = (
      nextScheduledDate: string,
      nextSortOrder: number | null | undefined
    ) =>
      setJobsState((current) =>
        sortJobsChronologically(
          current.map((job) =>
            job.id === jobId
              ? { ...job, scheduledDate: nextScheduledDate, sortOrder: nextSortOrder }
              : job
          )
        )
      );
    applySchedule(scheduledDate, sortOrder);
    if (editMode) {
      setPendingForJob(jobId, { scheduledDate, sortOrder });
      setJobModal(null);
      return;
    }
    const saved = await saveSingleUpdate(jobId, { scheduledDate, sortOrder });
    if (!saved) {
      if (previousJob) {
        applySchedule(previousJob.scheduledDate, previousJob.sortOrder);
      }
      return;
    }
    setJobModal(null);
  };

  const handleSaveChanges = async () => {
    const updates = Object.entries(pendingChanges).map(([jobId, patch]) => ({
      jobId,
      ...patch,
    }));
    if (updates.length === 0) {
      return true;
    }
    setErrorMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/routes/bulk-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        setErrorMessage(t("admin.routes.errors.saveFailed"));
        return false;
      }
      setPendingChanges({});
      showSaveSuccess();
      return true;
    } catch {
      setErrorMessage(t("admin.routes.errors.network"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleEditMode = async () => {
    if (editMode) {
      const ok = await handleSaveChanges();
      if (ok) {
        setEditMode(false);
        setSelectedDate(null);
        setDrafts([]);
        setActiveTechJobId(null);
        setSelectedJobId(null);
        setDraggingJobId(null);
        setDragOverTarget(null);
      }
      return;
    }
    setSaveSuccess(false);
    setEditMode(true);
  };

  useEffect(() => {
    if (!editMode || !selectedJobId || selectedDate || jobModal || saving) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        if (
          target.isContentEditable ||
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select"
        ) {
          return;
        }
      }
      event.preventDefault();
      void deleteJobById(selectedJobId);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMode, selectedJobId, selectedDate, jobModal, saving, deleteJobById]);

  const todayActive =
    rangeFilter === "CUSTOM" &&
    customStart === todayKey &&
    customEnd === todayKey;
  const urgentActive = priorityFilter === "URGENT";
  const unassignedActive = techFilter === "UNASSIGNED";
  const helperCopy = editMode
    ? t("admin.routes.helper.editMode")
    : t("admin.routes.helper.quickFilters");
  const summaryCards = [
    {
      key: "today",
      active: todayActive,
      label: t("admin.routes.labels.jobsToday"),
      value: summary.todayJobs,
      onClick: () => {
        if (todayActive) {
          setRangeFilter("WEEK");
          return;
        }
        setRangeFilter("CUSTOM");
        setCustomStart(todayKey);
        setCustomEnd(todayKey);
      },
      activeCardClass: "border-sky-200 bg-sky-50 text-sky-700",
      activeIconClass: "border-sky-200 bg-sky-500 text-white",
      idleIconClass: "border-sky-100 bg-sky-100 text-sky-600",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
        >
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M4 9h16" />
        </svg>
      ),
    },
    {
      key: "urgent",
      active: urgentActive,
      label: t("admin.routes.labels.urgent"),
      value: summary.urgent,
      onClick: () =>
        setPriorityFilter((current) => (current === "URGENT" ? "ALL" : "URGENT")),
      activeCardClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
      activeIconClass: "border-indigo-200 bg-indigo-500 text-white",
      idleIconClass: "border-indigo-100 bg-indigo-100 text-indigo-600",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
        >
          <path d="M12 4l8 14H4l8-14z" />
          <path d="M12 9v4m0 3h.01" />
        </svg>
      ),
    },
    {
      key: "unassigned",
      active: unassignedActive,
      label: t("jobs.detail.noTech"),
      value: summary.unassigned,
      onClick: () =>
        setTechFilter((current) => (current === "UNASSIGNED" ? "ALL" : "UNASSIGNED")),
      activeCardClass: "border-rose-200 bg-rose-50 text-rose-700",
      activeIconClass: "border-rose-200 bg-rose-500 text-white",
      idleIconClass: "border-rose-100 bg-rose-100 text-rose-600",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
        >
          <path d="M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          <path d="M5 19a7 7 0 0114 0" />
          <path d="M4 4l16 16" />
        </svg>
      ),
    },
  ] as const;

  return (
    <div className="space-y-6" onClick={() => setActiveTechJobId(null)}>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 sm:tracking-[0.22em]">
                {t("admin.routes.title")}
              </p>
              <p className="text-xs text-slate-500 sm:text-sm">{helperCopy}</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
              <RoutesSectionTabs />
              <div className="inline-flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 sm:h-10 sm:gap-2 sm:px-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:tracking-[0.14em]">
                  {nextMonthJobsLabel}
                </span>
                <span className="text-sm font-bold text-slate-900 sm:text-base">
                  {nextMonthJobsCount}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-1 sm:gap-1.5 sm:rounded-2xl sm:p-1.5">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-800 sm:h-9 sm:w-9"
                aria-label={t("admin.routes.calendar.previousMonth")}
                title={t("admin.routes.calendar.previousMonth")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 18l-6-6 6-6"
                  />
                </svg>
              </button>
              <h2 className="min-w-0 px-1 text-[clamp(1rem,4.3vw,1.45rem)] font-semibold leading-none text-slate-900 sm:px-2 sm:text-[clamp(1.35rem,4.4vw,2.1rem)]">
                {monthLabel}
              </h2>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-800 sm:h-9 sm:w-9"
                aria-label={t("admin.routes.calendar.nextMonth")}
                title={t("admin.routes.calendar.nextMonth")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 6l6 6-6 6"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={goToCurrentMonth}
                disabled={isCurrentMonthViewed}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-default disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300 sm:h-9 sm:px-3 sm:tracking-[0.14em]"
              >
                {t("admin.routes.actions.currentMonth")}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={techFilter}
                onChange={(event) => setTechFilter(event.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 focus:border-sky-300 focus:outline-none sm:h-10 sm:rounded-xl sm:px-3 sm:text-xs"
                aria-label={t("admin.routes.filters.technicianFilter")}
                title={t("admin.routes.filters.technicianFilter")}
              >
                <option value="ALL">{t("admin.routes.filters.allTechnicians")}</option>
                <option value="UNASSIGNED">{t("admin.routes.labels.unassigned")}</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={toggleEditMode}
                disabled={saving}
                className={`hidden h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition lg:inline-flex ${
                  editMode
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                } ${saving ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                    editMode
                      ? "border-white/30 bg-white text-slate-900"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                  }`}
                >
                  {saveSuccess ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 20h9M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z"
                      />
                    </svg>
                  )}
                </span>
                <span>
                  {editMode
                    ? t("common.actions.save")
                    : t("admin.routes.actions.editCalendar")}
                </span>
              </button>

              {editMode ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedJobId || saving) {
                      return;
                    }
                    void deleteJobById(selectedJobId);
                  }}
                  disabled={!selectedJobId || saving}
                  className="hidden h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 lg:inline-flex"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-600">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 7h12M9 7V5h6v2m-7 3v8m4-8v8m4-8v8M5 7l1 13h12l1-13"
                      />
                    </svg>
                  </span>
                  <span>{t("common.actions.delete")}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:mt-3 sm:gap-2">
          {summaryCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              className={`group flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-left transition sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2.5 ${
                card.active
                  ? card.activeCardClass
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`hidden h-8 w-8 items-center justify-center rounded-xl border text-[11px] sm:flex ${
                  card.active ? card.activeIconClass : card.idleIconClass
                }`}
              >
                {card.icon}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[11px] uppercase tracking-[0.08em] text-slate-400 sm:tracking-[0.16em]">
                  {card.label}
                </span>
                <span className="text-[13px] font-semibold text-slate-900 sm:text-sm">
                  {card.value}
                </span>
              </span>
            </button>
          ))}
        </div>
        {errorMessage ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"
          >
            {errorMessage}
          </div>
        ) : null}
        <div role="status" aria-live="polite" className="sr-only">
          {saveSuccess ? t("admin.routes.labels.saveSuccess") : ""}
        </div>

        <div className="mt-6 lg:hidden">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            <p className="text-[11px] text-slate-500">
              {editMode
                ? t("admin.routes.calendarMobile.editHelper")
                : t("admin.routes.calendarMobile.helper")}
            </p>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {daysShort.map((label) => (
                <div
                  key={`wd-${label}`}
                  className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const key = toDateKey(day);
                const isCurrentMonth = toMonthKey(day) === viewedMonthKey;
                const jobsForDay = sortJobsForDay(jobsByDate.get(key) ?? []);
                const jobsCount = jobsForDay.length;
                const isToday = key === todayKey;
                const isSelected = mobileDayKey === key;
                const capacityColor = getCapacityColor(jobsCount);
                const capacitySoft = getCapacitySoftColor(jobsCount);
                const itemTone = !isCurrentMonth
                  ? "border-transparent bg-transparent text-slate-300"
                  : isSelected
                    ? "text-slate-900 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700";

                return (
                  <button
                    key={`mobile-day-${key}`}
                    type="button"
                    aria-current={isToday ? "date" : undefined}
                    disabled={!isCurrentMonth}
                    onClick={() => {
                      setMobileDayKey(key);
                    }}
                    className={`relative h-12 overflow-hidden rounded-lg border px-1 py-1 text-center transition sm:h-14 ${
                      isCurrentMonth
                        ? "hover:border-sky-300 hover:bg-sky-50/60"
                        : "cursor-default"
                    } ${itemTone} ${isToday ? "ring-1 ring-sky-400" : ""}`}
                    style={
                      isCurrentMonth
                        ? {
                            borderColor: isSelected ? capacityColor : undefined,
                            backgroundColor: isSelected ? capacitySoft : undefined,
                          }
                        : undefined
                    }
                    title={
                      isCurrentMonth
                        ? t("admin.routes.labels.capacity", {
                            used: String(jobsCount),
                            total: String(dayCapacity),
                          })
                        : undefined
                    }
                  >
                    <span className="block text-sm font-semibold leading-none">
                      {getBusinessDayNumber(day)}
                    </span>
                    {isCurrentMonth ? (
                      <span
                        className="absolute right-1 top-1 inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: capacityColor }}
                      >
                        {jobsCount}
                      </span>
                    ) : null}
                    {isCurrentMonth ? (
                      <span
                        className="absolute bottom-1 left-1 right-1 h-1 rounded-full"
                        style={{ backgroundColor: capacityColor }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
              <span>{t("admin.routes.calendarMobile.loadLow")}</span>
              <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" />
              <span>{t("admin.routes.calendarMobile.loadHigh")}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 hidden overflow-x-auto pb-2 lg:block xl:overflow-visible">
          <div className="grid min-w-[980px] grid-cols-7 gap-1.5 xl:gap-2 2xl:min-w-0">
          {(() => {
            return calendarDays.map((day) => {
              const key = toDateKey(day);
              const isCurrentMonth = toMonthKey(day) === viewedMonthKey;
              const isPastDay = day < startOfToday;
              const jobsForDay = sortJobsForDay(jobsByDate.get(key) ?? []);
              const fillPct = Math.round((jobsForDay.length / dayCapacity) * 100);
              const fillWidth =
                jobsForDay.length === 0 ? 0 : Math.max(10, fillPct);
              const dayIndex = getBusinessWeekdayIndex(day);
              const dayLabel = daysShort[dayIndex];
              const isToday = key === todayKey;
              const dayTone = isCurrentMonth
                ? isPastDay
                  ? "border-sky-100 bg-sky-50/90 text-slate-600"
                  : "border-slate-200 bg-white text-slate-700"
                : "border-sky-100 bg-sky-50/70 text-slate-400";
              const dayHover = editMode
                ? "hover:border-sky-300 hover:bg-sky-50/60"
                : "";
              const dayA11yLabel = day.toLocaleDateString(locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: BUSINESS_TIMEZONE,
              });
              return (
                <div
                key={key}
                aria-current={isToday ? "date" : undefined}
                onClick={() => openModalForDate(day)}
                onDragOver={(event) => {
                    if (editMode) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (event.currentTarget === event.target) {
                        setDragOverTarget((current) =>
                          current?.dateKey === key && !current.jobId
                            ? current
                            : { dateKey: key }
                        );
                      }
                    }
                }}
                onDrop={(event) => {
                  if (!editMode) {
                    return;
                  }
                  const jobId = event.dataTransfer.getData("text/plain");
                  if (jobId) {
                    moveJobToDate(day, jobId);
                  }
                  setDraggingJobId(null);
                  setDragOverTarget(null);
                }}
                className={`group relative flex min-h-[180px] flex-col gap-2 rounded-2xl border px-2.5 py-2.5 text-[11px] transition xl:min-h-[220px] xl:gap-2.5 xl:rounded-[22px] xl:px-3 xl:py-3 xl:text-xs 2xl:min-h-[260px] ${dayTone} ${dayHover} ${
                  isToday ? "ring-1 ring-sky-400" : ""
                } ${editMode ? "cursor-pointer" : "cursor-default"}`}
              >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isCurrentMonth ? "text-slate-900" : "text-slate-400"
                        }`}
                      >
                        {getBusinessDayNumber(day)}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 xl:tracking-[0.28em]">
                        {dayLabel}
                      </span>
                      {editMode ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openModalForDate(day);
                          }}
                          className={FOCUS_ONLY_ACTION_CLASS}
                        >
                          {t("admin.routes.a11y.assignJobsOnDay", { date: dayA11yLabel })}
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {jobsForDay.length > 0 ? (
                        <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {t("admin.routes.labels.jobsCount", {
                            count: jobsForDay.length,
                          })}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">
                          {t("admin.routes.labels.free")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="h-1 w-full rounded-full bg-slate-200/70"
                    title={t("admin.routes.labels.capacity", {
                      used: String(jobsForDay.length),
                      total: String(dayCapacity),
                    })}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-500 transition"
                      style={{ width: `${fillWidth}%` }}
                    />
                  </div>
                  <div className="relative flex-1 space-y-2">
                  {draggingJobId &&
                  dragOverTarget?.dateKey === key &&
                  !dragOverTarget.jobId ? (
                    <div className="pointer-events-none absolute inset-1 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/40" />
                  ) : null}
                  {jobsForDay.map((job) => {
                    const isPlanEntry = job.entryKind === "plan";
                    const isHighlighted = highlightJobId === job.id;
                    const isSelected = !isPlanEntry && selectedJobId === job.id;
                    const isDropTarget =
                      !isPlanEntry &&
                      dragOverTarget?.jobId === job.id &&
                      draggingJobId !== job.id;
                    const dropPosition = dragOverTarget?.position;
                    const timeLabel = job.showScheduledTime
                      ? new Date(job.scheduledDate).toLocaleTimeString(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: BUSINESS_TIMEZONE,
                        })
                      : "";
                    const serviceOption = serviceTypeOptions.find(
                      (option) => option.value === job.serviceType
                    );
                    const serviceLabel = serviceOption?.labelKey
                      ? t(serviceOption.labelKey)
                      : serviceOption?.label ?? job.serviceType;
                    const tierLabel = job.serviceTierId
                      ? serviceTiersById.get(job.serviceTierId)?.name ?? null
                      : null;
                    const planLabel = getPlanDisplayName(job.planName);
                    const secondaryLabel = isPlanEntry
                      ? [planLabel, tierLabel ?? serviceLabel].filter(Boolean).join(" - ")
                      : `${tierLabel ? `${tierLabel} - ` : ""}${serviceLabel}`;
                    const techInfo = job.technicianId
                      ? techniciansById.get(job.technicianId)
                      : null;
                    const techColor = techInfo?.color ?? null;
                    const accentColor = techColor
                      ? techColor
                      : !job.technicianId
                        ? "#fb7185"
                        : job.status === "COMPLETED"
                          ? "#34d399"
                          : job.priority === "URGENT"
                            ? "#f59e0b"
                            : "#38bdf8";
                    const cardTone =
                      job.priority === "URGENT"
                        ? "border-indigo-200 bg-indigo-50 text-indigo-900"
                        : job.status === "COMPLETED"
                          ? "border-teal-200 bg-teal-50 text-teal-900"
                          : "border-slate-200 bg-white text-slate-700";
                    const techTone = !job.technicianId
                      ? "text-rose-600 hover:text-rose-700"
                      : "text-slate-600 hover:text-slate-900";
                    const techDotStyle =
                      job.technicianId && techColor
                        ? { backgroundColor: techColor }
                        : { backgroundColor: "#fb7185" };
                    const techName = job.technician?.name ?? t("jobs.detail.noTech");
                    // Clientes con varias propiedades: el nombre de la propiedad va en su
                    // propia línea, porque en la tarjeta compacta el título se trunca.
                    const propertyDisplayName = job.property.name?.trim() || null;
                    const cardTitle = formatJobTitle(job.customer.name, job.property);
                    const cardLabel = [cardTitle, timeLabel, techName]
                      .filter(Boolean)
                      .join(", ");
                    const activateCard = () => {
                      if (isPlanEntry) {
                        return;
                      }
                      if (editMode) {
                        setSelectedJobId((current) =>
                          current === job.id ? null : job.id
                        );
                        return;
                      }
                      openJobModal(job as JobItem);
                    };
                    return (
                      <div
                        key={job.id}
                        role={isPlanEntry ? undefined : "button"}
                        tabIndex={isPlanEntry ? undefined : 0}
                        aria-label={isPlanEntry ? undefined : cardLabel}
                        aria-pressed={!isPlanEntry && editMode ? isSelected : undefined}
                        onKeyDown={(event) => {
                          if (
                            isPlanEntry ||
                            event.target !== event.currentTarget ||
                            (event.key !== "Enter" && event.key !== " ")
                          ) {
                            return;
                          }
                          event.preventDefault();
                          activateCard();
                        }}
                        draggable={editMode && !isPlanEntry}
                        onDragStart={(event) => {
                          if (isPlanEntry) {
                            return;
                          }
                          event.dataTransfer.setData("text/plain", job.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingJobId(job.id);
                        }}
                        onDragEnd={() => {
                          setDraggingJobId(null);
                          setDragOverTarget(null);
                        }}
                        onDragOver={(event) => {
                          if (!editMode || isPlanEntry || job.id === draggingJobId) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          const position =
                            event.clientY < rect.top + rect.height / 2
                              ? "before"
                              : "after";
                          setDragOverTarget((current) => {
                            if (
                              current?.dateKey === key &&
                              current?.jobId === job.id &&
                              current?.position === position
                            ) {
                              return current;
                            }
                            return { dateKey: key, jobId: job.id, position };
                          });
                        }}
                        onDrop={(event) => {
                          if (!editMode || isPlanEntry) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          const draggedId =
                            event.dataTransfer.getData("text/plain");
                          if (draggedId) {
                            moveJobToDate(day, draggedId);
                          }
                          setDraggingJobId(null);
                          setDragOverTarget(null);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          activateCard();
                        }}
                        className={`relative block rounded-2xl border px-2.5 py-2.5 text-[11px] transition xl:px-3 xl:py-3 ${
                          isPlanEntry
                            ? "cursor-default"
                            : editMode
                              ? "cursor-move"
                              : "cursor-pointer"
                        } ${isSelected ? "ring-2 ring-rose-400" : isHighlighted ? "ring-2 ring-sky-400" : ""} ${
                          isDropTarget
                            ? "outline outline-2 outline-sky-300 outline-offset-2"
                            : ""
                        } ${cardTone} ${
                          draggingJobId === job.id
                            ? "opacity-50"
                            : "hover:border-sky-200 hover:bg-sky-50/70"
                        } ${job.status === "COMPLETED" ? "opacity-60" : ""}`}
                      >
                        {isDropTarget ? (
                          <span
                            className={`pointer-events-none absolute left-3 right-3 h-0.5 rounded-full bg-sky-300 ${
                              dropPosition === "after" ? "bottom-1" : "top-1"
                            }`}
                          />
                        ) : null}
                        <span
                          className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl"
                          style={{ backgroundColor: accentColor }}
                        />
                        {editMode && !isPlanEntry ? (
                          <button
                            type="button"
                            draggable={false}
                            onClick={(event) => {
                              event.stopPropagation();
                              openJobModal(job as JobItem);
                            }}
                            className={FOCUS_ONLY_ACTION_CLASS}
                          >
                            {t("admin.routes.move.open", { customer: job.customer.name })}
                          </button>
                        ) : null}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div
                              className="truncate text-[11px] font-semibold text-slate-800 xl:text-[12px]"
                              title={cardTitle}
                            >
                              {job.customer.name}
                            </div>
                            {propertyDisplayName ? (
                              <div
                                className="truncate text-[11px] font-semibold text-sky-800"
                                title={propertyDisplayName}
                              >
                                {propertyDisplayName}
                              </div>
                            ) : null}
                            <div className="text-[11px] text-slate-500">
                              {secondaryLabel}
                            </div>
                          </div>
                          {timeLabel ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                              title={t("admin.routes.labels.scheduledTime")}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                className="h-2.5 w-2.5"
                              >
                                <circle cx="12" cy="12" r="8" />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 7.5V12l3 2"
                                />
                              </svg>
                              {timeLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            className="h-3 w-3"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"
                            />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              job.property.address
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            draggable={false}
                            onClick={(event) => event.stopPropagation()}
                            className="truncate font-medium text-slate-600 transition hover:text-slate-900"
                            title={job.property.address}
                          >
                            {job.property.address}
                          </a>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              {isPlanEntry
                                ? planLabel || t("jobs.type.recurring")
                                : job.type === "ON_DEMAND"
                                  ? t("jobs.type.onDemand")
                                  : t("jobs.type.routine")}
                            </span>
                            {!isPlanEntry && job.priority === "URGENT" ? (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                {t("jobs.priority.urgent")}
                              </span>
                            ) : null}
                          </div>
                          {isPlanEntry ? (
                            <span className="inline-flex max-w-[120px] items-center gap-1 overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={techDotStyle}
                              />
                              <span className="truncate whitespace-nowrap">
                                {job.technician?.name ?? t("jobs.detail.noTech")}
                              </span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveTechJobId(job.id);
                              }}
                              className={`inline-flex max-w-[120px] items-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-[11px] font-semibold transition ${techTone} hover:border-slate-300 hover:bg-slate-50 hover:ring-2 hover:ring-sky-100`}
                              title={
                                editMode
                                  ? t("admin.routes.actions.assignTechnician")
                                  : t("admin.routes.labels.enableEditToAssign")
                              }
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={techDotStyle}
                              />
                              <span className="truncate whitespace-nowrap">
                                {job.technician?.name ?? t("jobs.detail.noTech")}
                              </span>
                            </button>
                          )}
                        </div>
                        {!isPlanEntry && activeTechJobId === job.id ? (
                          <div
                            className="mt-2 rounded-lg border border-slate-200 bg-white p-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <select
                              aria-label={t("admin.routes.actions.assignTechnician")}
                              value={job.technicianId ?? ""}
                              onChange={(event) =>
                                handleTechnicianAssign(job.id, event.target.value)
                              }
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px]"
                            >
                              <option value="">
                                {t("admin.routes.labels.unassigned")}
                              </option>
                              {technicians.map((tech) => (
                                <option key={tech.id} value={tech.id}>
                                  {tech.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {editMode && jobsForDay.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-3 py-3 text-[11px] text-slate-500">
                      {t("admin.routes.labels.dropHint")}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          });
        })()}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {t("admin.routes.sections.scheduledJobs")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("admin.routes.labels.rangeCount", {
                range: rangeLabel,
                count: filteredRangeJobs.length,
              })}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            {activeFiltersCount > 0 ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                {t("admin.routes.filters.activeCount", {
                  count: activeFiltersCount,
                })}
              </span>
            ) : null}
            <button
              type="button"
              onClick={openFiltersModal}
              className="app-button-ghost inline-flex h-9 w-9 items-center justify-center rounded-full p-0"
              aria-label={t("admin.routes.filters.open")}
              title={t("admin.routes.filters.open")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              <span className="sr-only">{t("admin.routes.filters.open")}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {filteredRangeJobs.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              {t("admin.routes.labels.noJobsInRange")}
            </div>
          ) : (
            <>
              <div className="space-y-3 p-3 lg:hidden">
                {sortedRangeJobs.map((job) => {
                  const serviceOption = serviceTypeOptions.find(
                    (option) => option.value === job.serviceType
                  );
                  const serviceLabel = serviceOption?.labelKey
                    ? t(serviceOption.labelKey)
                    : serviceOption?.label ?? job.serviceType;
                  const tierLabel = job.serviceTierId
                    ? serviceTiersById.get(job.serviceTierId)?.name ?? null
                    : null;
                  const isHighlighted = highlightJobId === job.id;
                  const isSelected = selectedJobId === job.id;
                  const scheduled = new Date(job.scheduledDate);
                  const dateLabel = scheduled.toLocaleDateString(locale, {
                    day: "2-digit",
                    month: "short",
                    timeZone: BUSINESS_TIMEZONE,
                  });
                  const timeLabel = job.showScheduledTime
                    ? scheduled.toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: BUSINESS_TIMEZONE,
                      })
                    : "";
                  const propertyName = formatPropertyLabel(
                    job.property,
                    t("admin.routes.labels.propertyFallback")
                  );
                  const statusInfo =
                    statusMeta[job.status] ??
                    ({
                      label: job.status,
                      className: "border-slate-200 bg-slate-50 text-slate-600",
                    } as const);
                  const priorityInfo =
                    priorityMeta[job.priority] ??
                    ({
                      label: job.priority,
                      className: "border-slate-200 bg-slate-50 text-slate-600",
                    } as const);
                  const techInfo = job.technicianId
                    ? techniciansById.get(job.technicianId)
                    : null;
                  const techColor = techInfo?.color ?? null;
                  const techDotStyle = techColor
                    ? { backgroundColor: techColor }
                    : { backgroundColor: job.technicianId ? "#64748b" : "#fb7185" };
                  const contactPhone = job.customer.phone
                    ? formatUsPhone(job.customer.phone) ?? job.customer.phone
                    : null;
                  const contactLine = [job.customer.email, contactPhone]
                    .filter(Boolean)
                    .join(" / ");

                  return (
                    <article
                      key={`mobile-${job.id}`}
                      onClick={() => {
                        if (!editMode) {
                          return;
                        }
                        setSelectedJobId((current) =>
                          current === job.id ? null : job.id
                        );
                      }}
                      className={`rounded-2xl border p-3 transition ${
                        isSelected
                          ? "border-rose-200 bg-rose-50/70"
                          : isHighlighted
                            ? "border-sky-200 bg-sky-50/70"
                            : "border-slate-200 bg-white"
                      } ${job.status === "COMPLETED" ? "opacity-70" : ""} ${
                        editMode ? "cursor-pointer" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={techDotStyle} />
                            <p className="truncate text-sm font-semibold leading-tight text-slate-900">
                              {job.customer.name}
                            </p>
                          </div>
                          {contactLine ? (
                            <p className="truncate text-[11px] text-slate-500" title={contactLine}>
                              {contactLine}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400">
                              {t("admin.routes.labels.noContact")}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold leading-tight text-slate-900">
                            {dateLabel}
                          </p>
                          {timeLabel ? (
                            <p className="text-[11px] text-slate-500">{timeLabel}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight text-slate-900">
                          {propertyName}
                          <span className="mx-1 text-slate-300">|</span>
                          <span className="font-medium text-slate-700">{serviceLabel}</span>
                        </p>
                        {tierLabel ? (
                          <p className="truncate text-[11px] text-slate-500">{tierLabel}</p>
                        ) : null}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            job.property.address
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500 hover:text-slate-700"
                          title={job.property.address}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-3 w-3 shrink-0 text-slate-400"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"
                            />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                          <span className="truncate">{job.property.address}</span>
                        </a>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityInfo.className}`}
                        >
                          {priorityInfo.label}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {job.type === "ON_DEMAND"
                            ? t("jobs.type.onDemand")
                            : t("jobs.type.routine")}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-600">
                          <span className="h-2 w-2 rounded-full" style={techDotStyle} />
                          <span className="max-w-[108px] truncate font-medium">
                            {techInfo?.name ??
                              job.technician?.name ??
                              t("jobs.detail.noTech")}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openJobModal(job);
                          }}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          {t("common.actions.view")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="ui-table-shell hidden max-h-[520px] overflow-hidden lg:block">
              <div className="customers-table-scroll h-full overflow-auto">
              <table
                className={`customers-table min-w-[1120px] w-full text-left ${tableTextSize}`}
              >
                <thead className="sticky top-0 z-10 border-b border-slate-800/40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 backdrop-blur">
                  <tr>
                    <th className={`${cellPadding} w-[20%]`}>
                      {renderSortButton(t("admin.routes.table.customer"), "customer", "dark")}
                    </th>
                    <th className={`${cellPadding} w-[22%]`}>
                      {renderSortButton(t("admin.routes.table.property"), "address", "dark")}
                    </th>
                    <th className={`${cellPadding} w-[14%]`}>
                      {renderSortButton(t("admin.routes.table.dateTime"), "date", "dark")}
                    </th>
                    <th className={`${cellPadding} w-[16%]`}>
                      {renderSortButton(t("admin.routes.table.service"), "service", "dark")}
                    </th>
                    <th className={`${cellPadding} w-[10%]`}>
                      {renderSortButton(t("admin.routes.table.status"), "status", "dark")}
                    </th>
                    <th className={`${cellPadding} w-[10%]`}>
                      {renderSortButton(t("admin.routes.table.priority"), "priority", "dark")}
                    </th>
                    <th className={`${cellPadding} w-[14%]`}>
                      {renderSortButton(t("admin.routes.table.technician"), "technician", "dark")}
                    </th>
                    <th className={`${cellPadding} w-[8%] text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-100/80`}>
                      {t("admin.routes.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRangeJobs.map((job) => {
                    const serviceOption = serviceTypeOptions.find(
                      (option) => option.value === job.serviceType
                    );
                    const serviceLabel = serviceOption?.labelKey
                      ? t(serviceOption.labelKey)
                      : serviceOption?.label ?? job.serviceType;
                    const tierLabel = job.serviceTierId
                      ? serviceTiersById.get(job.serviceTierId)?.name ?? null
                      : null;
                    const isHighlighted = highlightJobId === job.id;
                    const isSelected = selectedJobId === job.id;
                    const scheduled = new Date(job.scheduledDate);
                    const dateLabel = scheduled.toLocaleDateString(locale, {
                      day: "2-digit",
                      month: "short",
                      timeZone: BUSINESS_TIMEZONE,
                    });
                    const timeLabel = job.showScheduledTime
                      ? scheduled.toLocaleTimeString(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: BUSINESS_TIMEZONE,
                        })
                      : "";
                    const propertyName = formatPropertyLabel(
                      job.property,
                      t("admin.routes.labels.propertyFallback")
                    );
                    const statusInfo =
                      statusMeta[job.status] ??
                      ({
                        label: job.status,
                        className: "border-slate-200 bg-slate-50 text-slate-600",
                      } as const);
                    const priorityInfo =
                      priorityMeta[job.priority] ??
                      ({
                        label: job.priority,
                        className: "border-slate-200 bg-slate-50 text-slate-600",
                      } as const);
                    const techInfo = job.technicianId
                      ? techniciansById.get(job.technicianId)
                      : null;
                    const techColor = techInfo?.color ?? null;
                    const techDotStyle = techColor
                      ? { backgroundColor: techColor }
                      : { backgroundColor: job.technicianId ? "#64748b" : "#fb7185" };
                    const contactPhone = job.customer.phone
                      ? formatUsPhone(job.customer.phone) ?? job.customer.phone
                      : null;
                    const contactLine = [job.customer.email, contactPhone]
                      .filter(Boolean)
                      .join(" / ");

                    return (
                      <tr
                        key={job.id}
                        onClick={() => {
                          if (!editMode) {
                            return;
                          }
                          setSelectedJobId((current) =>
                            current === job.id ? null : job.id
                          );
                        }}
                        className={`group text-slate-700 transition ${
                          isSelected
                            ? "bg-rose-50/70"
                            : isHighlighted
                              ? "bg-sky-50/70"
                              : "bg-white"
                        } hover:bg-slate-50 ${
                          job.status === "COMPLETED" ? "opacity-60" : ""
                        } ${editMode ? "cursor-pointer" : ""}`}
                      >
                        <td className={`${cellPadding} align-top`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={techDotStyle}
                              />
                              <span
                                className="max-w-[180px] truncate font-semibold text-slate-900"
                                title={job.customer.name}
                              >
                                {job.customer.name}
                              </span>
                            </div>
                            {contactLine ? (
                              <div
                                className="max-w-[200px] truncate text-[11px] text-slate-500"
                                title={contactLine}
                              >
                                {contactLine}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400">
                                {t("admin.routes.labels.noContact")}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <div className="space-y-1">
                            <div
                              className="max-w-[220px] truncate font-semibold text-slate-900"
                              title={propertyName}
                            >
                              {propertyName}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                className="h-3 w-3 text-slate-400"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"
                                />
                                <circle cx="12" cy="10" r="2.5" />
                              </svg>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                  job.property.address
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="max-w-[240px] truncate font-medium text-slate-600 transition hover:text-slate-900"
                                title={job.property.address}
                              >
                                {job.property.address}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <div className="space-y-1 text-slate-600">
                            <div className="font-semibold text-slate-900">
                              {dateLabel}
                            </div>
                            {timeLabel ? (
                              <div className="text-[11px]">{timeLabel}</div>
                            ) : null}
                          </div>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-900">
                              {serviceLabel}
                            </div>
                            {tierLabel ? (
                              <div className="text-[11px] text-slate-400">
                                {tierLabel}
                              </div>
                            ) : null}
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              {job.type === "ON_DEMAND"
                                ? t("jobs.type.onDemand")
                                : t("jobs.type.routine")}
                            </span>
                          </div>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityInfo.className}`}
                          >
                            {priorityInfo.label}
                          </span>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <div className="flex items-center gap-2 text-slate-600">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={techDotStyle}
                            />
                            <span
                              className="max-w-[140px] truncate font-semibold"
                              title={techInfo?.name ?? job.technician?.name ?? t("jobs.detail.noTech")}
                            >
                              {techInfo?.name ??
                                job.technician?.name ??
                                t("jobs.detail.noTech")}
                            </span>
                          </div>
                        </td>
                        <td className={`${cellPadding} align-top text-right`}>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openJobModal(job);
                            }}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            {t("common.actions.view")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
            </>
          )}
        </div>
      </section>

      <AppModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        titleId={filtersTitleId}
        zIndexClass="z-[1295]"
        layerClassName="bg-slate-900/50 p-3 sm:p-6"
        backdropClassName=""
        cardClassName="max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {t("admin.routes.filters.toolbar")}
                      </p>
                      <h2 id={filtersTitleId} className="text-lg font-semibold text-slate-900">
                        {t("admin.routes.filters.modalTitle")}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {t("admin.routes.filters.modalSubtitle")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                      aria-label={t("common.actions.close")}
                      title={t("common.actions.close")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="max-h-[75vh] overflow-y-auto px-4 py-4 sm:px-6">
                  <div className="space-y-5">
                    <section>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t("admin.routes.filters.searchLabel")}
                      </label>
                      <div className="mt-2 ui-search flex items-center gap-1.5 px-2 py-1.5">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          className="ui-search-icon h-4 w-4"
                        >
                          <circle cx="11" cy="11" r="7" />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20 20l-3-3"
                          />
                        </svg>
                        <input
                          value={filtersDraft.searchFilter}
                          onChange={(event) =>
                            setFiltersDraft((current) => ({
                              ...current,
                              searchFilter: event.target.value,
                            }))
                          }
                          placeholder={t("admin.routes.filters.search")}
                          className="ui-search-input w-full"
                        />
                      </div>
                    </section>

                    <section>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t("admin.routes.filters.range")}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            {
                              value: "WEEK",
                              label: t("admin.routes.filters.rangeWeek"),
                            },
                            {
                              value: "MONTH",
                              label: t("admin.routes.filters.rangeMonth"),
                            },
                            {
                              value: "CUSTOM",
                              label: t("admin.routes.filters.rangeCustom"),
                            },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() =>
                              setFiltersDraft((current) => ({
                                ...current,
                                rangeFilter: item.value,
                              }))
                            }
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                              filtersDraft.rangeFilter === item.value
                                ? "border-sky-300 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </section>

                    {filtersDraft.rangeFilter === "CUSTOM" ? (
                      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {t("admin.routes.filters.dateRange")}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-slate-600">
                            {t("admin.routes.filters.from")}
                            <input
                              type="date"
                              value={filtersDraft.customStart}
                              onChange={(event) =>
                                setFiltersDraft((current) => ({
                                  ...current,
                                  customStart: event.target.value,
                                }))
                              }
                              className="app-input mt-1 w-full px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            {t("admin.routes.filters.to")}
                            <input
                              type="date"
                              value={filtersDraft.customEnd}
                              onChange={(event) =>
                                setFiltersDraft((current) => ({
                                  ...current,
                                  customEnd: event.target.value,
                                }))
                              }
                              className="app-input mt-1 w-full px-3 py-2 text-sm"
                            />
                          </label>
                        </div>
                      </section>
                    ) : null}

                    <section className="grid gap-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold text-slate-600">
                        {t("admin.routes.table.status")}
                        <select
                          value={filtersDraft.statusFilter}
                          onChange={(event) =>
                            setFiltersDraft((current) => ({
                              ...current,
                              statusFilter: event.target.value,
                            }))
                          }
                          className="app-input mt-1 w-full px-3 py-2 text-sm"
                        >
                          <option value="ALL">{t("admin.routes.filters.statusAll")}</option>
                          <option value="SCHEDULED">{t("jobs.status.scheduled")}</option>
                          <option value="PENDING">{t("jobs.status.pending")}</option>
                          <option value="ON_THE_WAY">{t("jobs.status.onTheWay")}</option>
                          <option value="IN_PROGRESS">{t("jobs.status.inProgress")}</option>
                          <option value="COMPLETED">{t("jobs.status.completed")}</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        {t("admin.routes.table.technician")}
                        <select
                          value={filtersDraft.techFilter}
                          onChange={(event) =>
                            setFiltersDraft((current) => ({
                              ...current,
                              techFilter: event.target.value,
                            }))
                          }
                          className="app-input mt-1 w-full px-3 py-2 text-sm"
                        >
                          <option value="ALL">{t("admin.routes.filters.techAll")}</option>
                          <option value="UNASSIGNED">{t("jobs.detail.noTech")}</option>
                          {technicians.map((tech) => (
                            <option key={tech.id} value={tech.id}>
                              {tech.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        {t("admin.routes.table.priority")}
                        <select
                          value={filtersDraft.priorityFilter}
                          onChange={(event) =>
                            setFiltersDraft((current) => ({
                              ...current,
                              priorityFilter: event.target.value,
                            }))
                          }
                          className="app-input mt-1 w-full px-3 py-2 text-sm"
                        >
                          <option value="ALL">{t("admin.routes.filters.priorityAll")}</option>
                          <option value="NORMAL">{t("jobs.priority.normal")}</option>
                          <option value="URGENT">{t("jobs.priority.urgent")}</option>
                        </select>
                      </label>
                    </section>

                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <button
                    type="button"
                    onClick={resetScheduledFilters}
                    className="app-button-ghost w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] sm:w-auto"
                  >
                    {t("admin.routes.filters.reset")}
                  </button>
                  <button
                    type="button"
                    onClick={applyScheduledFilters}
                    className="app-button-primary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] sm:w-auto"
                  >
                    {t("admin.routes.filters.apply")}
                  </button>
                </div>
      </AppModal>

      {mobileDayKey ? (
        <AppModal
          open
          onClose={() => setMobileDayKey(null)}
          titleId={`${mobileDayKickerId} ${mobileDayTitleId}`}
          zIndexClass="z-[1298]"
          layerClassName="bg-slate-900/50 p-3 sm:p-6"
          backdropClassName=""
          cardClassName="max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p id={mobileDayKickerId} className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {t("admin.routes.sections.scheduledJobs")}
                      </p>
                      <h2 id={mobileDayTitleId} className="text-lg font-semibold text-slate-900">
                        {mobileDayDate
                          ? mobileDayDate.toLocaleDateString(locale, {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              timeZone: BUSINESS_TIMEZONE,
                            })
                          : mobileDayKey}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {t("admin.routes.labels.capacity", {
                          used: String(mobileDayJobs.length),
                          total: String(dayCapacity),
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleEditMode()}
                        disabled={saving}
                        className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                          editMode
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        } ${saving ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        {editMode
                          ? saving
                            ? t("admin.routes.actions.saving")
                            : t("admin.routes.actions.saveChanges")
                          : t("admin.routes.actions.editCalendar")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileDayKey(null)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                        aria-label={t("common.actions.close")}
                        title={t("common.actions.close")}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-4 w-4"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-[72vh] overflow-y-auto px-4 py-4 sm:px-6">
                  {errorMessage ? (
                    <p
                      role="alert"
                      className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"
                    >
                      {errorMessage}
                    </p>
                  ) : null}
                  {mobileDayJobs.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      {t("admin.routes.calendarMobile.empty")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mobileDayJobs.map((job) => {
                        const isPlanEntry = job.entryKind === "plan";
                        const serviceOption = serviceTypeOptions.find(
                          (option) => option.value === job.serviceType
                        );
                        const serviceLabel = serviceOption?.labelKey
                          ? t(serviceOption.labelKey)
                          : serviceOption?.label ?? job.serviceType;
                        const tierLabel = job.serviceTierId
                          ? serviceTiersById.get(job.serviceTierId)?.name ?? null
                          : null;
                        const timeLabel = job.showScheduledTime
                          ? new Date(job.scheduledDate).toLocaleTimeString(locale, {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: BUSINESS_TIMEZONE,
                            })
                          : "";
                        const planLabel = getPlanDisplayName(job.planName);
                        const statusInfo =
                          statusMeta[job.status] ??
                          ({
                            label: job.status,
                            className: "border-slate-200 bg-slate-50 text-slate-600",
                          } as const);
                        const priorityInfo =
                          priorityMeta[job.priority] ??
                          ({
                            label: job.priority,
                            className: "border-slate-200 bg-slate-50 text-slate-600",
                          } as const);

                        return editMode && !isPlanEntry ? (
                          <div
                            key={`mobile-day-job-${job.id}`}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {formatJobTitle(job.customer.name, job.property)}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {job.property.address}
                                </p>
                              </div>
                              {timeLabel ? (
                                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                  {timeLabel}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs text-slate-600">
                              {tierLabel ? `${tierLabel} - ` : ""}
                              {serviceLabel}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}
                              >
                                {statusInfo.label}
                              </span>
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityInfo.className}`}
                              >
                                {priorityInfo.label}
                              </span>
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {job.type === "ON_DEMAND"
                                  ? t("jobs.type.onDemand")
                                  : t("jobs.type.routine")}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <label>
                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {t("admin.routes.labels.date")}
                                </span>
                                <input
                                  type="date"
                                  value={toDateKey(new Date(job.scheduledDate))}
                                  onChange={(event) => {
                                    const nextDate = parseBusinessDateInput(event.target.value);
                                    if (!nextDate) {
                                      return;
                                    }
                                    moveJobToDate(nextDate, job.id);
                                  }}
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                                />
                              </label>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  if (mobileDeleteConfirmId === job.id) {
                                    setMobileDeleteConfirmId(null);
                                    void deleteJobById(job.id);
                                    return;
                                  }
                                  setMobileDeleteConfirmId(job.id);
                                }}
                                className="inline-flex h-10 items-center justify-center self-end rounded-xl border border-rose-200 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                              >
                                {mobileDeleteConfirmId === job.id
                                  ? t("notifications.deleteConfirm")
                                  : t("common.actions.delete")}
                              </button>
                            </div>
                          </div>
                        ) : isPlanEntry ? (
                          <div
                            key={`mobile-day-plan-${job.id}`}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {formatJobTitle(job.customer.name, job.property)}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {job.property.address}
                                </p>
                              </div>
                              {timeLabel ? (
                                <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                  {timeLabel}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs text-slate-600">
                              {[planLabel, tierLabel ?? serviceLabel]
                                .filter(Boolean)
                                .join(" - ")}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}
                              >
                                {statusInfo.label}
                              </span>
                              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {planLabel || t("jobs.type.recurring")}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            key={`mobile-day-job-${job.id}`}
                            type="button"
                            onClick={() => {
                              setMobileDayKey(null);
                              openJobModal(job as JobItem);
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/30"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {formatJobTitle(job.customer.name, job.property)}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {job.property.address}
                                </p>
                              </div>
                              {timeLabel ? (
                                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                  {timeLabel}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs text-slate-600">
                              {tierLabel ? `${tierLabel} - ` : ""}
                              {serviceLabel}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}
                              >
                                {statusInfo.label}
                              </span>
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityInfo.className}`}
                              >
                                {priorityInfo.label}
                              </span>
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {job.type === "ON_DEMAND"
                                  ? t("jobs.type.onDemand")
                                  : t("jobs.type.routine")}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-start sm:px-6">
                  {editMode && mobileDayDate ? (
                    <button
                      type="button"
                      onClick={() => {
                        const targetDate = mobileDayDate;
                        setMobileDayKey(null);
                        openModalForDate(targetDate);
                      }}
                      className="app-button-secondary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] sm:w-auto"
                    >
                      {t("admin.routes.actions.assignJobs")}
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
        </AppModal>
      ) : null}

      {selectedDate ? (
        <AppModal
          open
          onClose={() => setSelectedDate(null)}
          titleId={`${assignKickerId} ${assignTitleId}`}
          zIndexClass="z-[1300]"
          layerClassName="overflow-y-auto p-0 sm:p-6"
          cardClassName="max-w-5xl self-end overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:self-center sm:rounded-3xl"
          closeOnBackdrop={false}
        >
            <div className="app-modal-scroll modal-scroll max-h-[82dvh] overflow-y-auto p-5 pr-4 sm:max-h-[90dvh] sm:p-6 sm:pr-5">
              <div className="app-modal-header flex items-start justify-between gap-3">
                <div>
                  <p id={assignKickerId} className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {t("admin.routes.actions.assignJobs")}
                  </p>
                  <h2 id={assignTitleId} className="text-lg font-semibold">
                    {(parseBusinessDateInput(selectedDate) ?? new Date(selectedDate)).toLocaleDateString(
                      locale,
                      { timeZone: BUSINESS_TIMEZONE }
                    )}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="app-modal-close"
                  aria-label={t("common.actions.close")}
                  title={t("common.actions.close")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {drafts.map((draft, index) => {
                  const customer = customers.find(
                    (item) => item.id === draft.customerId
                  );
                  const properties = customer?.properties ?? [];
                  return (
                    <div
                      key={draft.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">
                          {t("admin.routes.labels.jobNumber", {
                            count: index + 1,
                          })}
                        </p>
                        {drafts.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeDraft(draft.id)}
                            className="text-xs text-slate-500"
                          >
                            {t("common.actions.delete")}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`${draft.id}-customer`}
                            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {t("admin.routes.labels.customer")}
                          </label>
                          <select
                            id={`${draft.id}-customer`}
                            value={draft.customerId}
                            onChange={(event) =>
                              handleCustomerChange(draft.id, event.target.value)
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          >
                            {customers.map((customerItem) => (
                              <option
                                key={customerItem.id}
                                value={customerItem.id}
                              >
                                {customerItem.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor={`${draft.id}-property`}
                            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {t("admin.routes.labels.property")}
                          </label>
                          <select
                            id={`${draft.id}-property`}
                            value={draft.propertyId}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                propertyId: event.target.value,
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          >
                            {properties.length === 0 ? (
                              <option value="">
                                {t("admin.routes.labels.noProperties")}
                              </option>
                            ) : (
                              properties.map((property) => (
                                <option key={property.id} value={property.id}>
                                  {property.address}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <label
                            htmlFor={`${draft.id}-time`}
                            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {t("admin.routes.labels.time")}
                          </label>
                          <input
                            id={`${draft.id}-time`}
                            value={draft.scheduledTime}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                scheduledTime: event.target.value,
                              })
                            }
                            type="time"
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`${draft.id}-technician`}
                            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {t("jobs.detail.fields.tech")}
                          </label>
                          <select
                            id={`${draft.id}-technician`}
                            value={draft.technicianId}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                technicianId: event.target.value,
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          >
                            <option value="">
                              {t("admin.routes.labels.unassigned")}
                            </option>
                            {technicians.map((tech) => (
                              <option key={tech.id} value={tech.id}>
                                {tech.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor={`${draft.id}-priority`}
                            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {t("jobs.detail.fields.priority")}
                          </label>
                          <select
                            id={`${draft.id}-priority`}
                            value={draft.priority}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                priority: event.target.value,
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          >
                            <option value="NORMAL">
                              {t("jobs.priority.normal")}
                            </option>
                            <option value="URGENT">{t("jobs.priority.urgent")}</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <label
                            htmlFor={`${draft.id}-service-tier`}
                            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {t("jobs.detail.fields.serviceTier")}
                          </label>
                          <select
                            id={`${draft.id}-service-tier`}
                            value={draft.serviceTierId}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                serviceTierId: event.target.value,
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          >
                            {tierOptions.map((tier) => (
                              <option key={tier.id} value={tier.id}>
                                {tier.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor={`${draft.id}-service-type`}
                            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {t("jobs.detail.fields.serviceType")}
                          </label>
                          <select
                            id={`${draft.id}-service-type`}
                            value={draft.serviceType}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                serviceType: event.target.value,
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          >
                            {serviceTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.labelKey ? t(option.labelKey) : option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor={`${draft.id}-duration`}
                            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {t("admin.routes.labels.durationMinutes")}
                          </label>
                          <input
                            id={`${draft.id}-duration`}
                            value={draft.estimatedDuration}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                estimatedDuration: event.target.value,
                              })
                            }
                            type="number"
                            min="0"
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label
                          htmlFor={`${draft.id}-notes`}
                          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                        >
                          {t("common.labels.notes")}
                        </label>
                        <textarea
                          id={`${draft.id}-notes`}
                          value={draft.notes}
                          onChange={(event) =>
                            updateDraft(draft.id, { notes: event.target.value })
                          }
                          className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {errorMessage ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"
                >
                  {errorMessage}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={addDraft}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600"
                >
                  {t("admin.routes.actions.addJob")}
                </button>
                <button
                  type="button"
                  onClick={handleCreateJobs}
                  disabled={creating}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  {creating
                    ? t("admin.routes.actions.creating")
                    : t("admin.routes.actions.saveJobs")}
                </button>
              </div>
            </div>
        </AppModal>
      ) : null}

      {jobModal ? (
        <AppModal
          open
          onClose={() => setJobModal(null)}
          titleId={`${jobDetailKickerId} ${jobDetailTitleId}`}
          zIndexClass="z-[1310]"
          layerClassName="overflow-y-auto bg-slate-900/60 px-0 py-0 sm:px-6 sm:py-10"
          backdropClassName=""
          cardClassName="flex max-h-[88dvh] max-w-4xl flex-col self-end overflow-hidden rounded-t-3xl border border-slate-200 bg-white sm:my-auto sm:max-h-[90dvh] sm:self-start sm:rounded-3xl"
        >
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="relative shrink-0 border-b border-slate-800/60 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-5 sm:px-6">
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.25),_transparent_45%)]" />
                      <div className="relative flex items-start justify-between gap-3 text-white">
                        <div className="min-w-0">
                          <p
                            id={jobDetailKickerId}
                            className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-100/70"
                          >
                            {t("admin.routes.sections.jobDetail")}
                          </p>
                          <h2 id={jobDetailTitleId} className="text-xl font-semibold">
                            {jobModal.customerName}
                          </h2>
                          <p className="text-sm text-sky-100/80">
                            {jobModal.propertyAddress}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-start gap-2">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {modalStatus ? (
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur ${modalStatus.className}`}
                              >
                                {modalStatus.label}
                              </span>
                            ) : null}
                            {modalPriority ? (
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur ${modalPriority.className}`}
                              >
                                {modalPriority.label}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => setJobModal(null)}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white/90 transition hover:bg-white/20"
                            aria-label={t("common.actions.close")}
                            title={t("common.actions.close")}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="h-4 w-4"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="app-modal-scroll modal-scroll flex-1 min-h-0 overflow-y-auto bg-slate-50">
                      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
                        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                          <div className="space-y-6">
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-800">
                                  {t("admin.routes.labels.customer")}
                                </h3>
                                <span className="text-xs text-slate-400">
                                  {jobModal.propertyName}
                                </span>
                              </div>
                              <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                                    {t("admin.routes.labels.customer")}
                                  </p>
                                  <p className="font-semibold text-slate-800">
                                    {jobModal.customerName}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                                    {t("common.labels.email")}
                                  </p>
                                  <p>
                                    {jobModal.customerEmail ||
                                      t("admin.routes.labels.noEmail")}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                                    {t("common.labels.phone")}
                                  </p>
                                  <p>
                                    {formatUsPhone(jobModal.customerPhone) ||
                                      t("admin.routes.labels.noPhone")}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                                    {t("admin.routes.labels.property")}
                                  </p>
                                  <p>{jobModal.propertyName}</p>
                                </div>
                                <div className="sm:col-span-2">
                                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                                    {t("admin.routes.labels.address")}
                                  </p>
                                  <p>{jobModal.propertyAddress}</p>
                                </div>
                              </div>
                            </div>

                            {jobModal.customerNotes ? (
                              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-sm font-semibold text-amber-900">
                                    {t("admin.routes.labels.customerRequest")}
                                  </h3>
                                  <span className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                    {t("admin.routes.labels.customerRequestBadge")}
                                  </span>
                                </div>
                                <p className="mt-3 whitespace-pre-wrap text-sm text-amber-900">
                                  {jobModal.customerNotes}
                                </p>
                              </div>
                            ) : null}

                            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-800">
                                  {t("admin.routes.sections.schedule")}
                                </h3>
                                <span className="text-xs text-slate-400">
                                  {t("admin.routes.labels.updateInfo")}
                                </span>
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div>
                                  <label
                                    htmlFor={`${modalIdBase}-job-date`}
                                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                                  >
                                    {t("admin.routes.labels.date")}
                                  </label>
                                  <input
                                    id={`${modalIdBase}-job-date`}
                                    type="date"
                                    value={jobModal.scheduledDate}
                                    onChange={(event) =>
                                      updateJobModal({
                                        scheduledDate: event.target.value,
                                      })
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`${modalIdBase}-job-time`}
                                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                                  >
                                    {t("admin.routes.labels.time")}
                                  </label>
                                  <input
                                    id={`${modalIdBase}-job-time`}
                                    type="time"
                                    value={jobModal.scheduledTime}
                                    onChange={(event) =>
                                      updateJobModal({
                                        scheduledTime: event.target.value,
                                      })
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`${modalIdBase}-job-status`}
                                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                                  >
                                    {t("admin.routes.labels.status")}
                                  </label>
                                  <select
                                    id={`${modalIdBase}-job-status`}
                                    value={jobModal.status}
                                    onChange={(event) =>
                                      updateJobModal({
                                        status: event.target.value,
                                      })
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                  >
                                    <option value="SCHEDULED">
                                      {t("jobs.status.scheduled")}
                                    </option>
                                    <option value="PENDING">
                                      {t("jobs.status.pending")}
                                    </option>
                                    <option value="ON_THE_WAY">
                                      {t("jobs.status.onTheWay")}
                                    </option>
                                    <option value="IN_PROGRESS">
                                      {t("jobs.status.inProgress")}
                                    </option>
                                    <option value="COMPLETED">
                                      {t("jobs.status.completed")}
                                    </option>
                                  </select>
                                </div>
                                <div>
                                  <label
                                    htmlFor={`${modalIdBase}-job-priority`}
                                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                                  >
                                    {t("jobs.detail.fields.priority")}
                                  </label>
                                  <select
                                    id={`${modalIdBase}-job-priority`}
                                    value={jobModal.priority}
                                    onChange={(event) =>
                                      updateJobModal({
                                        priority: event.target.value,
                                      })
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                  >
                                    <option value="NORMAL">
                                      {t("jobs.priority.normal")}
                                    </option>
                                    <option value="URGENT">{t("jobs.priority.urgent")}</option>
                                  </select>
                                </div>
                                <div>
                                  <label
                                    htmlFor={`${modalIdBase}-job-technician`}
                                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                                  >
                                    {t("jobs.detail.fields.tech")}
                                  </label>
                                  <select
                                    id={`${modalIdBase}-job-technician`}
                                    value={jobModal.technicianId}
                                    onChange={(event) =>
                                      updateJobModal({
                                        technicianId: event.target.value,
                                      })
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                  >
                                    <option value="">
                                      {t("admin.routes.labels.unassigned")}
                                    </option>
                                    {technicians.map((tech) => (
                                      <option key={tech.id} value={tech.id}>
                                        {tech.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label
                                    htmlFor={`${modalIdBase}-job-service-tier`}
                                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                                  >
                                    {t("jobs.detail.fields.serviceTier")}
                                  </label>
                                  <select
                                    id={`${modalIdBase}-job-service-tier`}
                                    value={jobModal.serviceTierId}
                                    onChange={(event) => {
                                      const nextTier = event.target.value;
                                      updateJobModal({
                                        serviceTierId: nextTier,
                                        checklist: getTierChecklist(nextTier),
                                      });
                                    }}
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                  >
                                    {serviceTiers.map((tier) => (
                                      <option key={tier.id} value={tier.id}>
                                        {tier.isActive
                                          ? tier.name
                                          : `${tier.name} (${t(
                                              "common.status.inactive"
                                            )})`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label
                                    htmlFor={`${modalIdBase}-job-service-type`}
                                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                                  >
                                    {t("jobs.detail.fields.serviceType")}
                                  </label>
                                  <select
                                    id={`${modalIdBase}-job-service-type`}
                                    value={jobModal.serviceType}
                                    onChange={(event) =>
                                      updateJobModal({
                                        serviceType: event.target.value,
                                      })
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                  >
                                    {serviceTypeOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.labelKey ? t(option.labelKey) : option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="mt-4 rounded-xl border border-dashed border-sky-200 bg-sky-50/40 p-3 sm:p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {t("admin.routes.move.title")}
                                  </h4>
                                  <span className="text-[11px] text-slate-500">
                                    {editMode
                                      ? t("admin.routes.move.hintEditMode")
                                      : t("admin.routes.move.hint")}
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                                  <div>
                                    <label
                                      htmlFor={`${modalIdBase}-move-date`}
                                      className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      {t("admin.routes.labels.date")}
                                    </label>
                                    <input
                                      id={`${modalIdBase}-move-date`}
                                      type="date"
                                      value={jobModal.moveDate}
                                      onChange={(event) =>
                                        updateJobModal({ moveDate: event.target.value })
                                      }
                                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      htmlFor={`${modalIdBase}-move-time`}
                                      className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      {t("admin.routes.labels.time")}
                                    </label>
                                    <input
                                      id={`${modalIdBase}-move-time`}
                                      type="time"
                                      value={jobModal.moveTime}
                                      onChange={(event) =>
                                        updateJobModal({ moveTime: event.target.value })
                                      }
                                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void handleMoveJob()}
                                    disabled={saving || !jobModal.moveDate}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {t("admin.routes.move.action")}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-800">
                                  {t("common.labels.notes")}
                                </h3>
                                <span className="text-xs text-slate-400">
                                  {t("admin.routes.labels.optional")}
                                </span>
                              </div>
                              <textarea
                                aria-label={t("common.labels.notes")}
                                value={jobModal.notes}
                                onChange={(event) =>
                                  updateJobModal({ notes: event.target.value })
                                }
                                className="mt-3 min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                              />
                            </div>
                          </div>

                          <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {t("admin.routes.sections.propertyAccess")}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {jobModal.propertyHasSpa
                        ? t("admin.routes.labels.withSpa")
                        : t("admin.routes.labels.withoutSpa")}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.poolType")}
                      </p>
                      <p>
                        {jobModal.propertyPoolType ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.sanitizerSystem")}
                      </p>
                      <p>
                        {jobModal.propertySanitizerType ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.poolVolume")}
                      </p>
                      <p>
                        {jobModal.propertyPoolVolume ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.filterType")}
                      </p>
                      <p>
                        {jobModal.propertyFilterType ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.access")}
                      </p>
                      <p>
                        {jobModal.propertyAccessInfo ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.accessNotes")}
                      </p>
                      <p>
                        {jobModal.propertyLocationNotes ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {t("jobs.detail.checklist")}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {jobModal.type === "ON_DEMAND"
                        ? t("jobs.type.onDemand")
                        : t("jobs.type.routine")}
                    </span>
                  </div>
                          <div className="mt-4 space-y-2 text-sm text-slate-600">
                            {jobModal.checklist.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                {t("jobs.detail.noChecklist")}
                              </p>
                    ) : (
                      jobModal.checklist.map((item, index) => (
                        <label
                          key={`${item.label ?? "item"}-${index}`}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 transition hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(item.completed)}
                            onChange={(event) =>
                              updateJobChecklist(index, event.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span
                            className={
                              item.completed ? "line-through text-slate-400" : ""
                            }
                          >
                            {item.label ?? t("jobs.detail.checklistItem")}
                          </span>
                        </label>
                      ))
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-800">
                              {t("jobs.detail.evidenceTitle")}
                            </h3>
                            <span className="text-xs text-slate-500">
                              {t("jobs.detail.evidenceCount", {
                                count: jobModal.photos.length,
                              })}
                            </span>
                          </div>
                          {jobModal.photos.length === 0 ? (
                            <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                              {jobModal.status === "COMPLETED"
                                ? t("admin.routes.labels.completedNoEvidence")
                                : t("jobs.detail.noEvidence")}
                            </div>
                          ) : (
                            <div className="mt-4 grid grid-cols-2 gap-3">
                              {jobModal.photos.map((photo) => (
                                <a
                                  key={photo.id}
                                  href={getAssetUrl(photo.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                                >
                                  <img
                                    src={getAssetUrl(photo.url)}
                                    alt={t("jobs.detail.evidenceAlt")}
                                    className="h-24 w-full object-cover transition group-hover:scale-105"
                                  />
                                  <div className="px-2 py-1 text-[11px] text-slate-500">
                                    {new Date(photo.takenAt).toLocaleString(locale, {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                      timeZone: BUSINESS_TIMEZONE,
                                    })}
                                  </div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                </div>
              </div>
            </div>

              <div className="flex shrink-0 flex-col-reverse gap-4 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div className="space-y-1">
                  <p
                    id={`${modalIdBase}-job-save-hint`}
                    className={`text-[11px] ${
                      editMode ? "font-semibold text-amber-700" : "text-slate-500"
                    }`}
                  >
                    {editMode
                      ? t("admin.routes.move.saveDisabledInEditMode")
                      : t("admin.routes.labels.saveHint")}
                  </p>
                  {errorMessage ? (
                    <p role="alert" className="text-[11px] font-semibold text-rose-600">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setJobModal(null)}
                    className="w-full rounded-full border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 sm:w-auto"
                  >
                    {t("common.actions.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleJobModalSave}
                    disabled={saving || editMode}
                    aria-describedby={editMode ? `${modalIdBase}-job-save-hint` : undefined}
                    className="w-full rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {saving
                      ? t("admin.routes.actions.saving")
                      : t("admin.routes.actions.saveChanges")}
                  </button>
                </div>
              </div>
            </div>
        </AppModal>
      ) : null}
    </div>
  );
}
