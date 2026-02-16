"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { useSearchParams } from "next/navigation";

type ThemeName = "ocean" | "night";
type SocialPlatform =
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "x"
  | "youtube"
  | "tiktok";

type SocialLinks = {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  xUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
};

type SocialItem = {
  id: SocialPlatform;
  label: string;
  href: string;
};

const PHONE_DISPLAY = "+1 (305) 555-0199";
const PHONE_E164 = "+13055550199";
const SUPPORT_EMAIL = "contact@acostaspool.com";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?auto=format&fit=crop&w=2600&q=80";

const GALLERY_SLIDES = [
  {
    id: "pool-1",
    title: "Resort-level finish, every week",
    image:
      "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?auto=format&fit=crop&w=2400&q=80",
  },
  {
    id: "pool-2",
    title: "Tile, chemistry, and equipment harmony",
    image:
      "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=2400&q=80",
  },
  {
    id: "pool-3",
    title: "Clean Water Built for Daily Life",
    image:
      "https://images.unsplash.com/photo-1600566753051-f0b55746f8f6?auto=format&fit=crop&w=2400&q=80",
  },
  {
    id: "pool-4",
    title: "Premium presentation for every property",
    image:
      "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=2400&q=80",
  },
];

const NAV_ITEMS = [
  { id: "overview", label: "Home" },
  { id: "services", label: "Services" },
  { id: "gallery", label: "Gallery" },
  { id: "video", label: "Video" },
  { id: "reviews", label: "Reviews" },
  { id: "quote", label: "Contact" },
];

const TRUST_SIGNALS = [
  {
    title: "Licensed and insured",
    detail: "Florida-compliant operation for residential pool care.",
  },
  {
    title: "Photo-backed service notes",
    detail: "Each visit can include visual proof and status updates.",
  },
  {
    title: "Predictable weekly rhythm",
    detail: "Structured routes with quality checks and clear handoff.",
  },
];

const SERVICE_PILLARS = [
  {
    title: "Weekly Signature Care",
    subtitle: "For homeowners that want consistent crystal-clear water.",
    points: [
      "Surface skimming and brushing",
      "Vacuum and basket cleaning",
      "Water chemistry balance",
      "Equipment status review",
    ],
  },
  {
    title: "Repair and Recovery",
    subtitle: "For pumps, filters, and green-to-clean recovery windows.",
    points: [
      "Pump and filter diagnostics",
      "Storm and algae recovery",
      "Priority issue handling",
      "Repair recommendations",
    ],
  },
  {
    title: "Premium Property Standard",
    subtitle: "For homes that need high-end visual and technical consistency.",
    points: [
      "Detail-focused water polish",
      "Tile and circulation checks",
      "Preventive risk control",
      "Proactive maintenance notes",
    ],
  },
];

const SERVICE_FLOW = [
  {
    id: "01",
    title: "Request",
    text: "You share your location, pool details, and preferred service days.",
  },
  {
    id: "02",
    title: "Plan",
    text: "We align the best route window and maintenance cadence for your property.",
  },
  {
    id: "03",
    title: "Deliver",
    text: "Our team executes service visits with checks, notes, and continuity.",
  },
];

const REVIEWS = [
  {
    author: "R. Martinez",
    zone: "Coral Gables",
    rating: 5,
    service: "Weekly maintenance",
    quote:
      "Consistent, professional, and detail-focused. The pool quality has stayed perfect.",
  },
  {
    author: "S. Henderson",
    zone: "Kendall",
    rating: 5,
    service: "Chemistry recovery",
    quote:
      "Excellent communication and clean execution. We always know what was done.",
  },
  {
    author: "A. Patel",
    zone: "Doral",
    rating: 5,
    service: "Premium plan",
    quote:
      "They fixed recurring chemistry issues fast and built a reliable maintenance rhythm.",
  },
];

const FOOTER_LINK_GROUPS = [
  {
    title: "Services",
    items: ["Weekly plans", "Repairs", "Chemistry management", "Emergency cleanup"],
  },
  {
    title: "Company",
    items: ["About", "Why AcostasPool", "Reviews", "Coverage"],
  },
  {
    title: "Support",
    items: ["Client portal", "FAQ", "Service areas", "Get a quote"],
  },
  {
    title: "Coverage",
    items: ["Miami", "Kendall", "Coral Gables", "Doral", "Homestead"],
  },
];

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.1 14.8A8.7 8.7 0 1 1 9.2 3.9a7 7 0 1 0 10.9 10.9Z" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor">
      <path
        strokeWidth="1.7"
        d="m12 3.2 2.7 5.5 6 .9-4.3 4.2 1 5.9L12 16.8 6.6 19.7l1-5.9L3.3 9.6l6-.9L12 3.2Z"
      />
    </svg>
  );
}

