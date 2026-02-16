"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2600&q=80";

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

const CORE_SERVICES = [
  "Weekly maintenance and cleaning",
  "Water chemistry balancing",
  "Equipment diagnostics and repair",
  "Green-to-clean recovery and deep cleanups",
];

const PACKAGE_ITEMS = [
  "Skim, brush, and vacuum routine",
  "Filter and pump performance checks",
  "Water test and chemistry adjustment",
  "Service notes and recommendations",
];

const REVIEWS = [
  {
    author: "R. Martinez",
    zone: "Coral Gables",
    quote:
      "Consistent, professional, and detail-focused. The pool quality has stayed perfect.",
  },
  {
    author: "S. Henderson",
    zone: "Kendall",
    quote:
      "Excellent communication and clean execution. We always know what was done.",
  },
  {
    author: "A. Patel",
    zone: "Doral",
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
    items: ["About", "Why AcostasPool", "Reviews", "Careers"],
  },
  {
    title: "Support",
    items: ["Contact page", "Client portal", "FAQ", "Service areas"],
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4l16 16M20 4L4 20" />
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

  const cityParam = (searchParams.get("city") ?? "").trim();
  const servingLine = cityParam
    ? `${cityParam} + South Florida`
    : "South Florida";

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

  const socialItems = useMemo<SocialItem[]>(
    () =>
      [
        { id: "instagram", label: "Instagram", href: socialLinks?.instagramUrl ?? "" },
        { id: "x", label: "X", href: socialLinks?.xUrl ?? "" },
        { id: "youtube", label: "YouTube", href: socialLinks?.youtubeUrl ?? "" },
        { id: "facebook", label: "Facebook", href: socialLinks?.facebookUrl ?? "" },
        { id: "whatsapp", label: "WhatsApp", href: socialLinks?.whatsappUrl ?? "" },
        { id: "tiktok", label: "TikTok", href: socialLinks?.tiktokUrl ?? "" },
      ].filter((item) => Boolean(item.href)),
    [socialLinks]
  );

  useEffect(() => {
    window.localStorage.setItem("ap:landing-theme-v3", theme);
  }, [theme]);

  useEffect(() => {
    if (pauseCarousel) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % GALLERY_SLIDES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pauseCarousel]);

  return (
    <div className="lp-shell" data-theme={theme}>
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <div className="lp-brand-wrap">
            <Link href="/" className="lp-brand">
              <span className="lp-brand-dot" aria-hidden="true" />
              <span>AcostasPool</span>
            </Link>
            <span className="lp-brand-tag">Luxury Pool Care</span>
          </div>

          <div className="lp-header-right">
            <nav className="lp-nav" aria-label="Primary">
              <a href="#services">Services</a>
              <a href="#gallery">Gallery</a>
              <a href="#video">Video</a>
              <a href="#reviews">Reviews</a>
              <Link href="/contact">Contact</Link>
            </nav>

            <Link href="/login" className="lp-login-btn">
              Log in
            </Link>

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
          </div>
        </div>
      </header>

      <div className="lp-announce">
        <div className="lp-container">
          <p>
            Licensed and insured in Florida | Fast response windows | Premium weekly routes
          </p>
        </div>
      </div>

      <main className="lp-main">
        <section className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy lp-surface">
              <p className="lp-kicker">Serving {servingLine} premium homes</p>
              <h1>Professional pool care with luxury-level consistency.</h1>
              <p>
                A service model built around quality control, transparent communication, and
                dependable weekly execution.
              </p>
              <div className="lp-actions">
                <a href={whatsappLink} className="lp-btn lp-btn-primary">
                  Start on WhatsApp
                </a>
                <a href={`tel:${PHONE_E164}`} className="lp-btn lp-btn-ghost">
                  Call {PHONE_DISPLAY}
                </a>
                <Link href="/contact" className="lp-btn lp-btn-soft">
                  Contact us
                </Link>
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
                  <span>Service focus</span>
                </div>
              </div>
            </div>

            <div className="lp-hero-media lp-surface">
              <img src={HERO_IMAGE} alt="Luxury residential pool in South Florida" />
            </div>
          </div>
        </section>

        <section id="services" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <p>Service model</p>
              <h2>Clear structure, premium execution, measurable quality.</h2>
            </div>

            <div className="lp-service-grid">
              {CORE_SERVICES.map((service) => (
                <article key={service} className="lp-service-card lp-surface">
                  <span aria-hidden="true" />
                  <p>{service}</p>
                </article>
              ))}
            </div>

            <div className="lp-package lp-surface">
              <h3>What is included in a standard weekly package</h3>
              <ul>
                {PACKAGE_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
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
              onMouseEnter={() => setPauseCarousel(true)}
              onMouseLeave={() => setPauseCarousel(false)}
            >
              {GALLERY_SLIDES.map((slide, index) => (
                <article
                  key={slide.id}
                  className="lp-slide"
                  data-active={activeSlide === index}
                >
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
              <h2>See our service standards in action.</h2>
            </div>
            <div className="lp-video-card lp-surface">
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
                <article key={review.author} className="lp-review-card lp-surface">
                  <div className="lp-review-stars">5.0 rating</div>
                  <p className="lp-review-quote">&ldquo;{review.quote}&rdquo;</p>
                  <p className="lp-review-author">
                    {review.author} - {review.zone}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-cta-row">
          <div className="lp-container">
            <div className="lp-cta-card lp-surface">
              <div>
                <p className="lp-kicker">Need a proposal?</p>
                <h2>Contact us on a dedicated page with full intake details.</h2>
              </div>
              <div className="lp-cta-actions">
                <Link href="/contact" className="lp-btn lp-btn-primary">
                  Go to Contact page
                </Link>
                <Link href="/login" className="lp-btn lp-btn-ghost">
                  Client log in
                </Link>
              </div>
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
                <span>AcostasPool</span>
              </Link>
              <p>Professional maintenance for luxury and residential pools in South Florida.</p>
              <p>{PHONE_DISPLAY}</p>
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
            <p>© {new Date().getFullYear()} AcostasPool. All rights reserved.</p>
            <div className="lp-footer-meta-links">
              <Link href="/contact">Contact</Link>
              <Link href="/login">Log in</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
