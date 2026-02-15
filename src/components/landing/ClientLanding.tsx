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

const PHONE_DISPLAY = "+1 (305) 555-0199";
const PHONE_E164 = "+13055550199";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=80";

const GALLERY_SLIDES = [
  {
    id: "1",
    title: "Resort-level water finish",
    image:
      "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?auto=format&fit=crop&w=2200&q=80",
  },
  {
    id: "2",
    title: "Balanced chemistry, every visit",
    image:
      "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=2200&q=80",
  },
  {
    id: "3",
    title: "Clean Water Built for Daily Life",
    image:
      "https://images.unsplash.com/photo-1600566752225-74fced6d4d2d?auto=format&fit=crop&w=2200&q=80",
  },
  {
    id: "4",
    title: "Luxury presentation, predictable service",
    image:
      "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=2200&q=80",
  },
];

const SERVICES = [
  "Weekly maintenance & cleaning",
  "Water chemistry management",
  "Equipment diagnostics & repair",
  "Storm recovery and deep cleanups",
];

const REVIEWS = [
  {
    author: "R. Martinez",
    zone: "Coral Gables",
    quote:
      "The service quality and consistency are on another level. Our pool always looks perfect.",
  },
  {
    author: "S. Henderson",
    zone: "Kendall",
    quote:
      "Fast communication, clean execution, and clear updates after every visit.",
  },
  {
    author: "A. Patel",
    zone: "Doral",
    quote:
      "They solved recurring chemistry issues in two weeks. Best decision for our property.",
  },
];

