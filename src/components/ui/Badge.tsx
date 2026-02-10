type BadgeProps = {
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
};

export default function Badge({ label, tone = "neutral" }: BadgeProps) {
  const dataTone = tone === "neutral" ? undefined : tone;
  return (
    <span
      className="app-chip inline-flex items-center px-3 py-1 text-xs"
      data-tone={dataTone}
    >
      {label}
    </span>
  );
}
