"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";

type ThemeName = "ocean" | "mint" | "night";
type DensityName = "comfortable" | "compact";

type QuoteFormState = {
  name: string;
  address: string;
  poolType: string;
  phone: string;
  message: string;
};

const PHONE_DISPLAY = "+1 (305) 555-0199";
const PHONE_E164 = "+13055550199";
const AREAS = ["Homestead", "Kendall", "Miami", "Doral", "Cutler Bay"];

const SERVICE_GROUPS = [
  {
    title: "Weekly Maintenance",
    items: [
      "Skimming surface",
      "Vacuuming",
      "Brushing walls & tile",
      "Emptying baskets",
      "Equipment check",
    ],
  },
  {
    title: "Water Chemistry Management",
    items: [
      "pH balance",
      "Chlorine control",
      "Algae prevention",
      "Water testing reports",
      "Chemical balancing plan",
    ],
  },
  {
    title: "Repairs & Equipment",
    items: [
      "Pump repair",
      "Filter cleaning/replacement",
      "Leak detection",
      "Salt system service",
      "Controller diagnostics",
    ],
  },
  {
    title: "One-Time Cleanups",
    items: [
      "Green pool recovery",
      "Seasonal openings",
      "Storm cleanup",
      "Deep debris extraction",
      "Water reset startup",
    ],
  },
];

const TRUST_ITEMS = [
  "Licensed & Insured",
  "Reliable Weekly Scheduling",
  "Clear Communication (text/email updates)",
  "Experienced Technicians",
  "No Contracts Required",
  "Satisfaction Guaranteed",
];

const PROCESS_STEPS = [
  "Request a Quote",
  "We Inspect Your Pool",
  "You Get a Service Plan",
  "Enjoy a Clean, Worry-Free Pool",
];

const PRICING = [
  {
    name: "Basic",
    idealFor: "Small pools",
    includes: [
      "Cleaning + chemicals",
      "Weekly maintenance checklist",
      "Service summary after each visit",
    ],
  },
  {
    name: "Standard",
    idealFor: "Most homes",
    includes: [
      "Full maintenance",
      "Balanced chemistry + brushing + vacuum",
      "Monthly equipment review",
    ],
  },
  {
    name: "Premium",
    idealFor: "Large pools",
    includes: [
      "Priority response + full maintenance",
      "Enhanced equipment checks",
      "Preferred scheduling windows",
    ],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "They show up every week on time. My pool has never looked better.",
    author: "Homeowner in Kendall",
  },
  {
    quote:
      "Communication is excellent. We get photos and updates after each visit.",
    author: "Property manager in Doral",
  },
  {
    quote:
      "After storm cleanup, the water was crystal clear in less than 48 hours.",
    author: "Family in Cutler Bay",
  },
];

const THEME_OPTIONS: Array<{ id: ThemeName; label: string }> = [
  { id: "ocean", label: "Ocean" },
  { id: "mint", label: "Mint" },
  { id: "night", label: "Night" },
];

const DENSITY_OPTIONS: Array<{ id: DensityName; label: string }> = [
  { id: "comfortable", label: "Comfortable" },
  { id: "compact", label: "Compact" },
];

const CAMPAIGN_MESSAGE: Record<string, string> = {
  repair: "Fast diagnostics for pumps, filters, and salt systems.",
  weekly: "Consistent weekly routes with text/email service updates.",
  cleanup: "Green-to-clear cleanups designed for Florida conditions.",
};

const emptyForm: QuoteFormState = {
  name: "",
  address: "",
  poolType: "",
  phone: "",
  message: "",
};