function SocialIcon({ id }: { id: SocialPlatform }) {
  if (id === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.6" cy="6.4" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.3 21v-7h2.3l.4-2.7h-2.7V9.6c0-.8.2-1.4 1.3-1.4H16V5.8c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.1-3.2 3.3v2.3H8.8V14h2.1v7h2.4Z" />
      </svg>
    );
  }
  if (id === "x") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.2 3H21l-6.1 7 7.2 11h-5.7L12 14.4 6.2 21H3.4l6.5-7.4L3 3h5.8L12.8 9 18.2 3Zm-1 16.2h1.6L7.9 4.7H6.2l11 14.5Z" />
      </svg>
    );
  }
  if (id === "youtube") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.6 8.2a2.9 2.9 0 0 0-2-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.6.5a2.9 2.9 0 0 0-2 2.1C2 9.8 2 12 2 12s0 2.2.4 3.8a2.9 2.9 0 0 0 2 2.1c1.6.5 7.6.5 7.6.5s6 0 7.6-.5a2.9 2.9 0 0 0 2-2.1C22 14.2 22 12 22 12s0-2.2-.4-3.8ZM10 15.1V8.9L15.2 12 10 15.1Z" />
      </svg>
    );
  }
  if (id === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 21a9 9 0 1 0-4.5-1.2L4 21l1.3-3.3A9 9 0 0 0 12 21Z" />
        <path d="M9.3 8.8c.3-.3.5-.3.7.1l.6 1.3c.1.2.1.4-.1.6l-.5.5c-.2.2-.2.4 0 .6.3.6.8 1.1 1.4 1.4.2.1.4.1.6 0l.5-.5c.2-.2.4-.2.6-.1l1.3.6c.3.2.4.4.1.7l-.6.7c-.6.6-1.4.8-2.2.5-1.4-.5-2.7-1.7-3.7-3.1-.8-1.1-1.1-2.1-.7-2.9l.7-.8Z" />
      </svg>
    );
  }
  if (id === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.6 3h2.5c.2 1.6 1.1 2.8 2.5 3.3v2.4a6.1 6.1 0 0 1-2.5-1v6.1a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v2.5a3.2 3.2 0 1 0 2.3 3.1V3Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12h18M12 3v18" />
    </svg>
  );
}

