import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSocialLinks } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Contact AcostasPool | South Florida Pool Maintenance",
  description:
    "Contact AcostasPool for premium weekly pool maintenance, equipment diagnostics, and chemistry management in South Florida.",
};

const PHONE_DISPLAY = "+1 (305) 555-0199";
const PHONE_E164 = "+13055550199";
const SUPPORT_EMAIL = "contact@acostaspool.com";

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
            <span>AcostasPool</span>
          </Link>
          <div className="lp-header-right">
            <Link href="/" className="lp-nav-inline-link">
              Home
            </Link>
            <Link href="/login" className="lp-login-btn">
              Log in
            </Link>
          </div>
        </div>
      </header>

      <main className="lp-main">
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <p>Contact us</p>
              <h1 className="lp-contact-title">Let us design your maintenance plan.</h1>
            </div>

            <div className="lp-contact-layout">
              <article className="lp-contact-panel lp-surface">
                <h2>Direct channels</h2>
                <p>
                  Reach us directly and our team will confirm the best service window for your
                  property.
                </p>
                <div className="lp-contact-actions-list">
                  <a href={`tel:${PHONE_E164}`} className="lp-btn lp-btn-primary">
                    Call {PHONE_DISPLAY}
                  </a>
                  <a href={whatsappLink} className="lp-btn lp-btn-ghost">
                    WhatsApp
                  </a>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="lp-btn lp-btn-soft">
                    {SUPPORT_EMAIL}
                  </a>
                </div>
                <div className="lp-contact-meta">
                  <p>Business hours: Mon - Sat, 8:00 AM - 6:00 PM</p>
                  <p>Coverage: Miami, Kendall, Coral Gables, Doral, Homestead</p>
                </div>
              </article>

              <article className="lp-contact-panel lp-surface">
                <h2>What to have ready</h2>
                <ul className="lp-contact-checklist">
                  <li>Property address and preferred service day</li>
                  <li>Pool type and estimated size</li>
                  <li>Any current equipment or water issues</li>
                  <li>Photos or short video if available</li>
                </ul>
                <p className="lp-contact-note">
                  This helps us send a faster and more accurate service proposal.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
