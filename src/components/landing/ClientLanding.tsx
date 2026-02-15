"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

type StoryScene = {
  id: string;
  title: string;
  label: string;
  image: string;
  speed: number;
};

const PHONE_DISPLAY = "+1 (305) 555-0199";
const PHONE_E164 = "+13055550199";

const STORY_SCENES: StoryScene[] = [
  {
    id: "precision",
    label: "South Florida Standard",
    title: "Water clarity managed with exact weekly precision.",
    image:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=2200&q=80",
    speed: 0.18,
  },
  {
    id: "hospitality",
    label: "Luxury Service Rhythm",
    title: "Every arrival feels resort-ready, every day of the week.",
    image:
      "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?auto=format&fit=crop&w=2200&q=80",
    speed: 0.15,
  },
  {
    id: "nightcare",
    label: "Operational Control",
    title: "Behind the scenes execution, visible quality in every visit.",
    image:
      "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=2200&q=80",
    speed: 0.2,
  },
];

const CAROUSEL_SLIDES = [
  {
    id: "villa",
    title: "Residential Signature Care",
    image:
      "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=2400&q=80",
  },
  {
    id: "waterline",
    title: "Tile, chemistry, and equipment harmony",
    image:
      "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=2400&q=80",
  },
  {
    id: "lifestyle",
    title: "Clean water built for daily lifestyle",
    image:
      "https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?auto=format&fit=crop&w=2400&q=80",
  },
  {
    id: "hospitality",
    title: "Professional standards, elevated presentation",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=2400&q=80",
  },
];

