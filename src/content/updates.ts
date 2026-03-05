export type UpdateEntry = {
  date: string;
  title: string;
  items: string[];
  tag?: string;
};

export const updates: UpdateEntry[] = [
  {
    date: "2026-03-05",
    title: "Security hardening, notifications reliability, and responsive stability",
    tag: "Major",
    items: [
      "Hardened authentication/security with stricter JWT validation, hashed reset/invite tokens, and no-store headers on sensitive auth/session endpoints.",
      "Added security response headers globally (nosniff, frame deny, referrer policy, permissions policy, and production HSTS).",
      "Reworked multi-user notification targeting to avoid cross-user leaks and missing technician events using DB-level recipient filters plus stricter customer stream checks.",
      "Improved notifications UX reliability with centered filter modal behavior, proper overlay stacking, and robust body scroll locking to prevent stuck scroll states.",
      "Stabilized admin reports mobile/medium layouts, including single-line 'Showing' filter summary behavior and metric card text handling in constrained widths.",
      "Added lightweight local session cache for faster perceived UI response in account shell and notification feed refresh cycles.",
      "Normalized locale cookie handling across login/reset/complete-profile/account flows for safer, consistent language persistence.",
    ],
  },
  {
    date: "2026-03-03",
    title: "Landing mobile video reliability and footer alignment",
    tag: "UX",
    items: [
      "Optimized landing services background video loading for mobile by deferring load until section visibility and respecting reduced-motion/data-saver conditions.",
      "Added automatic fallback logic for background video source errors to prevent blank media states on slower phones.",
      "Centered footer legal/copyright layout and refined middle two-column alignment: selector column right-aligned and contact column left-aligned with divider.",
      "Fixed UTF-8 encoding integrity in admin customer detail page to prevent Render/Next.js production build failures.",
    ],
  },
  {
    date: "2026-03-03",
    title: "Invoice flow revamp and smarter job linking",
    tag: "Major",
    items: [
      "Redesigned admin invoice creation with structured line items (service, quantity, unit price, and line total) plus dynamic add/remove rows.",
      "Added automatic job preselection per customer using the latest completed job first, with fallback to the latest related job.",
      "Updated job dropdown labels to include schedule date, completion status, and service type for faster admin decisions.",
      "Implemented default 7% tax calculation with customer tax-exempt option and consistent subtotal/tax/total rounding on server side.",
      "Upgraded invoice PDF and web preview layout to use the horizontal brand logo and richer line-item table columns (Qty, Price, Amount).",
    ],
  },
  {
    date: "2026-02-28",
    title: "Customer portal profile and UX upgrade",
    tag: "Major",
    items: [
      "Merged customer My Profile and My Account into /client/profile with edit flows for personal data, security, avatar, and notification preferences.",
      "Added customer property self-edit forms and latest linked jobs per property with quick access to job details.",
      "Restricted version log visibility to admins and renamed updates navigation to Version log.",
      "Added request confirmation modal in client request flow with automatic redirect back to the client home.",
      "Improved admin routes calendar responsiveness for mobile and large screens, reducing overflow and improving desktop spacing.",
      "Updated application favicon and rounded logo usage in sidebar and header.",
      "Added notification backdrop overlay for better contrast while notification panel is open.",
    ],
  },
  {
    date: "2026-02-09",
    title: "Notifications overhaul",
    tag: "Major",
    items: [
      "Real-time notifications with user preferences.",
      "Read/unread states with daily grouping.",
      "Admin feed focused on completed jobs and customer requests.",
    ],
  },
];
