import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSocialLinks } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Contact AcostasPool | South Florida Pool Maintenance",
  description:
    "Contact AcostasPool for premium weekly pool maintenance, equipment diagnostics, and chemistry management in South Florida.",
};

const PHONE_DISPLAY = "+1 (786) 519-5059";
const PHONE_E164 = "+17865195059";
const SUPPORT_EMAIL = "contact@acostaspool.com";

const COVERAGE_CITIES = [
  "Miami",
  "Kendall",
  "Coral Gables",
  "Doral",
  "Homestead",
  "Cutler Bay",
];

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
                src="https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=2400&q=80"
                alt="Premium pool and modern residential property"
              />
              <div className="lp-contact-hero-overlay">
                <h1>Contact AcostasPool</h1>
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
          <div className="lp-container lp-contact-grid-v2">
            <article className="lp-contact-card lp-surface">
              <h2>Fastest way to get a quote</h2>
              <ol className="lp-contact-steps">
                <li>Share your city and pool size.</li>
                <li>Tell us your current issue or maintenance goal.</li>
                <li>Pick your preferred contact method and service day.</li>
              </ol>
              <p className="lp-contact-note">Business hours: Monday to Saturday, 8:00 AM to 6:00 PM.</p>
            </article>

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
              <h2>Service area</h2>
              <ul className="lp-contact-coverage">
                {COVERAGE_CITIES.map((city) => (
                  <li key={city}>{city}</li>
                ))}
              </ul>
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
