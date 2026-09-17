import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEMPLATE_CACHE_TTL_MS } from "@/lib/worker/constants";
import { createEmailTemplateSource, renderWorkerTemplate } from "@/lib/worker/email-templates";
import { asWorkerDb } from "./helpers";

const NOW = new Date("2026-09-17T14:00:00.000Z");
const CUSTOM_SUBJECT = "Visita confirmada - {{scheduled_label}}";

function createDbMock(emailTemplates: unknown = null) {
  return { siteSettings: { findUnique: vi.fn(async () => ({ emailTemplates })) } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createEmailTemplateSource", () => {
  it("reads SiteSettings once per TTL and falls back to the src/lib defaults", async () => {
    const db = createDbMock();
    const source = createEmailTemplateSource(asWorkerDb(db));

    const first = await source.load(NOW);
    await source.load(new Date(NOW.getTime() + TEMPLATE_CACHE_TTL_MS - 1));
    await source.load(new Date(NOW.getTime() + TEMPLATE_CACHE_TTL_MS));

    expect(db.siteSettings.findUnique).toHaveBeenCalledTimes(2);
    expect(db.siteSettings.findUnique).toHaveBeenCalledWith({
      where: { id: "default" },
      select: { emailTemplates: true },
    });
    expect(first.CUSTOMER_SERVICE_SCHEDULED.ES.subject).toBe(
      "Servicio confirmado - {{scheduled_label}}"
    );
    expect(first.CUSTOMER_SERVICE_SCHEDULED.EN.subject).toBe(
      "Service confirmed - {{scheduled_label}}"
    );
    expect(first.TECH_DAILY_DIGEST.EN.subject).toBe(
      "Ruta diaria confirmada - {{tech_name}} - {{route_date}}"
    );
  });

  it("applies the admin's customizations stored in SiteSettings", async () => {
    const db = createDbMock({
      CUSTOMER_SERVICE_SCHEDULED: { ES: { subject: CUSTOM_SUBJECT, text: "Hola {{customer_name}}" } },
    });
    const source = createEmailTemplateSource(asWorkerDb(db));

    const templates = await source.load(NOW);
    const rendered = renderWorkerTemplate(templates, "CUSTOMER_SERVICE_SCHEDULED", "ES", {
      customer_name: "Ana",
      scheduled_label: "18 sept 2026, 09:00 a.m.",
    });

    expect(rendered.subject).toBe("Visita confirmada - 18 sept 2026, 09:00 a.m.");
    expect(rendered.text).toBe("Hola Ana");
    expect(rendered.html).toContain("Hola Ana");
  });
});
