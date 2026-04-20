import AppShell from "@/components/layout/AppShell";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-100 ${className ?? ""}`} />;
}

export default function AdminLoading() {
  return (
    <AppShell title="" role="ADMIN">
      <div className="space-y-4 sm:space-y-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </section>
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <Skeleton className="h-96" />
          <div className="space-y-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-56" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
