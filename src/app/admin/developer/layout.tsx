import type { ReactNode } from "react";
import { requireDeveloper } from "@/lib/auth/guards";

export default async function DeveloperLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireDeveloper();
  return children;
}