const THEME_CHOICES: Array<{ id: ThemeName; label: string }> = [
  { id: "ocean", label: "Light" },
  { id: "night", label: "Dark" },
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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") {
      return "ocean";
    }
    const saved = window.localStorage.getItem("ap:immersive-theme");
    return saved === "night" ? "night" : "ocean";
  });
  const [activeSlide, setActiveSlide] = useState(0);
  const [pauseCarousel, setPauseCarousel] = useState(false);

  const cityParam = (searchParams.get("city") ?? "").trim();
  const servingLine = cityParam
    ? `Serving ${cityParam} and South Florida premium homes`
    : "Serving South Florida premium homes";

  const defaultWhatsAppLink = useMemo(() => {
    const text = encodeURIComponent(
      "Hi AcostasPool, I want a premium maintenance plan for my pool."
    );
    return `https://wa.me/${PHONE_E164.replace("+", "")}?text=${text}`;
  }, []);
  const whatsappLink = socialLinks?.whatsappUrl || defaultWhatsAppLink;

  const footerSocialLinks = useMemo(
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
    window.localStorage.setItem("ap:immersive-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (pauseCarousel) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [pauseCarousel]);

  useEffect(() => {
    const root = shellRef.current;
    if (!root) {
      return;
    }

    const revealNodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]")
    );

    if (typeof window.IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
      );

      revealNodes.forEach((node) => observer.observe(node));
      return () => observer.disconnect();
    }

    revealNodes.forEach((node) => node.classList.add("is-visible"));
  }, []);

  useEffect(() => {
    const root = shellRef.current;
    if (!root) {
      return;
    }

    const parallaxNodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-parallax-speed]")
    );
    let rafId = 0;

    const updateParallax = () => {
      const viewportHeight = window.innerHeight || 900;
      parallaxNodes.forEach((node) => {
        const speed = Number(node.dataset.parallaxSpeed ?? "0.16");
        const rect = node.getBoundingClientRect();
        const relative =
          (rect.top + rect.height * 0.5 - viewportHeight * 0.5) / viewportHeight;
        const shift = relative * speed * -220;
        node.style.setProperty("--imm-parallax-shift", `${shift.toFixed(2)}px`);
      });
      rafId = 0;
    };

    const queueUpdate = () => {
      if (rafId !== 0) {
        return;
      }
      rafId = window.requestAnimationFrame(updateParallax);
    };

    queueUpdate();
    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);
    };
  }, []);

  return (
    <div ref={shellRef} className="imm-shell" data-theme={theme}>
      <div className="imm-theme-toggle" role="group" aria-label="Theme switcher">
        {THEME_CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className="imm-theme-toggle-btn"
            data-active={theme === choice.id}
            onClick={() => setTheme(choice.id)}
            aria-label={choice.label}
            title={choice.label}
          >
            {choice.id === "ocean" ? <SunIcon /> : <MoonIcon />}
          </button>
        ))}
      </div>

      <header className="imm-header">
        <Link href="/" className="imm-brand">
          <span className="imm-brand-mark" aria-hidden="true" />
          <span>AcostasPool</span>
        </Link>
        <nav className="imm-nav" aria-label="Primary">
          <a href="#story">Story</a>
          <a href="#gallery">Gallery</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main>
        <section className="imm-hero">
          <div
            className="imm-hero-media"
            data-parallax-speed="0.12"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=2600&q=80)",
            }}
          />
          <div className="imm-hero-overlay" />
          <div className="imm-hero-content" data-reveal>
            <p className="imm-hero-kicker">{servingLine}</p>
            <h1>Pool maintenance that feels like a five-star property experience.</h1>
            <div className="imm-hero-actions">
              <a href={whatsappLink} className="imm-btn imm-btn-primary">
                Start on WhatsApp
              </a>
              <a href={`tel:${PHONE_E164}`} className="imm-btn imm-btn-ghost">
                Call {PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </section>

        <section id="story" className="imm-story-wrap">
          {STORY_SCENES.map((scene, index) => (
            <article
              key={scene.id}
              className="imm-story-panel"
              data-reveal
              data-side={index % 2 === 0 ? "left" : "right"}
            >
              <div
                className="imm-story-media"
                data-parallax-speed={scene.speed}
                style={{ backgroundImage: `url(${scene.image})` }}
              />
              <div className="imm-story-overlay" />
              <div className="imm-story-caption">
                <p>{scene.label}</p>
                <h2>{scene.title}</h2>
              </div>
            </article>
          ))}
        </section>

        <section id="gallery" className="imm-carousel-section" data-reveal>
          <div
            className="imm-carousel-frame"
            onMouseEnter={() => setPauseCarousel(true)}
            onMouseLeave={() => setPauseCarousel(false)}
          >
            {CAROUSEL_SLIDES.map((slide, index) => (
              <article
                key={slide.id}
                className="imm-carousel-slide"
                data-active={index === activeSlide}
              >
                <div
                  className="imm-carousel-media"
                  style={{ backgroundImage: `url(${slide.image})` }}
                />
                <div className="imm-carousel-caption">
                  <p>{slide.title}</p>
                </div>
              </article>
            ))}

            <button
              type="button"
              className="imm-carousel-nav"
              data-dir="prev"
              onClick={() =>
                setActiveSlide(
                  (prev) =>
                    (prev - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length
                )
              }
              aria-label="Previous image"
            >
              <span aria-hidden="true">{"<"}</span>
            </button>
            <button
              type="button"
              className="imm-carousel-nav"
              data-dir="next"
              onClick={() => setActiveSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length)}
              aria-label="Next image"
            >
              <span aria-hidden="true">{">"}</span>
            </button>
          </div>

          <div className="imm-carousel-dots" role="tablist" aria-label="Gallery pagination">
            {CAROUSEL_SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={index === activeSlide}
                aria-label={`Show slide ${index + 1}`}
                className="imm-carousel-dot"
                data-active={index === activeSlide}
                onClick={() => setActiveSlide(index)}
              />
            ))}
          </div>
        </section>

        <section id="contact" className="imm-contact" data-reveal>
          <div
            className="imm-contact-media"
            data-parallax-speed="0.14"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=2200&q=80)",
            }}
          />
          <div className="imm-contact-overlay" />
          <div className="imm-contact-content">
            <p>Ready when you are</p>
            <h2>Your pool, professionally managed from this week forward.</h2>
            <div className="imm-contact-actions">
              <a href={whatsappLink} className="imm-btn imm-btn-primary">
                Request service plan
              </a>
              <Link href="/login" className="imm-btn imm-btn-ghost">
                Client portal
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="imm-footer" data-reveal>
        <p>AcostasPool | South Florida luxury pool care.</p>
        {footerSocialLinks.length > 0 ? (
          <div className="imm-social">
            {footerSocialLinks.map((social) => (
              <a
                key={social.id}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                className="imm-social-link"
                aria-label={social.label}
                title={social.label}
              >
                <span>{social.icon}</span>
                <span>{social.label}</span>
              </a>
            ))}
          </div>
        ) : null}
      </footer>
    </div>
  );
}
