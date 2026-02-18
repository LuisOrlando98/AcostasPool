import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSocialLinks } from "@/lib/site-settings";
import ContactRequestForm from "@/components/landing/ContactRequestForm";
import CoverageMapCard from "@/components/landing/CoverageMapCard";

export const metadata: Metadata = {
  title: "Contact AcostasPool | South Florida Pool Maintenance",
  description:
    "Contact AcostasPool for premium weekly pool maintenance, equipment diagnostics, and chemistry management in South Florida.",
};

const PHONE_DISPLAY = "+1 (786) 519-5059";
const PHONE_E164 = "+17865195059";
const SUPPORT_EMAIL = "contact@acostaspool.com";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21a9 9 0 1 0-4.5-1.2L4 21l1.3-3.3A9 9 0 0 0 12 21Z" />
      <path d="M9.3 8.8c.3-.3.5-.3.7.1l.6 1.3c.1.2.1.4-.1.6l-.5.5c-.2.2-.2.4 0 .6.3.6.8 1.1 1.4 1.4.2.1.4.1.6 0l.5-.5c.2-.2.4-.2.6-.1l1.3.6c.3.2.4.4.1.7l-.6.7c-.6.6-1.4.8-2.2.5-1.4-.5-2.7-1.7-3.7-3.1-.8-1.1-1.1-2.1-.7-2.9l.7-.8Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6.5 3.8h3l1.3 3.2-1.7 2.1a12.2 12.2 0 0 0 5.8 5.8l2.1-1.7 3.2 1.3v3a1.9 1.9 0 0 1-2.1 1.9C9.7 20.1 3.9 14.3 4.6 6a1.9 1.9 0 0 1 1.9-2.2Z" />
    </svg>
  );
}

export default async function ContactPage() {
  const socialLinks = await getSiteSocialLinks();
  const whatsappLink =
    socialLinks.whatsappUrl ??
    `https://wa.me/${PHONE_E164.replace("+", "")}?text=${encodeURIComponent(
      "Hi AcostasPool, I would like a premium pool maintenance quote."
    )}`;

  return (
    <div className="lp-shell lp-contact-page" data-theme="ocean">
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
            <Link href="/about" className="lp-nav-link lp-nav-link-page">
              About
            </Link>
            <Link href="/contact" className="lp-nav-link" data-active="true">
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
            <article className="lp-contact-hero lp-surface">
              <img
                src="/landing/media/curated/images/pool-service-weekly-technician.jpg"
                alt="Pool service technician cleaning a residential swimming pool"
              />
              <div className="lp-contact-hero-overlay">
                <h1>Get In Touch Now</h1>
                <p>
                  Tell us your pool location, current condition, and preferred schedule. We will
                  reply with a clear service recommendation.
                </p>
                <div className="lp-actions">
                  <a href={whatsappLink} className="lp-btn lp-btn-primary">
                    Start on WhatsApp
                  </a>
                  <a href={`tel:${PHONE_E164}`} className="lp-btn lp-btn-ghost">
                    Call {PHONE_DISPLAY}
                  </a>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="lp-btn lp-btn-ghost">
                    Send email
                  </a>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-contact-hub">
            <article className="lp-contact-hub-info lp-surface">
              <h2>Reach us directly</h2>
              <p>
                Choose your preferred channel or send your request using the form. We usually
                respond in less than 24 hours.
              </p>

              <div className="lp-contact-methods">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="lp-contact-method lp-contact-method-whatsapp"
                >
                  <span className="lp-contact-method-icon">
                    <WhatsAppIcon />
                  </span>
                  <span>
                    <strong>WhatsApp</strong>
                    <em>Start chat now</em>
                  </span>
                </a>

                <a href={`tel:${PHONE_E164}`} className="lp-contact-method">
                  <span className="lp-contact-method-icon">
                    <PhoneIcon />
                  </span>
                  <span>
                    <strong>Call us</strong>
                    <em>{PHONE_DISPLAY}</em>
                  </span>
                </a>
              </div>

              <div className="lp-contact-meta">
                <p>
                  <strong>Business hours:</strong> Monday to Saturday, 8:00 AM to 6:00 PM.
                </p>
                <p>
                  <strong>Direct inbox:</strong> {SUPPORT_EMAIL}
                </p>
              </div>
            </article>

            <article className="lp-contact-hub-form lp-surface">
              <ContactRequestForm />
            </article>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-contact-grid-v2">
            <CoverageMapCard />

            <article className="lp-contact-card lp-surface">
              <h2>What to include in your first message</h2>
              <ul className="lp-contact-checklist">
                <li>Pool size and current water condition</li>
                <li>Any equipment concerns you have noticed</li>
                <li>Preferred weekly service cadence</li>
                <li>Optional photos for faster evaluation</li>
              </ul>
            </article>

            <article className="lp-contact-card lp-surface">
              <h2>Need more details before booking?</h2>
              <p className="lp-contact-note">
                Learn how we organize route cadence, technical checks, and homeowner reporting
                before your first visit.
              </p>
              <Link href="/about" className="lp-btn lp-btn-soft">
                Learn about our team
              </Link>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
