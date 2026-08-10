import { revalidatePath } from "next/cache";

/**
 * Every page that reads property condition, contract status, or membership/
 * invoice payment status to compute a health flag. Call this any time one of
 * those underlying values changes so the customer list dot and the three
 * Reports tabs never show stale data.
 */
export function revalidateAttentionPaths(customerId?: string) {
  if (customerId) {
    revalidatePath(`/admin/customers/${customerId}`);
  }
  revalidatePath("/admin/customers");
  revalidatePath("/admin/reports/property-health");
  revalidatePath("/admin/reports/contracts");
  revalidatePath("/admin/reports/needs-attention");
}