export default function ClientLanding({ socialLinks }: { socialLinks?: SocialLinks }) {
  const searchParams = useSearchParams();
  const navPressTimer = useRef<number | null>(null);

  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") {
      return "ocean";
    }
    return window.localStorage.getItem("ap:landing-theme-v3") === "night"
      ? "night"
      : "ocean";
  });
  const [activeSlide, setActiveSlide] = useState(0);
  const [pauseCarousel, setPauseCarousel] = useState(false);
  const [activeNav, setActiveNav] = useState("overview");
  const [pressedNav, setPressedNav] = useState<string | null>(null);
  const [quoteStatus, setQuoteStatus] = useState("");
  const [quoteForm, setQuoteForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    service: "Weekly Signature Care",
    frequency: "Weekly",
    notes: "",
  });

  const cityParam = (searchParams.get("city") ?? "").trim();
  const servingLine = cityParam ? `${cityParam} + South Florida` : "South Florida";

  const defaultWhatsAppLink = useMemo(() => {
    const text = encodeURIComponent(
      "Hi AcostasPool, I want a premium maintenance plan for my pool."
    );
    return `https://wa.me/${PHONE_E164.replace("+", "")}?text=${text}`;
  }, []);
  const whatsappLink = socialLinks?.whatsappUrl || defaultWhatsAppLink;

  const youtubeVideoId = (process.env.NEXT_PUBLIC_LANDING_YOUTUBE_ID ?? "").trim();
  const youtubeSrc = `https://www.youtube-nocookie.com/embed/${
    youtubeVideoId || "M7lc1UVf-VE"
  }?rel=0&modestbranding=1`;

  const socialItems = useMemo<SocialItem[]>(() => {
    const items: SocialItem[] = [
      { id: "instagram", label: "Instagram", href: socialLinks?.instagramUrl ?? "" },
      { id: "x", label: "X", href: socialLinks?.xUrl ?? "" },
      { id: "youtube", label: "YouTube", href: socialLinks?.youtubeUrl ?? "" },
      { id: "facebook", label: "Facebook", href: socialLinks?.facebookUrl ?? "" },
      { id: "whatsapp", label: "WhatsApp", href: socialLinks?.whatsappUrl ?? "" },
      { id: "tiktok", label: "TikTok", href: socialLinks?.tiktokUrl ?? "" },
    ];
    return items.filter((item) => Boolean(item.href));
  }, [socialLinks]);

  useEffect(() => {
    window.localStorage.setItem("ap:landing-theme-v3", theme);
  }, [theme]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let candidate = "";
        let candidateRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= candidateRatio) {
            candidate = entry.target.id;
            candidateRatio = entry.intersectionRatio;
          }
        }
        if (candidate) {
          setActiveNav(candidate);
        }
      },
      {
        threshold: [0.25, 0.4, 0.6],
        rootMargin: "-18% 0px -42% 0px",
      }
    );

    for (const item of NAV_ITEMS) {
      const el = document.getElementById(item.id);
      if (el) {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const revealElements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-lp-reveal]")
    );
    if (revealElements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            currentObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
    );

    for (const element of revealElements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pauseCarousel) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % GALLERY_SLIDES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pauseCarousel]);

  useEffect(() => {
    return () => {
      if (navPressTimer.current) {
        window.clearTimeout(navPressTimer.current);
      }
    };
  }, []);

  function setQuoteField(field: keyof typeof quoteForm, value: string) {
    setQuoteForm((prev) => ({ ...prev, [field]: value }));
    if (quoteStatus) {
      setQuoteStatus("");
    }
  }

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, sectionId: string) {
    event.preventDefault();
    setPressedNav(sectionId);
    setActiveNav(sectionId);

    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (navPressTimer.current) {
      window.clearTimeout(navPressTimer.current);
    }
    navPressTimer.current = window.setTimeout(() => {
      setPressedNav(null);
    }, 220);
  }

  function handleQuoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = `Pool service quote request - ${quoteForm.city || "South Florida"}`;
    const body = [
      "Hi AcostasPool team,",
      "",
      "I would like to request a service quote.",
      "",
      `Name: ${quoteForm.name || "-"}`,
      `Email: ${quoteForm.email || "-"}`,
      `Phone: ${quoteForm.phone || "-"}`,
      `City/Area: ${quoteForm.city || "-"}`,
      `Service interest: ${quoteForm.service || "-"}`,
      `Preferred frequency: ${quoteForm.frequency || "-"}`,
      "",
      "Property notes:",
      quoteForm.notes || "-",
    ].join("\n");

    const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoHref;
    setQuoteStatus("Email draft ready. Send it and we will respond fast.");
  }

  return (
    <div className="lp-shell" data-theme={theme}>
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link href="/" className="lp-brand">
            <span className="lp-brand-dot" aria-hidden="true" />
            <span className="lp-brand-name">
              <span>Acostas</span>
              <span>Pool</span>
            </span>
          </Link>

          <nav className="lp-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="lp-nav-link"
                data-active={activeNav === item.id}
                data-pressed={pressedNav === item.id}
                onClick={(event) => handleNavClick(event, item.id)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="lp-header-actions">
            <div className="lp-theme-switch" role="group" aria-label="Theme">
              <button
                type="button"
                className="lp-theme-btn"
                data-active={theme === "ocean"}
                onClick={() => setTheme("ocean")}
                aria-label="Light theme"
                title="Light theme"
              >
                <SunIcon />
              </button>
              <button
                type="button"
                className="lp-theme-btn"
                data-active={theme === "night"}
                onClick={() => setTheme("night")}
                aria-label="Dark theme"
                title="Dark theme"
              >
                <MoonIcon />
              </button>
            </div>

            <Link href="/login" className="lp-login-btn">
              Client log in
            </Link>
          </div>
        </div>

        <div className="lp-announce">
          <div className="lp-container lp-announce-inner">
            <p>South Florida premium maintenance | Licensed and insured | Service-ready support</p>
          </div>
        </div>
      </header>

      <main className="lp-main">
        <section id="overview" className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy lp-surface" data-lp-reveal>
              <p className="lp-kicker">Serving {servingLine} premium homes</p>
              <h1>Professional pool care that feels effortless for your home.</h1>
              <p>
                Trusted maintenance plans, clear communication, and reliable weekly execution for
                South Florida properties.
              </p>

              <div className="lp-actions">
                <a href={whatsappLink} className="lp-btn lp-btn-primary">
                  Start on WhatsApp
                </a>
                <a href="#quote" className="lp-btn lp-btn-ghost">
                  Get a quote
                </a>
                <a href={`tel:${PHONE_E164}`} className="lp-btn lp-btn-ghost">
                  Call {PHONE_DISPLAY}
                </a>
              </div>

              <div className="lp-stats">
                <div>
                  <strong>&lt;24h</strong>
                  <span>Average response</span>
                </div>
                <div>
                  <strong>4.9/5</strong>
                  <span>Client rating</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>Service-focused team</span>
                </div>
              </div>
            </div>

            <div className="lp-hero-media lp-surface" data-lp-reveal>
              <img src={HERO_IMAGE} alt="Luxury residential pool in South Florida" />
            </div>
          </div>

          <div className="lp-container lp-trust-grid">
            {TRUST_SIGNALS.map((item) => (
              <article key={item.title} className="lp-trust-card lp-surface" data-lp-reveal>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="services" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <p>Service experience</p>
              <h2>Built to guide you clearly from request to recurring care.</h2>
            </div>

            <div className="lp-flow-grid">
              {SERVICE_FLOW.map((step) => (
                <article key={step.id} className="lp-flow-card lp-surface" data-lp-reveal>
                  <span>{step.id}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>

            <div className="lp-service-plan-grid">
              {SERVICE_PILLARS.map((pillar) => (
                <article
                  key={pillar.title}
                  className="lp-service-plan-card lp-surface"
                  data-lp-reveal
                >
                  <h3>{pillar.title}</h3>
                  <p>{pillar.subtitle}</p>
                  <ul>
                    {pillar.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="gallery" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <p>Visual quality</p>
              <h2>Clean Water Built for Daily Life.</h2>
            </div>

            <div
              className="lp-carousel lp-surface"
              data-lp-reveal
              onMouseEnter={() => setPauseCarousel(true)}
              onMouseLeave={() => setPauseCarousel(false)}
            >
              {GALLERY_SLIDES.map((slide, index) => (
                <article key={slide.id} className="lp-slide" data-active={activeSlide === index}>
                  <img src={slide.image} alt={slide.title} />
                  <div className="lp-slide-caption">{slide.title}</div>
                </article>
              ))}

              <button
                type="button"
                className="lp-slide-nav"
                data-dir="prev"
                onClick={() =>
                  setActiveSlide(
                    (prev) => (prev - 1 + GALLERY_SLIDES.length) % GALLERY_SLIDES.length
                  )
                }
                aria-label="Previous image"
              >
                <span>{"<"}</span>
              </button>

              <button
                type="button"
                className="lp-slide-nav"
                data-dir="next"
                onClick={() => setActiveSlide((prev) => (prev + 1) % GALLERY_SLIDES.length)}
                aria-label="Next image"
              >
                <span>{">"}</span>
              </button>
            </div>

            <div className="lp-slide-dots">
              {GALLERY_SLIDES.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className="lp-dot"
                  data-active={activeSlide === index}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Show image ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="video" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <p>Video</p>
              <h2>See the quality standard behind every service visit.</h2>
            </div>
            <div className="lp-video-card lp-surface" data-lp-reveal>
              <iframe
                src={youtubeSrc}
                title="AcostasPool service video"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        <section id="reviews" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <p>Reviews</p>
              <h2>Trusted by homeowners across South Florida.</h2>
            </div>
            <div className="lp-review-grid">
              {REVIEWS.map((review) => (
                <article key={review.author} className="lp-review-card lp-surface" data-lp-reveal>
                  <div className="lp-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <StarIcon key={`${review.author}-${index}`} filled={index < review.rating} />
                    ))}
                    <span>{review.rating.toFixed(1)}</span>
                  </div>
                  <p className="lp-review-quote">&ldquo;{review.quote}&rdquo;</p>
                  <p className="lp-review-service">{review.service}</p>
                  <p className="lp-review-author">
                    {review.author} | {review.zone}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="quote" className="lp-section lp-quote-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <p>Get a quote</p>
              <h2>Tell us what you need and get a faster service recommendation.</h2>
            </div>

            <div className="lp-quote-grid">
              <article className="lp-quote-info lp-surface" data-lp-reveal>
                <h3>Direct channels</h3>
                <p>
                  Use WhatsApp for fast intake, call us for urgent support, or send your details by
                  email.
                </p>

                <div className="lp-actions lp-quote-actions">
                  <a href={whatsappLink} className="lp-btn lp-btn-primary">
                    WhatsApp
                  </a>
                  <a href={`tel:${PHONE_E164}`} className="lp-btn lp-btn-ghost">
                    Call us
                  </a>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="lp-btn lp-btn-soft">
                    Email us
                  </a>
                </div>

                <ul className="lp-quote-list">
                  <li>Service area coverage: Miami, Kendall, Coral Gables, Doral, Homestead</li>
                  <li>Typical response: same day or next business day</li>
                  <li>Best results when we receive size, current condition, and goals</li>
                </ul>
              </article>

              <form className="lp-quote-form lp-surface" onSubmit={handleQuoteSubmit} data-lp-reveal>
                <h3>Send quote details by email</h3>

                <label>
                  Full name
                  <input
                    type="text"
                    value={quoteForm.name}
                    onChange={(event) => setQuoteField("name", event.target.value)}
                    placeholder="Your name"
                    required
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={quoteForm.email}
                    onChange={(event) => setQuoteField("email", event.target.value)}
                    placeholder="you@email.com"
                    required
                  />
                </label>

                <div className="lp-quote-form-row">
                  <label>
                    Phone
                    <input
                      type="tel"
                      value={quoteForm.phone}
                      onChange={(event) => setQuoteField("phone", event.target.value)}
                      placeholder="+1"
                    />
                  </label>

                  <label>
                    City
                    <input
                      type="text"
                      value={quoteForm.city}
                      onChange={(event) => setQuoteField("city", event.target.value)}
                      placeholder="City or area"
                    />
                  </label>
                </div>

                <div className="lp-quote-form-row">
                  <label>
                    Service
                    <select
                      value={quoteForm.service}
                      onChange={(event) => setQuoteField("service", event.target.value)}
                    >
                      <option>Weekly Signature Care</option>
                      <option>Premium Property Standard</option>
                      <option>Repair and Recovery</option>
                      <option>One-time Cleanup</option>
                    </select>
                  </label>

                  <label>
                    Frequency
                    <select
                      value={quoteForm.frequency}
                      onChange={(event) => setQuoteField("frequency", event.target.value)}
                    >
                      <option>Weekly</option>
                      <option>Twice per week</option>
                      <option>One-time visit</option>
                    </select>
                  </label>
                </div>

                <label>
                  Notes
                  <textarea
                    value={quoteForm.notes}
                    onChange={(event) => setQuoteField("notes", event.target.value)}
                    placeholder="Pool size, current issue, preferred day, or any details."
                    rows={4}
                  />
                </label>

                <button type="submit" className="lp-btn lp-btn-primary">
                  Prepare email quote request
                </button>

                {quoteStatus ? <p className="lp-quote-status">{quoteStatus}</p> : null}
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          {socialItems.length > 0 ? (
            <div className="lp-footer-follow">
              <p>Follow us</p>
              <div className="lp-footer-social-icons">
                {socialItems.map((social) => (
                  <a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    className="lp-social-icon-link"
                    aria-label={social.label}
                    title={social.label}
                  >
                    <SocialIcon id={social.id} />
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <Link href="/" className="lp-brand">
                <span className="lp-brand-dot" aria-hidden="true" />
                <span className="lp-brand-name">
                  <span>Acostas</span>
                  <span>Pool</span>
                </span>
              </Link>
              <p>Professional maintenance for luxury and residential pools in South Florida.</p>
              <p>{PHONE_DISPLAY}</p>
              <p>{SUPPORT_EMAIL}</p>
            </div>

            {FOOTER_LINK_GROUPS.map((group) => (
              <div key={group.title} className="lp-footer-col">
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="lp-footer-meta">
            <p>(c) {new Date().getFullYear()} AcostasPool. All rights reserved.</p>
            <div className="lp-footer-meta-links">
              <a href="#quote">Get a quote</a>
              <Link href="/login">Log in</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
