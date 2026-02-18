import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSocialLinks } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "About AcostasPool | South Florida Pool Maintenance Team",
  description:
    "Learn how AcostasPool delivers consistent premium pool maintenance across South Florida with clear communication and detail-focused service standards.",
};

const PHONE_E164 = "+17865195059";
type PrincipleIconName = "shield" | "camera" | "route";
type FlowIconName = "request" | "plan" | "deliver";

const PRINCIPLES: Array<{ title: string; text: string; icon: PrincipleIconName }> = [
  {
    title: "Licensed and insured operation",
    text: "Compliance-first service model built for residential property standards in Florida.",
    icon: "shield",
  },
  {
    title: "Photo-backed transparency",
    text: "Each service visit can include visual notes and clear next-step recommendations.",
    icon: "camera",
  },
  {
    title: "Predictable service rhythm",
    text: "Structured routing and checklist execution for reliable pool quality week after week.",
    icon: "route",
  },
];

const FLOW_STEPS: Array<{ title: string; text: string; icon: FlowIconName }> = [
  {
    title: "Request",
    text: "You share your city, pool condition, and preferred service schedule.",
    icon: "request",
  },
  {
    title: "Plan",
    text: "We align service frequency, route timing, and equipment priorities for your property.",
    icon: "plan",
  },
  {
    title: "Deliver",
    text: "Our team executes with chemistry checks, visual quality control, and concise reporting.",
    icon: "deliver",
  },
];

const HISTORY_MILESTONES = [
  {
    year: "2019",
    title: "First recurring routes",
    text: "Started with a small group of residential clients focused on consistency and clean communication.",
  },
  {
    year: "2022",
    title: "Process standardization",
    text: "Introduced structured visit checklists and clearer diagnostic reporting for equipment and water balance.",
  },
  {
    year: "Today",
    title: "Commitment to premium care",
    text: "Serving South Florida properties with preventive maintenance and dependable weekly execution.",
  },
];

function AboutPrincipleIcon({ id }: { id: PrincipleIconName }) {
  if (id === "shield") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M12 3.5 5.8 6v5.7c0 4.5 2.6 7.6 6.2 8.8 3.6-1.2 6.2-4.3 6.2-8.8V6L12 3.5Z" />
        <path d="m9.5 11.9 1.6 1.6 3.4-3.4" />
      </svg>
    );
  }
  if (id === "camera") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4.5 8.2h15a2 2 0 0 1 2 2v6.3a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-6.3a2 2 0 0 1 2-2Z" />
        <path d="m9 8.2 1-2.2h4l1 2.2" />
        <circle cx="12" cy="13.3" r="2.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M3 17.8h6l2-3.5h10" />
      <path d="m4.6 12.6 4.3-4.3 2.5 2.5 4.8-4.8 2.2 2.2" />
      <circle cx="4.6" cy="12.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11.4" cy="10.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18.4" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AboutFlowIcon({ id }: { id: FlowIconName }) {
  if (id === "request") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2.8" />
        <path d="M8 9h8M8 12h8M8 15h4.6" />
      </svg>
    );
  }
  if (id === "plan") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M7.2 4.8v3.1M16.8 4.8v3.1M5 8h14" />
        <rect x="4.2" y="6.6" width="15.6" height="13.2" rx="2.5" />
        <path d="m9.4 14.1 1.8 1.8 3.4-3.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M5 15.4V9.2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6.2" />
      <path d="M4 15.4h16v2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.4v-2Z" />
      <path d="M10 11.3h4" />
    </svg>
  );
}

export default async function AboutPage() {
  const socialLinks = await getSiteSocialLinks();
  const whatsappLink =
    socialLinks.whatsappUrl ??
    `https://wa.me/${PHONE_E164.replace("+", "")}?text=${encodeURIComponent(
      "Hi AcostasPool, I would like to learn more about your service plans."
    )}`;

  return (
    <div className="lp-shell lp-about-page" data-theme="ocean">
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
            <Link href="/" className="lp-nav-link lp-nav-link-page">
              Home
            </Link>
            <Link href="/about" className="lp-nav-link" data-active="true">
              About
            </Link>
            <Link href="/contact" className="lp-nav-link lp-nav-link-page">
              Contact
            </Link>
          </nav>

          <div className="lp-header-actions">
            <Link href="/login" className="lp-login-btn">
              Client log in
            </Link>
          </div>
        </div>
      </header>

      <main className="lp-main">
        <section className="lp-section">
          <div className="lp-container">
            <article className="lp-about-hero lp-surface">
              <img
                src="/landing/media/curated/images/pool-home-services-hero-technician.jpg"
                alt="Pool technician performing service at a residential property"
              />
              <div className="lp-about-hero-overlay">
                <h1>About AcostasPool</h1>
                <p>
                  We provide premium weekly pool maintenance built on consistency, communication,
                  and technical detail for South Florida homes.
                </p>
                <div className="lp-actions">
                  <a href={whatsappLink} className="lp-btn lp-btn-primary">
                    Start on WhatsApp
                  </a>
                  <Link href="/contact" className="lp-btn lp-btn-ghost">
                    Contact us
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-about-story-layout">
            <article className="lp-about-story-copy lp-surface">
              <h2>Built on process, not guesswork.</h2>
              <p>
                Every property receives a service rhythm that matches its pool system, usage level,
                and seasonal demands. Our objective is simple: stable water quality, reliable
                communication, and clear expectations on every visit.
              </p>
              <ul>
                <li>Checklist-based service execution</li>
                <li>Chemistry-first corrective decisions</li>
                <li>Preventive equipment observations</li>
                <li>Consistent homeowner communication</li>
              </ul>
            </article>

            <div className="lp-about-story-media lp-surface">
              <img
                src="/landing/media/curated/images/pool-premium-residential-deck.jpg"
                alt="Residential swimming pool prepared for premium maintenance service"
              />
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-about-history-layout">
            <article className="lp-about-history-copy lp-surface">
              <h2>Our History and Commitment</h2>
              <p>
                AcostasPool grew from a simple objective: deliver premium pool care with reliable
                weekly discipline, not inconsistent one-off fixes.
              </p>
              <p>
                Our commitment remains the same on every property: stable water chemistry, clear
                technical communication, and service execution homeowners can trust long-term.
              </p>
            </article>

            <div className="lp-about-history-timeline">
              {HISTORY_MILESTONES.map((item) => (
                <article key={item.title} className="lp-about-history-step lp-surface">
                  <span>{item.year}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2>What defines our service quality.</h2>
            </div>

            <div className="lp-about-principles-grid">
              {PRINCIPLES.map((item) => (
                <article key={item.title} className="lp-about-principle lp-surface">
                  <span className="lp-about-principle-icon" aria-hidden="true">
                    <AboutPrincipleIcon id={item.icon} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2>How we work with homeowners.</h2>
            </div>

            <div className="lp-about-flow-grid">
              {FLOW_STEPS.map((step, index) => (
                <article key={step.title} className="lp-about-flow-step lp-surface">
                  <div className="lp-about-flow-head">
                    <span className="lp-about-flow-icon" aria-hidden="true">
                      <AboutFlowIcon id={step.icon} />
                    </span>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
