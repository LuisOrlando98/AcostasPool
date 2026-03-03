import { requireRole } from "@/lib/auth/guards";
import { redirect } from "next/navigation";

export default async function TechProfilePage() {
  await requireRole("TECH");
  redirect("/account");
}
