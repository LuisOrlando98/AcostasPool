"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n/client";

const INK_PRIMARY = "#0b0b0b";
const INK_SECONDARY = "#52514e";
const INK_MUTED = "#898781";
const GRIDLINE = "#e1e0d9";

// Categorical slot 1 (blue) - one-time payments; slot 2 (orange) - recurring autopay.
const ONE_TIME_COLOR = "#2a78d6";
const ONE_TIME_FILL = "#cde2fb";
const RECURRING_COLOR = "#eb6834";
const RECURRING_FILL = "#f9d8c6";

// Status palette (fixed, never themed) - membership lifecycle.
const STATUS_GOOD = "#0ca30c";
const STATUS_CRITICAL = "#d03b3b";

// Semantic invoice-status colors, matching the app's existing chip tones.
const INVOICE_STATUS_COLORS: Record<string, string> = {
  PAID: "#0ca30c",
  SENT: "#2a78d6",
  OVERDUE: "#d03b3b",
  DRAFT: "#898781",
};

const METHOD_COLORS: Record<string, string> = {
  CARD: "#2a78d6",
  CASH: "#eb6834",
  ZELLE: "#1baf7a",
  CHECK: "#eda100",
  TRANSFER: "#e87ba4",
  OTHER: "#008300",
};

function money(cents: number, locale: string, compact = false) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 0 : 0,
    notation: compact ? "compact" : "standard",
  }).format(cents / 100);
}

type RevenuePoint = {
  month: string;
  oneTimeCents: number;
  recurringCents: number;
  totalCents: number;
};
type MethodPoint = { method: string; amountCents: number };
type TopCustomerPoint = { customerId: string; customerName: string; amountCents: number };
type MembershipTrendPoint = { month: string; activated: number; canceled: number };
type InvoiceStatusPoint = { status: string; count: number };

function ChartCard({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="app-card relative overflow-hidden p-6 shadow-contrast">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-sky-100 to-transparent opacity-60" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="relative mt-4">{children}</div>
    </div>
  );
}

function RevenueTooltip({
  active,
  payload,
  label,
  locale,
  oneTimeLabel,
  recurringLabel,
  totalLabel,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; payload: RevenuePoint & { label: string } }>;
  label?: string;
  locale: string;
  oneTimeLabel: string;
  recurringLabel: string;
  totalLabel: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-xl">
      <p className="font-semibold text-slate-900">{label}</p>
      <div className="mt-1.5 space-y-1">
        <p className="flex items-center justify-between gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: ONE_TIME_COLOR }}
            />
            {oneTimeLabel}
          </span>
          <span className="font-medium text-slate-800">{money(point.oneTimeCents, locale)}</span>
        </p>
        <p className="flex items-center justify-between gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: RECURRING_COLOR }}
            />
            {recurringLabel}
          </span>
          <span className="font-medium text-slate-800">{money(point.recurringCents, locale)}</span>
        </p>
        <p className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1 font-semibold text-slate-900">
          <span>{totalLabel}</span>
          <span>{money(point.totalCents, locale)}</span>
        </p>
      </div>
    </div>
  );
}

