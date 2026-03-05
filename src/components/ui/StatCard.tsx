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
    <div className="stat-card min-h-[136px] p-4 animate-rise sm:min-h-[144px] sm:p-5" data-tone={tone}>
      <p className="text-pretty text-[11px] font-semibold uppercase leading-[1.25] tracking-[0.14em] text-slate-500 sm:tracking-[0.18em]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {helper ? (
        <p className="mt-1.5 text-sm leading-snug text-slate-500">{helper}</p>
      ) : null}
    </div>
  );
}
