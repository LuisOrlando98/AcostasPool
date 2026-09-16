import { describe, expect, it, vi } from "vitest";
import {
  getNotificationDetail,
  getNotificationSource,
  getNotificationTitle,
} from "@/lib/notifications/view";
import { formatInBusinessTimeZone } from "@/lib/timezone";

const t = (key: string) => key;

const CREATED_AT = "2026-09-16T15:30:00Z";
const SCHEDULED_AT = "2026-09-20T13:00:00Z";
const COMPLETED_AT = "2026-09-17T18:45:00Z";

const fmt = (value: string, locale = "en") =>
  formatInBusinessTimeZone(new Date(value), locale, {
    dateStyle: "short",
    timeStyle: "short",
  });

describe("getNotificationTitle", () => {
  it.each([
    ["JOB_COMPLETED", "notifications.jobCompleted"],
    ["CUSTOMER_REQUEST", "notifications.customerRequest"],
    ["SERVICE_SCHEDULED", "notifications.serviceScheduled"],
    ["SERVICE_RESCHEDULED", "notifications.serviceRescheduled"],
    ["ROUTE_UPDATED", "notifications.routeUpdated"],
    ["INVOICE_SENT", "notifications.invoiceSent"],
  ])("translates %p through %p", (eventType, key) => {
    expect(getNotificationTitle(eventType, t)).toBe(key);
  });

  it("humanizes unknown event types by replacing underscores", () => {
    expect(getNotificationTitle("SOME_NEW_EVENT", t)).toBe("SOME NEW EVENT");
    expect(getNotificationTitle("plain", t)).toBe("plain");
  });

  it("calls the translator for every known title eagerly", () => {
    const spy = vi.fn((key: string) => key);
    getNotificationTitle("plain", spy);
    expect(spy).toHaveBeenCalledTimes(6);
  });
});

