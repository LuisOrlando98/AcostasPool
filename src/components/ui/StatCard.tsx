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
      <p className="text-[10px] font-semibold uppercase leading-[1.25] tracking-[0.06em] text-slate-500 sm:text-[11px] sm:tracking-[0.12em]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {helper ? (
        <p className="mt-1.5 text-sm leading-snug text-slate-500">{helper}</p>
      ) : null}
    </div>
  );
}
