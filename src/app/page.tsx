import { getTranslations } from "@/i18n/server";

export default async function Home() {
  const t = await getTranslations();

  const stats = [
    { label: t("landing.stats.routes"), value: "18" },
    { label: t("landing.stats.jobs"), value: "142" },
    { label: t("landing.stats.customers"), value: "96" },
    { label: t("landing.stats.invoices"), value: "320" },
  ];

  const services = [
    {
      title: t("landing.services.operations.title"),
      desc: t("landing.services.operations.desc"),
    },
    {
      title: t("landing.services.quality.title"),
      desc: t("landing.services.quality.desc"),
    },
    {
      title: t("landing.services.billing.title"),
      desc: t("landing.services.billing.desc"),
    },
    {
      title: t("landing.services.clients.title"),
      desc: t("landing.services.clients.desc"),
    },
  ];

  const process = [
    {
      title: t("landing.process.step1.title"),
      desc: t("landing.process.step1.desc"),
    },
    {
      title: t("landing.process.step2.title"),
      desc: t("landing.process.step2.desc"),
    },
    {
      title: t("landing.process.step3.title"),
      desc: t("landing.process.step3.desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-0 h-[32rem] w-[32rem] rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-10 h-[26rem] w-[26rem] rounded-full bg-sky-200/50 blur-3xl" />

        <header className="relative mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300">
              <div className="h-5 w-5 rounded-full bg-white/90" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-slate-500">
                {t("app.name")}
              </p>
              <p className="text-sm text-slate-500">{t("landing.tagline")}</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <a href="#services" className="hover:text-slate-900">
              {t("landing.nav.services")}
            </a>
            <a href="#process" className="hover:text-slate-900">
              {t("landing.nav.process")}
            </a>
            <a href="#team" className="hover:text-slate-900">
              {t("landing.nav.team")}
            </a>
            <a href="#contact" className="hover:text-slate-900">
              {t("landing.nav.contact")}
            </a>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/login"
              className="app-button-secondary px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              {t("landing.cta.signIn")}
            </a>
            <a
              href="/client"
              className="app-button-primary px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              {t("landing.cta.clientPortal")}
            </a>
          </div>
        </header>

        <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 pb-24 pt-6">
          <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-sky-500">
                {t("landing.hero.kicker")}
              </p>
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
                {t("landing.hero.title")}
              </h1>
              <p className="text-base leading-7 text-slate-600">
                {t("landing.hero.subtitle")}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/admin"
                  className="app-button-primary px-6 py-3 text-sm font-semibold"
                >
                  {t("landing.hero.primaryCta")}
                </a>
                <a
                  href="/client"
                  className="app-button-secondary px-6 py-3 text-sm font-semibold"
                >
                  {t("landing.hero.secondaryCta")}
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full border border-[var(--border)] bg-white px-4 py-2">
                  {t("landing.hero.badge1")}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-white px-4 py-2">
                  {t("landing.hero.badge2")}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-white px-4 py-2">
                  {t("landing.hero.badge3")}
                </span>
              </div>
            </div>

            <div className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-contrast">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {t("landing.stats.title")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    {t("landing.stats.subtitle")}
                  </h2>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-600">
                  {t("landing.stats.live")}
                </span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4"
                  >
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-3)] px-4 py-4 text-xs text-slate-600">
                {t("landing.stats.note")}
              </div>
            </div>
          </section>

          <section id="services" className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                  {t("landing.services.kicker")}
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                  {t("landing.services.title")}
                </h2>
              </div>
              <p className="max-w-xl text-sm text-slate-500">
                {t("landing.services.subtitle")}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {services.map((service) => (
                <div
                  key={service.title}
                  className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-slate-900">
                    {service.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {service.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="process" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t("landing.process.kicker")}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {t("landing.process.title")}
              </h2>
              <p className="mt-3 text-sm text-slate-600">
                {t("landing.process.subtitle")}
              </p>
              <div className="mt-6 space-y-4">
                {process.map((item, index) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-sm font-semibold text-white">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              id="team"
              className="rounded-3xl border border-[var(--border)] bg-[linear-gradient(135deg,_#ffffff_0%,_#f6fbff_55%,_#eef7ff_100%)] p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t("landing.team.kicker")}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {t("landing.team.title")}
              </h2>
              <p className="mt-3 text-sm text-slate-600">
                {t("landing.team.subtitle")}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  t("landing.team.value1"),
                  t("landing.team.value2"),
                  t("landing.team.value3"),
                  t("landing.team.value4"),
                ].map((value) => (
                  <div
                    key={value}
                    className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-sm text-slate-700"
                  >
                    {value}
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-4 text-sm text-slate-600">
                {t("landing.team.note")}
              </div>
            </div>
          </section>

          <section
            id="contact"
            className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-contrast"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                  {t("landing.cta.kicker")}
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                  {t("landing.cta.title")}
                </h2>
                <p className="mt-3 text-sm text-slate-600">
                  {t("landing.cta.subtitle")}
                </p>
              </div>
              <a
                href="/login"
                className="app-button-primary px-6 py-3 text-sm font-semibold"
              >
                {t("landing.cta.primary")}
              </a>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t("landing.cta.emailLabel")}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  hello@acostaspool.com
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t("landing.cta.phoneLabel")}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  +1 (305) 555-0199
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t("landing.cta.hoursLabel")}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {t("landing.cta.hoursValue")}
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
