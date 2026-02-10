type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: "info" | "success" | "warning" | "danger";
};

export default function StatCard({
  label,
  value,
  helper,
  tone = "info",
}: StatCardProps) {
  return (
    <div className="stat-card p-5 animate-rise" data-tone={tone}>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      {helper ? (
        <p className="mt-2 text-sm text-slate-500">{helper}</p>
      ) : null}
    </div>
  );
}
