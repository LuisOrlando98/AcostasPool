"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import { TECH_DAILY_CAPACITY, toDateKey } from "@/lib/jobs/capacity";
import { getAssetUrl } from "@/lib/assets";
import { formatUsPhone } from "@/lib/phones";
import { useI18n } from "@/i18n/client";
import RoutesSectionTabs from "@/components/routes/RoutesSectionTabs";

type JobItem = {
  id: string;
  scheduledDate: string;
  status: string;
  type: string;
  priority: string;
  serviceTierId: string | null;
  serviceType: string;
  estimatedDurationMinutes: number | null;
  technicianId: string | null;
  sortOrder?: number | null;
  notes?: string | null;
  checklist?: { label?: string; completed?: boolean }[] | null;
  photos: { id: string; url: string; takenAt: string }[];
  customer: { id: string; name: string; email?: string | null; phone?: string | null };
  property: {
    id: string;
    name?: string | null;
    address: string;
    poolType?: string | null;
    waterType?: string | null;
    sanitizerType?: string | null;
    poolVolumeGallons?: number | null;
    filterType?: string | null;
    accessInfo?: string | null;
    locationNotes?: string | null;
    hasSpa?: boolean | null;
  };
  technician: { id: string; name: string } | null;
};

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
  propertyWaterType: string;
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
  checklist: { label?: string; completed?: boolean }[];
  photos: { id: string; url: string; takenAt: string }[];
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
  density: "comfortable" | "compact";
};

type RoutesCalendarProps = {
  jobs: JobItem[];
  technicians: Technician[];
  customers: Customer[];
  serviceTiers: ServiceTier[];
  monthKey: string;
  nextMonthJobsCount: number;
};

const buildDaysShort = (locale: string) => {
  const base = new Date(2024, 0, 7); // Sunday
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" })
      .format(new Date(base.getTime() + index * 86400000))
      .replace(".", "")
      .toUpperCase()
  );
};

const parseMonthKey = (value: string) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  return new Date(year, month - 1, 1);
};

const toMonthKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;

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