const FOOTER_LINKS = [
  {
    title: "Services",
    items: ["Weekly Maintenance", "Repairs", "Chemical Balancing", "Emergency Cleanup"],
  },
  {
    title: "Coverage",
    items: ["Miami", "Kendall", "Coral Gables", "Doral", "Homestead"],
  },
  {
    title: "Company",
    items: ["About AcostasPool", "Quality Promise", "Client Portal", "Contact"],
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

export default function ClientLanding({ socialLinks }: { socialLinks?: SocialLinks }) {
  const searchParams = useSearchParams();
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") {
      return "ocean";
    }
    return window.localStorage.getItem("ap:landing-theme-v2") === "night"
      ? "night"
      : "ocean";
  });
  const [activeSlide, setActiveSlide] = useState(0);
  const [pauseCarousel, setPauseCarousel] = useState(false);

  const cityParam = (searchParams.get("city") ?? "").trim();
  const servingLine = cityParam
    ? `${cityParam} + South Florida premium homes`
    : "South Florida premium homes";

  const defaultWhatsAppLink = useMemo(() => {
    const text = encodeURIComponent(
      "Hi AcostasPool, I want a professional pool maintenance plan."
    );
    return `https://wa.me/${PHONE_E164.replace("+", "")}?text=${text}`;
  }, []);
  const whatsappLink = socialLinks?.whatsappUrl || defaultWhatsAppLink;

  const youtubeVideoId = (process.env.NEXT_PUBLIC_LANDING_YOUTUBE_ID ?? "").trim();
  const youtubeSrc = `https://www.youtube-nocookie.com/embed/${
    youtubeVideoId || "M7lc1UVf-VE"
  }?rel=0&modestbranding=1`;

  const socialItems = useMemo(
    () =>
      [
        { id: "instagram", label: "Instagram", icon: "IG", href: socialLinks?.instagramUrl },
        { id: "facebook", label: "Facebook", icon: "FB", href: socialLinks?.facebookUrl },
        { id: "whatsapp", label: "WhatsApp", icon: "WA", href: socialLinks?.whatsappUrl },
        { id: "x", label: "X", icon: "X", href: socialLinks?.xUrl },
        { id: "youtube", label: "YouTube", icon: "YT", href: socialLinks?.youtubeUrl },
        { id: "tiktok", label: "TikTok", icon: "TT", href: socialLinks?.tiktokUrl },
      ].filter(
        (
          item
        ): item is {
          id: SocialPlatform;
          label: string;
          icon: string;
          href: string;
        } => Boolean(item.href)
      ),
    [socialLinks]
  );

  useEffect(() => {
    window.localStorage.setItem("ap:landing-theme-v2", theme);
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
          <Link href="/" className="lp-brand">
            <span className="lp-brand-dot" aria-hidden="true" />
            <span>AcostasPool</span>
          </Link>

          <div className="lp-header-right">
            <nav className="lp-nav" aria-label="Primary">
              <a href="#services">Services</a>
              <a href="#gallery">Gallery</a>
              <a href="#video">Video</a>
              <a href="#reviews">Reviews</a>
              <a href="#contact">Contact</a>
            </nav>

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

      <main className="lp-main">
        <section className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-kicker">Serving {servingLine}</p>
              <h1>Professional pool care with luxury-level consistency.</h1>
              <p>
                Premium weekly maintenance, chemistry control, and equipment care
                designed for South Florida properties.
              </p>
              <div className="lp-actions">
                <a href={whatsappLink} className="lp-btn lp-btn-primary">
                  Start on WhatsApp
                </a>
                <a href={`tel:${PHONE_E164}`} className="lp-btn lp-btn-ghost">
                  Call {PHONE_DISPLAY}
                </a>
              </div>

              <div className="lp-stats">
                <div>
                  <strong>24h</strong>
                  <span>Average response</span>
                </div>
                <div>
                  <strong>4.9/5</strong>
                  <span>Client satisfaction</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>Service-focused team</span>
                </div>
              </div>
            </div>

            <div className="lp-hero-media">
              <img src={HERO_IMAGE} alt="Luxury pool home in South Florida" />
            </div>
          </div>
        </section>

        <section id="services" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <p>Why clients choose us</p>
              <h2>Clear service structure, premium execution.</h2>
            </div>
            <div className="lp-service-grid">
              {SERVICES.map((service) => (
                <article key={service} className="lp-service-card">
                  <span aria-hidden="true" />
                  <p>{service}</p>
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
              className="lp-carousel"
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
              <p>Watch our process</p>
              <h2>See how we keep pools at a premium standard.</h2>
            </div>
            <div className="lp-video-card">
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
              <p>Client reviews</p>
              <h2>Trusted by homeowners across South Florida.</h2>
            </div>
            <div className="lp-review-grid">
              {REVIEWS.map((review) => (
                <article key={review.author} className="lp-review-card">
                  <div className="lp-review-stars">★★★★★</div>
                  <p className="lp-review-quote">&ldquo;{review.quote}&rdquo;</p>
                  <p className="lp-review-author">
                    {review.author} - {review.zone}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="lp-section lp-contact-section">
          <div className="lp-container">
            <div className="lp-contact-card">
              <div>
                <p className="lp-kicker">Contact</p>
                <h2>Ready to elevate your pool maintenance?</h2>
                <p className="lp-contact-copy">
                  Let us build a weekly plan that matches your property,
                  equipment, and quality expectations.
                </p>
              </div>
              <div className="lp-contact-actions">
                <a href={whatsappLink} className="lp-btn lp-btn-primary">
                  Request service plan
                </a>
                <a href={`tel:${PHONE_E164}`} className="lp-btn lp-btn-ghost">
                  Call now
                </a>
                <Link href="/login" className="lp-btn lp-btn-soft">
                  Client portal
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <Link href="/" className="lp-brand">
                <span className="lp-brand-dot" aria-hidden="true" />
                <span>AcostasPool</span>
              </Link>
              <p>
                Professional pool maintenance for South Florida homes and premium
                residential properties.
              </p>
              <p>{PHONE_DISPLAY}</p>
            </div>

            <div className="lp-footer-links">
              {FOOTER_LINKS.map((group) => (
                <div key={group.title}>
                  <h3>{group.title}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-footer-bottom">
            <p>© {new Date().getFullYear()} AcostasPool. All rights reserved.</p>
            {socialItems.length > 0 ? (
              <div className="lp-footer-social">
                {socialItems.map((social) => (
                  <a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    className="lp-social-link"
                    aria-label={social.label}
                    title={social.label}
                  >
                    <span>{social.icon}</span>
                    <span>{social.label}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
