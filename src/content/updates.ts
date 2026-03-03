export type UpdateEntry = {
  date: string;
  title: string;
  items: string[];
  tag?: string;
};

export const updates: UpdateEntry[] = [
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