describe("getNotificationDetail", () => {
  describe("JOB_COMPLETED", () => {
    it("shows technician and completion time", () => {
      expect(
        getNotificationDetail(
          {
            eventType: "JOB_COMPLETED",
            createdAt: CREATED_AT,
            payload: { technicianName: "Luis", completedAt: COMPLETED_AT },
          },
          "en",
          t
        )
      ).toBe(`Luis - ${fmt(COMPLETED_AT)}`);
    });

    it("falls back to the team label and createdAt", () => {
      expect(
        getNotificationDetail(
          { eventType: "JOB_COMPLETED", createdAt: CREATED_AT, payload: null },
          "en",
          t
        )
      ).toBe(`notifications.source.team - ${fmt(CREATED_AT)}`);
    });

    it("omits the date when neither timestamp is valid", () => {
      expect(
        getNotificationDetail(
          { eventType: "JOB_COMPLETED", createdAt: "garbage" },
          "en",
          t
        )
      ).toBe("notifications.source.team");
    });
  });

  describe("CUSTOMER_REQUEST", () => {
    const payload = {
      requestedAt: CREATED_AT,
      reason: "Green water",
      count: 2,
      reviewRequired: true,
      partial: true,
      preferredDate: SCHEDULED_AT,
    };

    it("joins every part in English", () => {
      expect(
        getNotificationDetail(
          { eventType: "CUSTOMER_REQUEST", createdAt: CREATED_AT, payload },
          "en",
          t
        )
      ).toBe(
        `${fmt(CREATED_AT)} - Green water - 2 visit(s) - manual review - partial schedule - preferred: ${fmt(SCHEDULED_AT)}`
      );
    });

    it("uses Spanish words for es-* locales", () => {
      expect(
        getNotificationDetail(
          { eventType: "CUSTOMER_REQUEST", createdAt: CREATED_AT, payload },
          "es-MX",
          t
        )
      ).toBe(
        `${fmt(CREATED_AT, "es-MX")} - Green water - 2 visita(s) - revision manual - agenda parcial - preferida: ${fmt(SCHEDULED_AT, "es-MX")}`
      );
    });

    it("omits zero counts, false flags and uses the requested label by default", () => {
      expect(
        getNotificationDetail(
          {
            eventType: "CUSTOMER_REQUEST",
            createdAt: CREATED_AT,
            payload: { count: 0, reviewRequired: false, partial: "yes" },
          },
          "en",
          t
        )
      ).toBe(`${fmt(CREATED_AT)} - notifications.requested`);
    });
  });

  describe("SERVICE_SCHEDULED", () => {
    it("shows the scheduled date and optional flags", () => {
      expect(
        getNotificationDetail(
          {
            eventType: "SERVICE_SCHEDULED",
            createdAt: CREATED_AT,
            payload: { scheduledDate: SCHEDULED_AT, count: 3, reviewRequired: true },
          },
          "en",
          t
        )
      ).toBe(`${fmt(SCHEDULED_AT)} - 3 visit(s) - manual review`);
    });

    it("falls back to createdAt without payload", () => {
      expect(
        getNotificationDetail(
          { eventType: "SERVICE_SCHEDULED", createdAt: CREATED_AT },
          "en",
          t
        )
      ).toBe(fmt(CREATED_AT));
    });
  });

  describe("SERVICE_RESCHEDULED", () => {
    it("returns the scheduled date, then createdAt, then an empty string", () => {
      expect(
        getNotificationDetail(
          {
            eventType: "SERVICE_RESCHEDULED",
            createdAt: CREATED_AT,
            payload: { scheduledDate: SCHEDULED_AT },
          },
          "en",
          t
        )
      ).toBe(fmt(SCHEDULED_AT));
      expect(
        getNotificationDetail(
          { eventType: "SERVICE_RESCHEDULED", createdAt: CREATED_AT },
          "en",
          t
        )
      ).toBe(fmt(CREATED_AT));
      expect(
        getNotificationDetail(
          { eventType: "SERVICE_RESCHEDULED", createdAt: "bad" },
          "en",
          t
        )
      ).toBe("");
    });
  });

  describe("ROUTE_UPDATED", () => {
    it("translates known change types per locale", () => {
      const item = {
        eventType: "ROUTE_UPDATED",
        createdAt: CREATED_AT,
        payload: { changeType: "RESCHEDULED", scheduledDate: SCHEDULED_AT },
      };
      expect(getNotificationDetail(item, "en", t)).toBe(
        `Rescheduled - ${fmt(SCHEDULED_AT)}`
      );
      expect(getNotificationDetail(item, "es", t)).toBe(
        `Reprogramado - ${fmt(SCHEDULED_AT, "es")}`
      );
    });

    it("passes unknown change types through untouched", () => {
      expect(
        getNotificationDetail(
          {
            eventType: "ROUTE_UPDATED",
            createdAt: CREATED_AT,
            payload: { changeType: "SWAPPED" },
          },
          "en",
          t
        )
      ).toBe(`SWAPPED - ${fmt(CREATED_AT)}`);
    });
  });

  describe("INVOICE_SENT", () => {
    it("describes a successful delivery with invoice number and email", () => {
      expect(
        getNotificationDetail(
          {
            eventType: "INVOICE_SENT",
            createdAt: CREATED_AT,
            status: "SENT",
            payload: { invoiceNumber: "INV-1", email: "ana@x.com" },
          },
          "en",
          t
        )
      ).toBe("Invoice INV-1 - sent by email - to ana@x.com");
    });

    it("describes a failed delivery in Spanish", () => {
      expect(
        getNotificationDetail(
          {
            eventType: "INVOICE_SENT",
            createdAt: CREATED_AT,
            status: "FAILED",
            payload: { number: "INV-2" },
          },
          "es",
          t
        )
      ).toBe("Factura INV-2 - envio fallido");
    });

    it("falls back through invoiceNumber, number and invoiceNo", () => {
      expect(
        getNotificationDetail(
          {
            eventType: "INVOICE_SENT",
            createdAt: CREATED_AT,
            payload: { invoiceNo: "INV-3" },
          },
          "en",
          t
        )
      ).toBe("Invoice INV-3 - sent by email");
    });
  });

  it("returns the formatted createdAt for unknown events, or empty when invalid", () => {
    expect(
      getNotificationDetail({ eventType: "OTHER", createdAt: CREATED_AT }, "en", t)
    ).toBe(fmt(CREATED_AT));
    expect(
      getNotificationDetail({ eventType: "OTHER", createdAt: "" }, "en", t)
    ).toBe("");
  });

  it("ignores payload values with the wrong type", () => {
    expect(
      getNotificationDetail(
        {
          eventType: "SERVICE_SCHEDULED",
          createdAt: CREATED_AT,
          payload: { scheduledDate: 123, count: "3", reviewRequired: "true" },
        },
        "en",
        t
      )
    ).toBe(fmt(CREATED_AT));
  });
});

describe("getNotificationSource", () => {
  it("prefers the explicit customerName", () => {
    expect(
      getNotificationSource(
        {
          eventType: "INVOICE_SENT",
          createdAt: CREATED_AT,
          customerName: "Ana",
          payload: { technicianName: "Luis" },
        },
        t
      )
    ).toBe("Ana");
  });

  it.each([
    ["technicianName", "Luis"],
    ["actorName", "Admin"],
    ["requestedByName", "Requester"],
    ["customerName", "Customer"],
  ])("falls back to payload.%s", (field, value) => {
    expect(
      getNotificationSource(
        { eventType: "JOB_COMPLETED", createdAt: CREATED_AT, payload: { [field]: value } },
        t
      )
    ).toBe(value);
  });

  it("uses the billing source for invoices without a name", () => {
    expect(
      getNotificationSource({ eventType: "INVOICE_SENT", createdAt: CREATED_AT }, t)
    ).toBe("notifications.source.billing");
  });

  it("uses the operations source for route updates without a name", () => {
    expect(
      getNotificationSource(
        { eventType: "ROUTE_UPDATED", createdAt: CREATED_AT, payload: null },
        t
      )
    ).toBe("notifications.source.operations");
  });

  it("defaults to the team source", () => {
    expect(
      getNotificationSource(
        { eventType: "JOB_COMPLETED", createdAt: CREATED_AT, customerName: null },
        t
      )
    ).toBe("notifications.source.team");
  });

  it("ignores non-string name fields in the payload", () => {
    expect(
      getNotificationSource(
        { eventType: "JOB_COMPLETED", createdAt: CREATED_AT, payload: { technicianName: 7 } },
        t
      )
    ).toBe("notifications.source.team");
  });
});
