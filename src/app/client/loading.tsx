import AppShell from "@/components/layout/AppShell";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-100 ${className ?? ""}`} />;
}

export default function ClientLoading() {
  return (
    <AppShell title="" role="CUSTOMER">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="col-span-2 h-28 lg:col-span-1" />
      </section>
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </AppShell>
  );
}