export function RevenueChart({
  data,
  monthLabels,
  oneTimeLabel,
  recurringLabel,
  totalLabel,
  tableViewLabel,
  chartViewLabel,
}: {
  data: RevenuePoint[];
  monthLabels: Record<string, string>;
  oneTimeLabel: string;
  recurringLabel: string;
  totalLabel: string;
  tableViewLabel: string;
  chartViewLabel: string;
}) {
  const { locale } = useI18n();
  const [showTable, setShowTable] = useState(false);
  const chartData = data.map((point) => ({
    ...point,
    label: monthLabels[point.month] ?? point.month,
  }));

  return (
    <ChartCard
      title={totalLabel}
      actions={
        <button
          type="button"
          onClick={() => setShowTable((current) => !current)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600 transition hover:border-slate-300"
        >
          {showTable ? chartViewLabel : tableViewLabel}
        </button>
      }
    >
      {showTable ? (
        <div className="max-h-[280px] overflow-y-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">{chartData[0] ? "" : ""}</th>
                <th className="px-3 py-2 font-semibold">{oneTimeLabel}</th>
                <th className="px-3 py-2 font-semibold">{recurringLabel}</th>
                <th className="px-3 py-2 font-semibold">{totalLabel}</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((point) => (
                <tr key={point.month} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{point.label}</td>
                  <td className="px-3 py-2 text-slate-600">{money(point.oneTimeCents, locale)}</td>
                  <td className="px-3 py-2 text-slate-600">{money(point.recurringCents, locale)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">
                    {money(point.totalCents, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="oneTimeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ONE_TIME_FILL} stopOpacity={0.95} />
                <stop offset="100%" stopColor={ONE_TIME_FILL} stopOpacity={0.15} />
              </linearGradient>
              <linearGradient id="recurringFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RECURRING_FILL} stopOpacity={0.95} />
                <stop offset="100%" stopColor={RECURRING_FILL} stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRIDLINE} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: INK_MUTED, fontSize: 11 }}
              axisLine={{ stroke: GRIDLINE }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: INK_MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => money(value, locale, true)}
              width={56}
            />
            <Tooltip
              content={
                <RevenueTooltip
                  locale={locale}
                  oneTimeLabel={oneTimeLabel}
                  recurringLabel={recurringLabel}
                  totalLabel={totalLabel}
                />
              }
            />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="circle"
              iconSize={8}
              formatter={(value: string) =>
                value === "oneTimeCents" ? (
                  <span className="text-xs text-slate-600">{oneTimeLabel}</span>
                ) : (
                  <span className="text-xs text-slate-600">{recurringLabel}</span>
                )
              }
            />
            <Area
              type="monotone"
              dataKey="oneTimeCents"
              stackId="revenue"
              stroke={ONE_TIME_COLOR}
              strokeWidth={2}
              fill="url(#oneTimeFill)"
            />
            <Area
              type="monotone"
              dataKey="recurringCents"
              stackId="revenue"
              stroke={RECURRING_COLOR}
              strokeWidth={2}
              fill="url(#recurringFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function MethodTooltip({
  active,
  payload,
  locale,
}: {
  active?: boolean;
  payload?: Array<{ payload: MethodPoint }>;
  locale: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-900">{point.method}</p>
      <p className="mt-1 text-slate-600">{money(point.amountCents, locale)}</p>
    </div>
  );
}

export function MethodBreakdownChart({ data }: { data: MethodPoint[] }) {
  const { locale } = useI18n();
  const height = Math.max(120, data.length * 44);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        barCategoryGap={12}
      >
        <CartesianGrid horizontal={false} stroke={GRIDLINE} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tick={{ fill: INK_MUTED, fontSize: 11 }}
          axisLine={{ stroke: GRIDLINE }}
          tickLine={false}
          tickFormatter={(value: number) => money(value, locale, true)}
        />
        <YAxis
          type="category"
          dataKey="method"
          tick={{ fill: INK_PRIMARY, fontSize: 12, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip content={<MethodTooltip locale={locale} />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
        <Bar dataKey="amountCents" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((entry) => (
            <Cell key={entry.method} fill={METHOD_COLORS[entry.method] ?? "#898781"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopCustomerTooltip({
  active,
  payload,
  locale,
}: {
  active?: boolean;
  payload?: Array<{ payload: TopCustomerPoint }>;
  locale: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-900">{point.customerName}</p>
      <p className="mt-1 text-slate-600">{money(point.amountCents, locale)}</p>
    </div>
  );
}

export function TopCustomersChart({ data }: { data: TopCustomerPoint[] }) {
  const { locale } = useI18n();
  const height = Math.max(120, data.length * 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke={GRIDLINE} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tick={{ fill: INK_MUTED, fontSize: 11 }}
          axisLine={{ stroke: GRIDLINE }}
          tickLine={false}
          tickFormatter={(value: number) => money(value, locale, true)}
        />
        <YAxis
          type="category"
          dataKey="customerName"
          tick={{ fill: INK_PRIMARY, fontSize: 12, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip
          content={<TopCustomerTooltip locale={locale} />}
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
        />
        <Bar dataKey="amountCents" radius={[0, 4, 4, 0]} maxBarSize={22} fill={ONE_TIME_COLOR} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MembershipTrendChart({
  data,
  monthLabels,
  activatedLabel,
  canceledLabel,
}: {
  data: MembershipTrendPoint[];
  monthLabels: Record<string, string>;
  activatedLabel: string;
  canceledLabel: string;
}) {
  const chartData = data.map((point) => ({
    ...point,
    label: monthLabels[point.month] ?? point.month,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={GRIDLINE} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fill: INK_MUTED, fontSize: 11 }}
          axisLine={{ stroke: GRIDLINE }}
          tickLine={false}
        />
        <YAxis tick={{ fill: INK_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e1e0d9",
            fontSize: 12,
            boxShadow: "0 12px 32px rgba(11,11,11,0.12)",
          }}
        />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span className="text-xs text-slate-600">
              {value === "activated" ? activatedLabel : canceledLabel}
            </span>
          )}
        />
        <Bar dataKey="activated" fill={STATUS_GOOD} radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="canceled" fill={STATUS_CRITICAL} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InvoiceStatusChart({
  data,
  statusLabels,
}: {
  data: InvoiceStatusPoint[];
  statusLabels: Record<string, string>;
}) {
  const chartData = data.map((point) => ({
    ...point,
    label: statusLabels[point.status] ?? point.status,
  }));
  const height = Math.max(100, chartData.length * 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke={GRIDLINE} strokeDasharray="3 3" />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fill: INK_MUTED, fontSize: 11 }}
          axisLine={{ stroke: GRIDLINE }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: INK_PRIMARY, fontSize: 12, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e1e0d9",
            fontSize: 12,
            boxShadow: "0 12px 32px rgba(11,11,11,0.12)",
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {chartData.map((entry) => (
            <Cell key={entry.status} fill={INVOICE_STATUS_COLORS[entry.status] ?? INK_SECONDARY} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