export default function ClientLanding() {
  const searchParams = useSearchParams();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") {
      return "ocean";
    }
    const saved = window.localStorage.getItem("ap:landing-theme");
    if (saved === "ocean" || saved === "mint" || saved === "night") {
      return saved;
    }
    return "ocean";
  });
  const [density, setDensity] = useState<DensityName>(() => {
    if (typeof window === "undefined") {
      return "comfortable";
    }
    const saved = window.localStorage.getItem("ap:landing-density");
    if (saved === "comfortable" || saved === "compact") {
      return saved;
    }
    return "comfortable";
  });
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [form, setForm] = useState<QuoteFormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof QuoteFormState, string>>>(
    {}
  );
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  const cityParam = (searchParams.get("city") ?? "").trim();
  const campaignParam = (searchParams.get("utm_campaign") ?? "")
    .trim()
    .toLowerCase();
  const campaignLine = CAMPAIGN_MESSAGE[campaignParam];
  const servingLine = cityParam
    ? `Serving ${cityParam}, Miami-Dade & surrounding areas`
    : "Serving Miami-Dade & Surrounding Areas";

  const whatsappLink = useMemo(() => {
    const text = encodeURIComponent(
      "Hi AcostasPool, I want a quote for professional pool maintenance."
    );
    return `https://wa.me/${PHONE_E164.replace("+", "")}?text=${text}`;
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ap:landing-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("ap:landing-density", density);
  }, [density]);

  useEffect(() => {
    const timer = window.setTimeout(() => setGalleryLoading(false), 850);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const root = shellRef.current;
    if (!root) {
      return;
    }

    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (typeof window.IntersectionObserver === "undefined") {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -10% 0px" }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const handleChange =
    (field: keyof QuoteFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      setSubmitState("idle");
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Partial<Record<keyof QuoteFormState, string>> = {};
    if (!form.name.trim()) {
      nextErrors.name = "Name is required.";
    }
    if (!form.address.trim()) {
      nextErrors.address = "Address is required.";
    }
    if (!form.poolType.trim()) {
      nextErrors.poolType = "Pool type is required.";
    }
    if (!form.phone.trim()) {
      nextErrors.phone = "Phone is required.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitState("saving");
    window.setTimeout(() => {
      setSubmitState("saved");
      setForm(emptyForm);
    }, 700);
  };

  return (
    <div
      ref={shellRef}
      className="marketing-shell"
      data-theme={theme}
      data-density={density}
    >
      <header className="marketing-header">
        <div className="marketing-container marketing-header-inner">
          <Link href="/" className="marketing-brand">
            <span className="marketing-brand-mark" aria-hidden="true" />
            <span>AcostasPool</span>
          </Link>
          <nav className="marketing-nav" aria-label="Primary">
            <a href="#services">Services</a>
            <a href="#process">How it works</a>
            <a href="#pricing">Plans</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="marketing-controls">
            <div className="marketing-toggle-set" aria-label="Theme">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="marketing-toggle-chip"
                  data-active={theme === option.id}
                  onClick={() => setTheme(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="marketing-toggle-set" aria-label="Density">
              {DENSITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="marketing-toggle-chip"
                  data-active={density === option.id}
                  onClick={() => setDensity(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="marketing-main">
        <section className="marketing-hero marketing-container" data-reveal>
          <div className="marketing-hero-grid">
            <div className="marketing-hero-copy">
              <p className="marketing-kicker">{servingLine}</p>
              <h1 className="marketing-h1">
                Professional Pool Maintenance You Can Trust
              </h1>
              <p className="marketing-subtitle">
                Weekly Service • Repairs • Chemical Balancing • Licensed &
                Insured
              </p>
              {campaignLine ? (
                <p className="marketing-campaign-note">{campaignLine}</p>
              ) : null}
              <div className="marketing-cta-group">
                <a className="marketing-btn marketing-btn-primary" href="#quote">
                  Request a Free Quote
                </a>
                <a
                  className="marketing-btn marketing-btn-secondary"
                  href={`tel:${PHONE_E164}`}
                >
                  Call Now
                </a>
              </div>
              <div className="marketing-proof-grid">
                <div className="marketing-proof-card">
                  <p className="marketing-proof-label">Weekly visits</p>
                  <p className="marketing-proof-value">180+</p>
                </div>
                <div className="marketing-proof-card">
                  <p className="marketing-proof-label">Avg response</p>
                  <p className="marketing-proof-value">&lt; 24h</p>
                </div>
                <div className="marketing-proof-card">
                  <p className="marketing-proof-label">Customer rating</p>
                  <p className="marketing-proof-value">4.9/5</p>
                </div>
              </div>
            </div>

            <aside className="marketing-hero-panel">
              <p className="marketing-panel-kicker">Lead snapshot</p>
              <h2 className="marketing-panel-title">Book your inspection</h2>
              <p className="marketing-panel-text">
                Get a tailored service plan for your pool size, equipment, and
                chemistry profile.
              </p>
              <ul className="marketing-checklist">
                <li>On-site assessment</li>
                <li>Transparent service scope</li>
                <li>No contract lock-in</li>
              </ul>
              <div className="marketing-panel-actions">
                <a className="marketing-btn marketing-btn-primary" href="#quote">
                  Get Quote
                </a>
                <a className="marketing-btn marketing-btn-ghost" href={whatsappLink}>
                  WhatsApp
                </a>
              </div>
              <p className="marketing-panel-meta">Call us now: {PHONE_DISPLAY}</p>
            </aside>
          </div>
        </section>

        <section className="marketing-section marketing-container" data-reveal>
          <p className="marketing-section-label">Trusted by local homeowners</p>
          <div className="marketing-logo-row" aria-label="Social proof">
            <span>South Miami Homes</span>
            <span>Coral Gables Residences</span>
            <span>Doral Family Pools</span>
            <span>Homestead Estates</span>
          </div>
        </section>

        <section
          id="services"
          className="marketing-section marketing-container"
          data-reveal
        >
          <div className="marketing-section-head">
            <p className="marketing-section-label">Services</p>
            <h2 className="marketing-h2">What we do, clearly defined</h2>
          </div>
          <div className="marketing-service-grid">
            {SERVICE_GROUPS.map((group) => (
              <article key={group.title} className="marketing-card">
                <h3 className="marketing-card-title">{group.title}</h3>
                <ul className="marketing-list">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-container" data-reveal>
          <div className="marketing-section-head">
            <p className="marketing-section-label">Why choose us</p>
            <h2 className="marketing-h2">Built on reliability and trust</h2>
          </div>
          <div className="marketing-trust-wrap">
            <ul className="marketing-trust-list">
              {TRUST_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="marketing-trust-panel">
              <p className="marketing-panel-kicker">Communication first</p>
              <p className="marketing-panel-text">
                You always get text/email updates after each visit, with service
                notes and next-step recommendations when needed.
              </p>
              <div className="marketing-mini-stats">
                <div>
                  <strong>Same tech teams</strong>
                  <span>consistent weekly routing</span>
                </div>
                <div>
                  <strong>Insured service</strong>
                  <span>licensed operation in Florida</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="process"
          className="marketing-section marketing-container"
          data-reveal
        >
          <div className="marketing-section-head">
            <p className="marketing-section-label">How it works</p>
            <h2 className="marketing-h2">Simple, clear, and fast</h2>
          </div>
          <ol className="marketing-process-grid">
            {PROCESS_STEPS.map((step, index) => (
              <li key={step} className="marketing-step-card">
                <span className="marketing-step-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="pricing"
          className="marketing-section marketing-container"
          data-reveal
        >
          <div className="marketing-section-head">
            <p className="marketing-section-label">Plans</p>
            <h2 className="marketing-h2">Plan structure before you call</h2>
          </div>
          <div className="marketing-pricing-grid">
            {PRICING.map((plan) => (
              <article key={plan.name} className="marketing-card">
                <h3 className="marketing-card-title">{plan.name}</h3>
                <p className="marketing-price-ideal">Ideal for {plan.idealFor}</p>
                <ul className="marketing-list">
                  {plan.includes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <a className="marketing-inline-link" href="#quote">
                  Request plan details
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-container" data-reveal>
          <div className="marketing-section-head">
            <p className="marketing-section-label">Service area</p>
            <h2 className="marketing-h2">Local coverage with fast routing</h2>
          </div>
          <div className="marketing-area-list">
            {AREAS.map((area) => (
              <span key={area} className="marketing-area-chip">
                {area}
              </span>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-container" data-reveal>
          <div className="marketing-section-head">
            <p className="marketing-section-label">Before & After</p>
            <h2 className="marketing-h2">Real service results</h2>
          </div>
          <div className="marketing-gallery-grid" aria-live="polite">
            {galleryLoading
              ? [1, 2, 3].map((item) => (
                  <div key={item} className="marketing-skeleton-card" />
                ))
              : [
                  "Green pool recovery",
                  "Tile line deep clean",
                  "Pump + filter restoration",
                ].map((title) => (
                  <article key={title} className="marketing-gallery-card">
                    <div className="marketing-gallery-visual">
                      <span>Before</span>
                      <span>After</span>
                    </div>
                    <h3>{title}</h3>
                    <p>Use your real field photos from your weekly routes.</p>
                  </article>
                ))}
          </div>
        </section>

        <section className="marketing-section marketing-container" data-reveal>
          <div className="marketing-section-head">
            <p className="marketing-section-label">Testimonials</p>
            <h2 className="marketing-h2">What clients say</h2>
          </div>
          <div className="marketing-testimonial-grid">
            {TESTIMONIALS.map((item) => (
              <blockquote key={item.author} className="marketing-card">
                <p className="marketing-quote">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <cite>{item.author}</cite>
              </blockquote>
            ))}
          </div>
        </section>

        <section
          id="contact"
          className="marketing-section marketing-container"
          data-reveal
        >
          <div className="marketing-contact-grid">
            <article id="quote" className="marketing-card marketing-contact-card">
              <p className="marketing-section-label">Quick quote form</p>
              <h2 className="marketing-h2">Request your free quote</h2>
              <form className="marketing-form" onSubmit={handleSubmit} noValidate>
                <label>
                  Name
                  <input
                    className="marketing-input"
                    value={form.name}
                    onChange={handleChange("name")}
                    autoComplete="name"
                  />
                  {errors.name ? <span className="marketing-error">{errors.name}</span> : null}
                </label>
                <label>
                  Address
                  <input
                    className="marketing-input"
                    value={form.address}
                    onChange={handleChange("address")}
                    autoComplete="street-address"
                  />
                  {errors.address ? (
                    <span className="marketing-error">{errors.address}</span>
                  ) : null}
                </label>
                <label>
                  Pool Type
                  <input
                    className="marketing-input"
                    value={form.poolType}
                    onChange={handleChange("poolType")}
                    placeholder="Residential, commercial, salt system..."
                  />
                  {errors.poolType ? (
                    <span className="marketing-error">{errors.poolType}</span>
                  ) : null}
                </label>
                <label>
                  Phone
                  <input
                    className="marketing-input"
                    value={form.phone}
                    onChange={handleChange("phone")}
                    autoComplete="tel"
                  />
                  {errors.phone ? (
                    <span className="marketing-error">{errors.phone}</span>
                  ) : null}
                </label>
                <label>
                  Additional details (optional)
                  <textarea
                    className="marketing-input marketing-textarea"
                    value={form.message}
                    onChange={handleChange("message")}
                    placeholder="Any urgency, equipment issue, or preferred day."
                  />
                </label>

                <button
                  type="submit"
                  className="marketing-btn marketing-btn-primary"
                  disabled={submitState === "saving"}
                >
                  {submitState === "saving" ? "Saving..." : "Request a Free Quote"}
                </button>
                {submitState === "saved" ? (
                  <p className="marketing-success">
                    Saved. Call or message us now to confirm your inspection.
                  </p>
                ) : null}
              </form>
            </article>

            <aside className="marketing-card marketing-contact-side">
              <p className="marketing-section-label">Direct contact</p>
              <h3 className="marketing-card-title">Talk to a specialist now</h3>
              <a className="marketing-btn marketing-btn-secondary" href={`tel:${PHONE_E164}`}>
                Call {PHONE_DISPLAY}
              </a>
              <a className="marketing-btn marketing-btn-ghost" href={whatsappLink}>
                WhatsApp
              </a>
              <a className="marketing-inline-link" href={`sms:${PHONE_E164}`}>
                Send SMS
              </a>
              <div className="marketing-hours">
                <p>Business hours</p>
                <p>Mon-Sat: 8:00 AM - 6:00 PM</p>
              </div>
              <p className="marketing-note">
                This page is optimized for mobile lead capture and local SEO.
              </p>
            </aside>
          </div>
        </section>
      </main>

      <div className="marketing-mobile-bar">
        <a className="marketing-btn marketing-btn-primary" href="#quote">
          Request Quote
        </a>
        <a className="marketing-btn marketing-btn-secondary" href={`tel:${PHONE_E164}`}>
          Call Now
        </a>
      </div>
    </div>
  );
}
