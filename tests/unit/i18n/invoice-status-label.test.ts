import { describe, expect, it } from "vitest";
import { INVOICE_STATUSES } from "@/lib/constants";
import { translate, type Messages } from "@/i18n/translate";
import {
  INVOICE_STATUS_KEYS,
  getInvoiceStatusLabel,
} from "@/lib/invoices/status-label";

const echoKey = (key: string) => key;

const messages = {
  invoices: {
    status: { draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue" },
  },
} as unknown as Messages;

const t = (key: string) => translate(messages, key);

describe("getInvoiceStatusLabel", () => {
  it("maps every known status to its invoices.status key", () => {
    for (const status of INVOICE_STATUSES) {
      const expectedKey = `invoices.status.${status.toLowerCase()}`;
      expect(getInvoiceStatusLabel(status, echoKey)).toBe(expectedKey);
      expect(INVOICE_STATUS_KEYS[status]).toBe(expectedKey);
    }
  });

  it("returns the translated label through t()", () => {
    expect(getInvoiceStatusLabel("PAID", t)).toBe("Paid");
    expect(getInvoiceStatusLabel("OVERDUE", t)).toBe("Overdue");
    expect(getInvoiceStatusLabel("DRAFT", t)).toBe("Draft");
    expect(getInvoiceStatusLabel("SENT", t)).toBe("Sent");
  });

  it("returns the raw value for an unknown status and '' for an empty one", () => {
    expect(getInvoiceStatusLabel("REFUNDED", echoKey)).toBe("REFUNDED");
    expect(getInvoiceStatusLabel(null, echoKey)).toBe("");
    expect(getInvoiceStatusLabel(undefined, echoKey)).toBe("");
    expect(getInvoiceStatusLabel("", echoKey)).toBe("");
  });
});
