type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: "info" | "success" | "warning" | "danger";
  className?: string;
};

export default function StatCard({
  label,
  value,
  helper,
  tone = "info",
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`stat-card min-h-[136px] p-4 animate-rise sm:min-h-[144px] sm:p-5 ${className}`}
      data-tone={tone}
    >
      <p className="stat-card-label text-[10px] font-semibold uppercase leading-[1.25] tracking-[0.06em] text-slate-500 sm:text-[11px] sm:tracking-[0.12em]">
        {label}
      </p>
      <p className="stat-card-value mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {helper ? (
        <p className="stat-card-helper mt-1.5 text-sm leading-snug text-slate-500">{helper}</p>
      ) : null}
    </div>
  );
}
