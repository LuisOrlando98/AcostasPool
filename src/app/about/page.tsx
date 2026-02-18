import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSocialLinks } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "About AcostasPool | South Florida Pool Maintenance Team",
  description:
    "Learn how AcostasPool delivers consistent premium pool maintenance across South Florida with clear communication and detail-focused service standards.",
};

const PHONE_E164 = "+17865195059";

const PRINCIPLES = [
  {
    title: "Licensed and insured operation",
    text: "Compliance-first service model built for residential property standards in Florida.",
    icon: "/landing/icons/trust-license.png",
  },
  {
    title: "Photo-backed transparency",
    text: "Each service visit can include visual notes and clear next-step recommendations.",
    icon: "/landing/icons/trust-photo.png",
  },
  {
    title: "Predictable service rhythm",
    text: "Structured routing and checklist execution for reliable pool quality week after week.",
    icon: "/landing/icons/trust-rhythm.png",
  },
];

const FLOW_STEPS = [
  {
    title: "Request",
    text: "You share your city, pool condition, and preferred service schedule.",
    icon: "/landing/icons/flow-request.png",
  },
  {
    title: "Plan",
    text: "We align service frequency, route timing, and equipment priorities for your property.",
    icon: "/landing/icons/flow-plan.png",
  },
  {
    title: "Deliver",
    text: "Our team executes with chemistry checks, visual quality control, and concise reporting.",
    icon: "/landing/icons/flow-deliver.png",
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
                src="https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?auto=format&fit=crop&w=2400&q=80"
                alt="Premium pool deck and palm trees in South Florida"
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
                src="https://images.unsplash.com/photo-1628534818423-4f59bdbf4df0?auto=format&fit=crop&w=2200&q=80"
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
                  <img src={item.icon} alt="" aria-hidden="true" />
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
                    <img src={step.icon} alt="" aria-hidden="true" />
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
