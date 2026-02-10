export type UpdateEntry = {
  date: string;
  title: string;
  items: string[];
  tag?: string;
};

export const updates: UpdateEntry[] = [
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