const createDraft = (
  customers: Customer[],
  serviceTiers: ServiceTier[]
): JobDraft => {
  const firstCustomer = customers[0];
  const firstProperty = firstCustomer?.properties[0];
  return {
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

const normalizeChecklist = (value?: { label?: string; completed?: boolean }[] | null) =>
  Array.isArray(value)
    ? value
        .map((item) => ({
          label: String(item?.label ?? "").trim(),
          completed: false,
        }))
        .filter((item) => item.label)
    : [];

const toRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  if (full.length !== 6) {
    return `rgba(56, 189, 248, ${alpha})`;
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function RoutesCalendar({
  jobs,
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
  const [mounted, setMounted] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [techFilter, setTechFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [searchFilter, setSearchFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState<"WEEK" | "MONTH" | "CUSTOM">(
    "WEEK"
  );
  const [customStart, setCustomStart] = useState(() => toDateKey(new Date()));
  const [customEnd, setCustomEnd] = useState(() => toDateKey(new Date()));
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable"
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState<ScheduledFiltersState>({
    statusFilter: "ALL",
    techFilter: "ALL",
    priorityFilter: "ALL",
    searchFilter: "",
    rangeFilter: "WEEK",
    customStart: toDateKey(new Date()),
    customEnd: toDateKey(new Date()),
    density: "comfortable",
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

  useEffect(() => {
    const highlight = searchParams.get("highlight");
    if (!highlight) {
      return;
    }
    setHighlightJobId(highlight);
    const timeout = setTimeout(() => setHighlightJobId(null), 7000);
    return () => clearTimeout(timeout);
  }, [searchParams]);

  useEffect(() => {
    const techParam = searchParams.get("tech");
    if (!techParam) {
      return;
    }
    setTechFilter(techParam);
  }, [searchParams]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = original;
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!mobileDayKey) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileDayKey(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = original;
    };
  }, [mobileDayKey]);

  useEffect(() => {
    if (!editMode) {
      setActiveTechJobId(null);
      setSelectedJobId(null);
      setDraggingJobId(null);
      setDragOverTarget(null);
    }
  }, [editMode]);

  useEffect(() => {
    setJobsState(
      sortJobsChronologically(jobs.map((job) => ({ ...job, scheduledDate: job.scheduledDate })))
    );
    setPendingChanges({});
    setEditMode(false);
    setSelectedDate(null);
    setDrafts([]);
    setErrorMessage(null);
    setSaveSuccess(false);
    setJobModal(null);
    setMobileDayKey(null);
    setActiveTechJobId(null);
    setSelectedJobId(null);
    setDraggingJobId(null);
    setDragOverTarget(null);
  }, [jobs, monthKey]);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }
    const exists = jobsState.some((job) => job.id === selectedJobId);
    if (!exists) {
      setSelectedJobId(null);
    }
  }, [jobsState, selectedJobId]);

  const today = new Date();
  const todayKey = toDateKey(today);
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const viewedMonthStart =
    parseMonthKey(monthKey) ?? new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStart = new Date(
    viewedMonthStart.getFullYear(),
    viewedMonthStart.getMonth(),
    1
  );
  const monthEnd = new Date(
    viewedMonthStart.getFullYear(),
    viewedMonthStart.getMonth() + 1,
    0
  );
  const calendarStart = new Date(monthStart);
  const startOffset = calendarStart.getDay();
  calendarStart.setDate(calendarStart.getDate() - startOffset);
  calendarStart.setHours(0, 0, 0, 0);
  const calendarEnd = new Date(monthEnd);
  const endOffset = 6 - calendarEnd.getDay();
  calendarEnd.setDate(calendarEnd.getDate() + endOffset);
  calendarEnd.setHours(23, 59, 59, 999);

  const calendarDays: Date[] = [];
  const cursor = new Date(calendarStart);
  while (cursor <= calendarEnd) {
    calendarDays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const jobsByDate = useMemo(() => {
    const map = new Map<string, JobItem[]>();
    for (const job of jobsState) {
      const date = new Date(job.scheduledDate);
      const key = toDateKey(date);
      const list = map.get(key) ?? [];
      list.push(job);
      map.set(key, list);
    }
    return map;
  }, [jobsState]);

  const sortJobsForDay = (list: JobItem[]) => {
    return sortJobsChronologically(list);
  };

  const monthLabelRaw = monthStart.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const monthLabel =
    monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);
  const nextMonthJobsLabel = "Next Month:";

  const moveMonth = (offset: number) => {
    const nextMonth = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + offset,
      1
    );
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", toMonthKey(nextMonth));
    router.push(`${pathname}?${params.toString()}`);
  };
  const isCurrentMonthViewed =
    monthStart.getFullYear() === today.getFullYear() &&
    monthStart.getMonth() === today.getMonth();
  const goToCurrentMonth = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", toMonthKey(new Date(today.getFullYear(), today.getMonth(), 1)));
    router.push(`${pathname}?${params.toString()}`);
  };

  const summary = useMemo(() => {
    const todayJobs = jobsState.filter(
      (job) => toDateKey(new Date(job.scheduledDate)) === todayKey
    ).length;
    const urgent = jobsState.filter((job) => job.priority === "URGENT").length;
    const unassigned = jobsState.filter((job) => !job.technicianId).length;
    return { todayJobs, urgent, unassigned };
  }, [jobsState, todayKey]);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  useEffect(() => {
    if (rangeFilter !== "CUSTOM") {
      return;
    }
    if (!customStart) {
      setCustomStart(toDateKey(weekStart));
    }
    if (!customEnd) {
      setCustomEnd(toDateKey(weekEnd));
    }
  }, [rangeFilter, customStart, customEnd, weekStart, weekEnd]);

  const rangeStart = useMemo(() => {
    if (rangeFilter === "MONTH") {
      return new Date(monthStart);
    }
    if (rangeFilter === "CUSTOM") {
      const date = new Date(`${customStart}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    return weekStart;
  }, [rangeFilter, customStart, weekStart, monthStart]);

  const rangeEnd = useMemo(() => {
    if (rangeFilter === "MONTH") {
      const end = new Date(monthEnd);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    if (rangeFilter === "CUSTOM") {
      const date = new Date(`${customEnd}T23:59:59`);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    return weekEnd;
  }, [rangeFilter, customEnd, weekEnd, monthEnd]);

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

  const sortedRangeJobs = useMemo(() => {
    const list = [...filteredRangeJobs];
    const direction = sortDir === "asc" ? 1 : -1;
    const getValue = (job: JobItem) => {
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
    list.sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * direction;
      }
      return String(aValue).localeCompare(String(bValue)) * direction;
    });
    return list;
  }, [filteredRangeJobs, sortKey, sortDir]);

  const formatRangeDate = (value: Date) =>
    value.toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
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
    density !== "comfortable",
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
      density,
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
    setDensity(next.density);
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
    setDensity("comfortable");
    setFiltersDraft({
      statusFilter: "ALL",
      techFilter: "ALL",
      priorityFilter: "ALL",
      searchFilter: "",
      rangeFilter: "WEEK",
      customStart: defaultStart,
      customEnd: defaultEnd,
      density: "comfortable",
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
          className={`text-[10px] ${
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
  const mobileDayDate = mobileDayKey
    ? new Date(`${mobileDayKey}T00:00:00`)
    : null;

  const isCompact = density === "compact";
  const cellPadding = isCompact ? "px-4 py-2" : "px-4 py-3";
  const tableTextSize = isCompact ? "text-[11px]" : "text-xs";
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

  const moveJobToDate = (
    targetDate: Date,
    jobId: string,
    _targetJobId?: string,
    _targetPosition?: "before" | "after"
  ) => {
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

    const updatedDate = new Date(targetDate);
    updatedDate.setHours(
      originalDate.getHours(),
      originalDate.getMinutes(),
      0,
      0
    );

    const pendingUpdates: Record<string, PendingUpdate> = {};
    const addPending = (id: string, patch: PendingUpdate) => {
      pendingUpdates[id] = { ...(pendingUpdates[id] ?? {}), ...patch };
    };

    if (sourceKey !== targetKey) {
      dragged.scheduledDate = updatedDate.toISOString();
      dragged.sortOrder = updatedDate.getHours() * 60 + updatedDate.getMinutes();
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
    const scheduledTime = scheduled.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const checklistItems = Array.isArray(job.checklist)
      ? job.checklist.map((item) => ({
          label: item?.label,
          completed: Boolean(item?.completed),
        }))
      : [];
    const resolvedTierId =
      job.serviceTierId ?? tierOptions[0]?.id ?? "";
    const propertyName =
      job.property.name?.trim() ||
      job.property.address.split(",")[0]?.trim() ||
      t("admin.routes.labels.propertyFallback");
    setActiveTechJobId(null);
    setJobModal({
      jobId: job.id,
      customerName: job.customer.name,
      customerEmail: job.customer.email ?? "",
      customerPhone: job.customer.phone ?? "",
      propertyName,
      propertyAddress: job.property.address,
      propertyPoolType: job.property.poolType ?? "",
      propertyWaterType: job.property.waterType ?? "",
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
      checklist:
        checklistItems.length > 0
          ? checklistItems
          : resolvedTierId
            ? getTierChecklist(resolvedTierId)
            : [],
      photos: Array.isArray(job.photos) ? job.photos : [],
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

  const updateDraft = (index: number, patch: Partial<JobDraft>) => {
    setDrafts((current) =>
      current.map((draft, idx) => (idx === index ? { ...draft, ...patch } : draft))
    );
  };

  const handleCustomerChange = (index: number, customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    updateDraft(index, {
      customerId,
      propertyId: customer?.properties[0]?.id ?? "",
    });
  };

  const addDraft = () => {
    setDrafts((current) => [...current, createDraft(customers, tierOptions)]);
  };

  const removeDraft = (index: number) => {
    setDrafts((current) => current.filter((_, idx) => idx !== index));
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
      jobs: drafts.map((draft) => ({
        ...draft,
        estimatedDurationMinutes: draft.estimatedDuration
          ? Number(draft.estimatedDuration)
          : null,
      })),
    };
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
    setCreating(false);
  };

  const saveSingleUpdate = async (
    jobId: string,
    patch: PendingUpdate
  ) => {
    setErrorMessage(null);
    setSaving(true);
    const res = await fetch("/api/routes/bulk-reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ updates: [{ jobId, ...patch }] }),
    });
    if (res.ok) {
      setSaving(false);
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 1600);
      return true;
    }
    setSaving(false);
    setErrorMessage(t("admin.routes.errors.saveFailed"));
    return false;
  };

  const deleteJobById = async (jobId: string) => {
    if (!jobId) {
      return false;
    }
    setErrorMessage(null);
    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      setSaving(false);
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
    setSaving(false);
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 1600);
    return true;
  };

  const handleTechnicianAssign = async (
    jobId: string,
    technicianId: string
  ) => {
    const nextTechnicianId = technicianId || null;
    const techInfo = nextTechnicianId
      ? techniciansById.get(nextTechnicianId)
      : null;
    const techName = techInfo?.name ?? null;
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
      await saveSingleUpdate(jobId, { technicianId: nextTechnicianId });
    }
    setActiveTechJobId(null);
  };

  const handleJobModalSave = async () => {
    if (!jobModal) {
      return;
    }
    const scheduledDateTime = new Date(
      `${jobModal.scheduledDate}T${jobModal.scheduledTime || "00:00"}:00`
    );
    setErrorMessage(null);
    setSaving(true);
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
      setSaving(false);
      setErrorMessage(
        error?.error || t("admin.routes.errors.saveJobFailed")
      );
      return;
    }
    const techInfo = jobModal.technicianId
      ? techniciansById.get(jobModal.technicianId)
      : null;
    const nextSortOrder =
      scheduledDateTime.getHours() * 60 + scheduledDateTime.getMinutes();
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
    setSaving(false);
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
    const res = await fetch("/api/routes/bulk-reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    if (res.ok) {
      setPendingChanges({});
      setSaving(false);
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 1600);
      return true;
    }
    setSaving(false);
      setErrorMessage(t("admin.routes.errors.saveFailed"));
    return false;
  };

  const toggleEditMode = async () => {
    if (editMode) {
      const ok = await handleSaveChanges();
      if (ok) {
        setEditMode(false);
        setSelectedDate(null);
        setDrafts([]);
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

  return (
    <div className="space-y-6" onClick={() => setActiveTechJobId(null)}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {t("admin.routes.title")}
          </p>
          <RoutesSectionTabs />
        </div>
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(20rem,34rem)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-800"
                aria-label={t("client.request.calendar.previousMonth")}
                title={t("client.request.calendar.previousMonth")}
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
              <h2 className="text-[clamp(1.5rem,5.3vw,2.3rem)] font-semibold leading-none text-slate-900">
                {monthLabel}
              </h2>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-800"
                aria-label={t("client.request.calendar.nextMonth")}
                title={t("client.request.calendar.nextMonth")}
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
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-default disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
              >
                {locale === "es" ? "Este mes" : "Current month"}
              </button>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {nextMonthJobsLabel}
                </span>
                <span className="text-sm font-bold text-slate-900">{nextMonthJobsCount}</span>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="grid w-full grid-cols-2 divide-x divide-y divide-slate-200/70 overflow-hidden rounded-xl border border-slate-200 bg-white/95 sm:grid-cols-4 sm:divide-y-0">
              <button
                type="button"
                onClick={() => {
                  if (todayActive) {
                    setRangeFilter("WEEK");
                    return;
                  }
                  setRangeFilter("CUSTOM");
                  setCustomStart(todayKey);
                  setCustomEnd(todayKey);
                }}
                className={`group flex items-center gap-2 px-3 py-2 text-left transition ${
                  todayActive
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border text-[11px] ${
                    todayActive
                      ? "border-sky-200 bg-sky-500 text-white"
                      : "border-sky-100 bg-sky-100 text-sky-600"
                  }`}
                >
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
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
                    {locale === "es" ? "Trabajos hoy" : "Jobs today"}
                  </span>
                  <span className="text-xs font-semibold text-slate-900">
                    {summary.todayJobs}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setPriorityFilter((current) =>
                    current === "URGENT" ? "ALL" : "URGENT"
                  )
                }
                className={`group flex items-center gap-2 px-3 py-2 text-left transition ${
                  urgentActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border text-[11px] ${
                    urgentActive
                      ? "border-indigo-200 bg-indigo-500 text-white"
                      : "border-indigo-100 bg-indigo-100 text-indigo-600"
                  }`}
                >
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
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
                    {t("admin.routes.labels.urgent")}
                  </span>
                  <span className="text-xs font-semibold text-slate-900">
                    {summary.urgent}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setTechFilter((current) =>
                    current === "UNASSIGNED" ? "ALL" : "UNASSIGNED"
                  )
                }
                className={`group flex items-center gap-2 px-3 py-2 text-left transition ${
                  unassignedActive
                    ? "bg-rose-50 text-rose-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border text-[11px] ${
                    unassignedActive
                      ? "border-rose-200 bg-rose-500 text-white"
                      : "border-rose-100 bg-rose-100 text-rose-600"
                  }`}
                >
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
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
                    {t("jobs.detail.noTech")}
                  </span>
                  <span className="text-xs font-semibold text-slate-900">
                    {summary.unassigned}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={toggleEditMode}
                disabled={saving}
                className={`group flex items-center gap-2 px-3 py-2 text-left transition ${
                  editMode
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                } ${saving ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border text-[11px] ${
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
                <span className="flex flex-col leading-tight">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
                    {editMode
                      ? t("common.actions.save")
                      : t("common.actions.edit")}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      editMode ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {editMode ? "Cambios" : "Calendario"}
                  </span>
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
                  className={`group flex items-center gap-2 px-3 py-2 text-left transition ${
                    selectedJobId && !saving
                      ? "text-rose-700 hover:bg-rose-50"
                      : "cursor-not-allowed text-slate-400"
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600">
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
                  <span className="flex flex-col leading-tight">
                    <span className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
                      {locale === "es" ? "TECLA SUPR" : "DELETE KEY"}
                    </span>
                    <span className="text-xs font-semibold">
                      {t("common.actions.delete")}
                    </span>
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 xl:hidden">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            <p className="text-[11px] text-slate-500">
              {t("admin.routes.calendarMobile.helper")}
            </p>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {daysShort.map((label) => (
                <div
                  key={`wd-${label}`}
                  className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const key = toDateKey(day);
                const isCurrentMonth =
                  day.getMonth() === monthStart.getMonth() &&
                  day.getFullYear() === monthStart.getFullYear();
                const jobsForDay = sortJobsForDay(jobsByDate.get(key) ?? []);
                const jobsCount = jobsForDay.length;
                const isToday = key === toDateKey(startOfToday);
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
                      {day.getDate()}
                    </span>
                    {isCurrentMonth ? (
                      <span
                        className="absolute right-1 top-1 inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white"
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
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
              <span>{t("admin.routes.calendarMobile.loadLow")}</span>
              <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" />
              <span>{t("admin.routes.calendarMobile.loadHigh")}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 hidden overflow-x-auto pb-2 xl:block xl:overflow-visible">
          <div className="grid min-w-[980px] grid-cols-7 gap-2 2xl:min-w-0">
          {(() => {
            return calendarDays.map((day) => {
              const key = toDateKey(day);
              const isCurrentMonth =
                day.getMonth() === monthStart.getMonth() &&
                day.getFullYear() === monthStart.getFullYear();
              const isPastDay = day < startOfToday;
              const jobsForDay = sortJobsForDay(jobsByDate.get(key) ?? []);
              const fillPct = Math.round((jobsForDay.length / dayCapacity) * 100);
              const fillWidth =
                jobsForDay.length === 0 ? 0 : Math.max(10, fillPct);
              const dayIndex = day.getDay();
              const dayLabel = daysShort[dayIndex];
              const isToday = key === toDateKey(startOfToday);
              const dayTone = isCurrentMonth
                ? isPastDay
                  ? "border-sky-100 bg-sky-50/90 text-slate-600"
                  : "border-slate-200 bg-white text-slate-700"
                : "border-sky-100 bg-sky-50/70 text-slate-400";
              const dayHover = editMode
                ? "hover:border-sky-300 hover:bg-sky-50/60"
                : "";
              return (
                <div
                key={key}
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
                className={`group relative flex min-h-[210px] flex-col gap-2.5 rounded-[22px] border px-3 py-3 text-xs transition sm:min-h-[240px] 2xl:min-h-[260px] ${dayTone} ${dayHover} ${
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
                        {day.getDate()}
                      </span>
                      <span className="text-[8px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                        {dayLabel}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {jobsForDay.length > 0 ? (
                        <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[8px] font-semibold text-slate-600">
                          {t("admin.routes.labels.jobsCount", {
                            count: jobsForDay.length,
                          })}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] text-slate-400">
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
                    const isHighlighted = highlightJobId === job.id;
                    const isSelected = selectedJobId === job.id;
                    const isDropTarget =
                      dragOverTarget?.jobId === job.id &&
                      draggingJobId !== job.id;
                    const dropPosition = dragOverTarget?.position;
                    const timeLabel = new Date(
                      job.scheduledDate
                    ).toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const serviceOption = serviceTypeOptions.find(
                      (option) => option.value === job.serviceType
                    );
                    const serviceLabel = serviceOption?.labelKey
                      ? t(serviceOption.labelKey)
                      : serviceOption?.label ?? job.serviceType;
                    const tierLabel = job.serviceTierId
                      ? serviceTiersById.get(job.serviceTierId)?.name ?? null
                      : null;
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
                    const techStyle =
                      job.technicianId && techColor
                        ? { color: techColor }
                        : undefined;
                    const techDotStyle =
                      job.technicianId && techColor
                        ? { backgroundColor: techColor }
                        : { backgroundColor: "#fb7185" };
                    return (
                      <div
                        key={job.id}
                        draggable={editMode}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", job.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingJobId(job.id);
                        }}
                        onDragEnd={() => {
                          setDraggingJobId(null);
                          setDragOverTarget(null);
                        }}
                        onDragOver={(event) => {
                          if (!editMode || job.id === draggingJobId) {
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
                          if (!editMode) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          const draggedId =
                            event.dataTransfer.getData("text/plain");
                          if (draggedId) {
                            moveJobToDate(day, draggedId, job.id, dropPosition);
                          }
                          setDraggingJobId(null);
                          setDragOverTarget(null);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (editMode) {
                            setSelectedJobId((current) =>
                              current === job.id ? null : job.id
                            );
                            return;
                          }
                          openJobModal(job);
                        }}
                        className={`relative block rounded-2xl border px-3 py-3 text-[10px] transition ${
                          editMode ? "cursor-move" : "cursor-pointer"
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-slate-800">
                              {job.customer.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {tierLabel ? `${tierLabel} - ` : ""}
                              {serviceLabel}
                            </div>
                          </div>
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[8px] font-semibold text-slate-600"
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
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
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
                        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-600">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                              {job.type === "ON_DEMAND"
                                ? t("jobs.type.onDemand")
                                : t("jobs.type.routine")}
                            </span>
                            {job.priority === "URGENT" ? (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
                                {t("jobs.priority.urgent")}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveTechJobId(job.id);
                            }}
                            className={`inline-flex max-w-[120px] items-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-[10px] font-semibold transition ${techTone} hover:border-slate-300 hover:bg-slate-50 hover:ring-2 hover:ring-sky-100`}
                            title={
                              editMode
                                ? t("admin.routes.actions.assignTechnician")
                                : "Activar editar para asignar"
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
                        </div>
                        {activeTechJobId === job.id ? (
                          <div
                            className="mt-2 rounded-lg border border-slate-200 bg-white p-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <select
                              value={job.technicianId ?? ""}
                              onChange={(event) =>
                                handleTechnicianAssign(job.id, event.target.value)
                              }
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-[10px]"
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
                    <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-3 py-3 text-[10px] text-slate-500">
                      Arrastra aqui o pulsa para asignar
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
              className="app-button-primary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] sm:w-auto"
            >
              {t("admin.routes.filters.open")}
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
              <div className="space-y-3 p-3 xl:hidden">
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
                  });
                  const timeLabel = scheduled.toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const propertyName =
                    job.property.name?.trim() ||
                    job.property.address.split(",")[0]?.trim() ||
                    t("admin.routes.labels.propertyFallback");
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
                      className={`rounded-2xl border p-4 transition ${
                        isSelected
                          ? "border-rose-200 bg-rose-50/70"
                          : isHighlighted
                            ? "border-sky-200 bg-sky-50/70"
                            : "border-slate-200 bg-white"
                      } ${job.status === "COMPLETED" ? "opacity-70" : ""} ${
                        editMode ? "cursor-pointer" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={techDotStyle} />
                            <p className="truncate text-sm font-semibold text-slate-900">
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
                          <p className="text-sm font-semibold text-slate-900">{dateLabel}</p>
                          <p className="text-[11px] text-slate-500">{timeLabel}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.routes.table.property")}
                          </p>
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {propertyName}
                          </p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              job.property.address
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="mt-0.5 block truncate text-[11px] text-slate-500 hover:text-slate-700"
                            title={job.property.address}
                          >
                            {job.property.address}
                          </a>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.routes.table.service")}
                          </p>
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {serviceLabel}
                          </p>
                          {tierLabel ? (
                            <p className="text-[11px] text-slate-500">{tierLabel}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityInfo.className}`}
                        >
                          {priorityInfo.label}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {job.type === "ON_DEMAND"
                            ? t("jobs.type.onDemand")
                            : t("jobs.type.routine")}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-600">
                          <span className="h-2 w-2 rounded-full" style={techDotStyle} />
                          <span className="max-w-[120px] truncate font-medium">
                            {techInfo?.name ??
                              job.technician?.name ??
                              t("jobs.detail.noTech")}
                          </span>
                        </span>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openJobModal(job);
                          }}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          {t("common.actions.view")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden max-h-[520px] overflow-auto xl:block">
              <table
                className={`min-w-[980px] w-full text-left ${tableTextSize}`}
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
                    });
                    const timeLabel = scheduled.toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const propertyName =
                      job.property.name?.trim() ||
                      job.property.address.split(",")[0]?.trim() ||
                      t("admin.routes.labels.propertyFallback");
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
                              <span className="font-semibold text-slate-900">
                                {job.customer.name}
                              </span>
                            </div>
                            {contactLine ? (
                              <div
                                className="max-w-[200px] truncate text-[10px] text-slate-500"
                                title={contactLine}
                              >
                                {contactLine}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400">
                                {t("admin.routes.labels.noContact")}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-900">
                              {propertyName}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
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
                            <div className="text-[10px]">{timeLabel}</div>
                          </div>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-900">
                              {serviceLabel}
                            </div>
                            {tierLabel ? (
                              <div className="text-[10px] text-slate-400">
                                {tierLabel}
                              </div>
                            ) : null}
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              {job.type === "ON_DEMAND"
                                ? t("jobs.type.onDemand")
                                : t("jobs.type.routine")}
                            </span>
                          </div>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusInfo.className}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className={`${cellPadding} align-top`}>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityInfo.className}`}
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
                            <span className="truncate font-semibold">
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
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
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
            </>
          )}
        </div>
      </section>

      {mounted && filtersOpen
        ? createPortal(
            <div className="fixed inset-0 z-[1295] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6">
              <button
                type="button"
                className="absolute inset-0"
                aria-label={t("common.actions.close")}
                onClick={() => setFiltersOpen(false)}
              />
              <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {t("admin.routes.filters.toolbar")}
                      </p>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {t("admin.routes.filters.modalTitle")}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {t("admin.routes.filters.modalSubtitle")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
                    >
                      {t("common.actions.close")}
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

                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t("admin.routes.filters.density")}
                      </p>
                      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setFiltersDraft((current) => ({
                              ...current,
                              density: "comfortable",
                            }))
                          }
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            filtersDraft.density === "comfortable"
                              ? "bg-slate-900 text-white"
                              : "text-slate-600"
                          }`}
                        >
                          {t("admin.routes.labels.densityNormal")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFiltersDraft((current) => ({
                              ...current,
                              density: "compact",
                            }))
                          }
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            filtersDraft.density === "compact"
                              ? "bg-slate-900 text-white"
                              : "text-slate-600"
                          }`}
                        >
                          {t("admin.routes.labels.densityCompact")}
                        </button>
                      </div>
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
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && mobileDayKey
        ? createPortal(
            <div className="fixed inset-0 z-[1298] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6">
              <button
                type="button"
                className="absolute inset-0"
                aria-label={t("common.actions.close")}
                onClick={() => setMobileDayKey(null)}
              />
              <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {t("admin.routes.sections.scheduledJobs")}
                      </p>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {mobileDayDate
                          ? mobileDayDate.toLocaleDateString(locale, {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
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
                    <button
                      type="button"
                      onClick={() => setMobileDayKey(null)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
                    >
                      {t("common.actions.close")}
                    </button>
                  </div>
                </div>

                <div className="max-h-[72vh] overflow-y-auto px-4 py-4 sm:px-6">
                  {mobileDayJobs.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      {t("admin.routes.calendarMobile.empty")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mobileDayJobs.map((job) => {
                        const serviceOption = serviceTypeOptions.find(
                          (option) => option.value === job.serviceType
                        );
                        const serviceLabel = serviceOption?.labelKey
                          ? t(serviceOption.labelKey)
                          : serviceOption?.label ?? job.serviceType;
                        const tierLabel = job.serviceTierId
                          ? serviceTiersById.get(job.serviceTierId)?.name ?? null
                          : null;
                        const timeLabel = new Date(job.scheduledDate).toLocaleTimeString(
                          locale,
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
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

                        return (
                          <button
                            key={`mobile-day-job-${job.id}`}
                            type="button"
                            onClick={() => {
                              setMobileDayKey(null);
                              openJobModal(job);
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/30"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {job.customer.name}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {job.property.address}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {timeLabel}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-600">
                              {tierLabel ? `${tierLabel} - ` : ""}
                              {serviceLabel}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusInfo.className}`}
                              >
                                {statusInfo.label}
                              </span>
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityInfo.className}`}
                              >
                                {priorityInfo.label}
                              </span>
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
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

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
                  <button
                    type="button"
                    onClick={() => setMobileDayKey(null)}
                    className="app-button-primary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] sm:w-auto"
                  >
                    {t("common.actions.close")}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {selectedDate ? (
        <div className="fixed inset-0 z-[1300] flex items-start justify-center overflow-y-auto p-3 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60" />
          <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.routes.actions.assignJobs")}
                </p>
                <h2 className="text-lg font-semibold">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                    locale
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
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
                    key={`draft-${index}`}
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
                          onClick={() => removeDraft(index)}
                          className="text-xs text-slate-500"
                        >
                          {t("common.actions.delete")}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.routes.labels.customer")}
                        </label>
                        <select
                          value={draft.customerId}
                          onChange={(event) =>
                            handleCustomerChange(index, event.target.value)
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
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.routes.labels.property")}
                        </label>
                        <select
                          value={draft.propertyId}
                          onChange={(event) =>
                            updateDraft(index, {
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
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.routes.labels.time")}
                        </label>
                        <input
                          value={draft.scheduledTime}
                          onChange={(event) =>
                            updateDraft(index, {
                              scheduledTime: event.target.value,
                            })
                          }
                          type="time"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("jobs.detail.fields.tech")}
                        </label>
                        <select
                          value={draft.technicianId}
                          onChange={(event) =>
                            updateDraft(index, {
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
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("jobs.detail.fields.priority")}
                        </label>
                        <select
                          value={draft.priority}
                          onChange={(event) =>
                            updateDraft(index, {
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
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("jobs.detail.fields.serviceTier")}
                        </label>
                        <select
                          value={draft.serviceTierId}
                          onChange={(event) =>
                            updateDraft(index, {
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
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("jobs.detail.fields.serviceType")}
                        </label>
                        <select
                          value={draft.serviceType}
                          onChange={(event) =>
                            updateDraft(index, {
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
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.routes.labels.durationMinutes")}
                        </label>
                        <input
                          value={draft.estimatedDuration}
                          onChange={(event) =>
                            updateDraft(index, {
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
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("common.labels.notes")}
                      </label>
                      <textarea
                        value={draft.notes}
                        onChange={(event) =>
                          updateDraft(index, { notes: event.target.value })
                        }
                        className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

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
          </div>
        </div>
      ) : null}

      {mounted && jobModal
        ? createPortal(
            <div
              className="fixed inset-0 z-[1310] overflow-y-auto bg-slate-900/60"
              onClick={() => setJobModal(null)}
            >
              <div className="flex min-h-screen items-start justify-center px-4 py-6 sm:items-center sm:px-6 sm:py-10">
                <div
                  className="relative h-[92vh] max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white sm:h-[90vh]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="relative shrink-0 border-b border-slate-800/60 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-5 sm:px-6">
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.25),_transparent_45%)]" />
                      <div className="relative flex flex-wrap items-start justify-between gap-3 text-white">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-100/70">
                            {t("admin.routes.sections.jobDetail")}
                          </p>
                          <h2 className="text-xl font-semibold">
                            {jobModal.customerName}
                          </h2>
                          <p className="text-sm text-sky-100/80">
                            {jobModal.propertyAddress}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
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
                          <button
                            type="button"
                            onClick={() => setJobModal(null)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white/90 transition hover:bg-white/20"
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

                    <div className="modal-scroll flex-1 min-h-0 overflow-y-auto bg-slate-50">
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
                                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                                    {t("admin.routes.labels.customer")}
                                  </p>
                                  <p className="font-semibold text-slate-800">
                                    {jobModal.customerName}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                                    Email
                                  </p>
                                  <p>
                                    {jobModal.customerEmail ||
                                      t("admin.routes.labels.noEmail")}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                                    Telefono
                                  </p>
                                  <p>
                                    {formatUsPhone(jobModal.customerPhone) ||
                                      t("admin.routes.labels.noPhone")}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                                    {t("admin.routes.labels.property")}
                                  </p>
                                  <p>{jobModal.propertyName}</p>
                                </div>
                                <div className="sm:col-span-2">
                                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                                    {t("admin.routes.labels.address")}
                                  </p>
                                  <p>{jobModal.propertyAddress}</p>
                                </div>
                              </div>
                            </div>

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
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {t("admin.routes.labels.date")}
                                  </label>
                                  <input
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
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {t("admin.routes.labels.time")}
                                  </label>
                                  <input
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
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {t("admin.routes.labels.status")}
                                  </label>
                                  <select
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
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {t("jobs.detail.fields.priority")}
                                  </label>
                                  <select
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
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {t("jobs.detail.fields.tech")}
                                  </label>
                                  <select
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
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {t("jobs.detail.fields.serviceTier")}
                                  </label>
                                  <select
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
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {t("jobs.detail.fields.serviceType")}
                                  </label>
                                  <select
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
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.poolType")}
                      </p>
                      <p>
                        {jobModal.propertyPoolType ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.sanitizerSystem")}
                      </p>
                      <p>
                        {jobModal.propertySanitizerType ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.poolVolume")}
                      </p>
                      <p>
                        {jobModal.propertyPoolVolume ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.filterType")}
                      </p>
                      <p>
                        {jobModal.propertyFilterType ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.waterType")}
                      </p>
                      <p>
                        {jobModal.propertyWaterType ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        {t("admin.routes.labels.access")}
                      </p>
                      <p>
                        {jobModal.propertyAccessInfo ||
                          t("common.labels.notAvailable")}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
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
                                  <div className="px-2 py-1 text-[10px] text-slate-500">
                                    {new Date(photo.takenAt).toLocaleString(locale, {
                                      dateStyle: "medium",
                                      timeStyle: "short",
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
                <p className="text-[11px] text-slate-500">
                  {t("admin.routes.labels.saveHint")}
                </p>
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
                    disabled={saving}
                    className="w-full rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                  >
                    {saving
                      ? t("admin.routes.actions.saving")
                      : t("admin.routes.actions.saveChanges")}
                  </button>
                </div>
              </div>
            </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
