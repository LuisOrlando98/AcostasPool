export type UpdateEntry = {
  date: string;
  title: string;
  items: string[];
  tag?: string;
};

export const updates: UpdateEntry[] = [
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
