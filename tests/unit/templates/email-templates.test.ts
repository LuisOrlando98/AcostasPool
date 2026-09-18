import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_IDS,
  buildPremiumEmailTemplateHtml,
  escapeHtml,
  getDefaultEmailTemplatesConfig,
  getDefaultLocalizedEmailTemplatesConfig,
  isEmailTemplateId,
  normalizeEmailTemplateContent,
  normalizeEmailTemplates,
  normalizeLocalizedEmailTemplates,
  renderEmailTemplate,
  resolveEmailTemplateLocale,
  type EmailTemplateContent,
  type EmailTemplateLocale,
} from "@/lib/email-templates";

// Tests de caracterizacion: fijan el comportamiento ACTUAL del modulo antes de refactorizar.

const EXPECTED_TEMPLATE_COUNT = 12;
const TOKEN_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
const PARAGRAPH_OPEN = '<p style="margin:0 0 12px;color:#334155;line-height:1.65;">';
const DEFAULT_ORIGIN = "https://acostaspool.com";

function collectTokens(content: EmailTemplateContent): string[] {
  const haystack = `${content.subject}\n${content.text}\n${content.html}`;
  const tokens = Array.from(haystack.matchAll(TOKEN_PATTERN), (match) => `{{${match[1]}}}`);
  return Array.from(new Set(tokens));
}

describe("EMAIL_TEMPLATE_IDS y EMAIL_TEMPLATE_DEFINITIONS", () => {
  it("define 12 ids unicos y una definicion completa para cada uno", () => {
    expect(EMAIL_TEMPLATE_IDS).toHaveLength(EXPECTED_TEMPLATE_COUNT);
    expect(new Set(EMAIL_TEMPLATE_IDS).size).toBe(EXPECTED_TEMPLATE_COUNT);

    for (const templateId of EMAIL_TEMPLATE_IDS) {
      const definition = EMAIL_TEMPLATE_DEFINITIONS[templateId];
      expect(definition.label.trim(), templateId).not.toBe("");
      expect(definition.description.trim(), templateId).not.toBe("");
      expect(definition.placeholders.length, templateId).toBeGreaterThan(0);
      expect(definition.defaults.subject.trim(), templateId).not.toBe("");
      expect(definition.defaults.text.trim(), templateId).not.toBe("");
      expect(definition.defaults.html, templateId).toContain("<div");
    }
  });

  it("cada placeholder usado en los defaults esta declarado y tiene valor de preview", () => {
    for (const templateId of EMAIL_TEMPLATE_IDS) {
      const definition = EMAIL_TEMPLATE_DEFINITIONS[templateId];

      for (const token of collectTokens(definition.defaults)) {
        expect(definition.placeholders, `${templateId} usa ${token} sin declararlo`).toContain(token);
      }
      for (const placeholder of definition.placeholders) {
        const key = placeholder.slice("{{".length, -"}}".length);
        expect(definition.previewValues, `${templateId} sin previewValue para ${placeholder}`).toHaveProperty(key);
      }
    }
  });
});

describe("escapeHtml", () => {
  it("escapa los cinco caracteres especiales de HTML y neutraliza payloads XSS", () => {
    expect(escapeHtml(`<a href="x" title='y'>Tom & Jerry</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;"
    );
    expect(escapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"
    );
    expect(escapeHtml('<img src=x onerror="alert(1)">')).not.toMatch(/[<>]/);
  });

  it("no altera texto sin caracteres especiales y vuelve a escapar entidades existentes", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml("Hola Mundo 123 {{token}}")).toBe("Hola Mundo 123 {{token}}");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
});

describe("resolveEmailTemplateLocale", () => {
  it("devuelve ES para valores que empiezan por 'es' (sin importar mayusculas ni espacios) y EN para el resto", () => {
    expect(resolveEmailTemplateLocale("ES")).toBe("ES");
    expect(resolveEmailTemplateLocale("es")).toBe("ES");
    expect(resolveEmailTemplateLocale(" es-MX ")).toBe("ES");
    expect(resolveEmailTemplateLocale("Espanol")).toBe("ES");

    expect(resolveEmailTemplateLocale(null)).toBe("EN");
    expect(resolveEmailTemplateLocale(undefined)).toBe("EN");
    expect(resolveEmailTemplateLocale("")).toBe("EN");
    expect(resolveEmailTemplateLocale("en-US")).toBe("EN");
    expect(resolveEmailTemplateLocale("fr")).toBe("EN");
    expect(resolveEmailTemplateLocale("SES")).toBe("EN");
  });
});

describe("isEmailTemplateId", () => {
  it("acepta solo ids exactos del catalogo", () => {
    expect(isEmailTemplateId("CUSTOMER_INVITE")).toBe(true);
    expect(isEmailTemplateId("TECH_CHANGE_DIGEST")).toBe(true);
    expect(isEmailTemplateId("customer_invite")).toBe(false);
    expect(isEmailTemplateId("UNKNOWN")).toBe(false);
    expect(isEmailTemplateId("")).toBe(false);
    expect(isEmailTemplateId(null)).toBe(false);
    expect(isEmailTemplateId(undefined)).toBe(false);
  });
});

describe("renderEmailTemplate", () => {
  const template: EmailTemplateContent = {
    subject: "Hi {{name}} - {{ number }}",
    text: "Link: {{link}}\nMissing: [{{missing}}]",
    html: "<p>{{name_html}}</p>",
  };

  it("interpola tokens en subject, text y html, tolera espacios dentro de las llaves y deja vacios los ausentes", () => {
    const rendered = renderEmailTemplate(template, {
      name: "Ana",
      number: "42",
      link: "https://x.test",
      name_html: "Ana",
    });

    expect(rendered.subject).toBe("Hi Ana - 42");
    expect(rendered.text).toBe("Link: https://x.test\nMissing: []");
    expect(rendered.html).toBe("<p>Ana</p>");
  });

  it("deja intactos los formatos de token no reconocidos", () => {
    const rendered = renderEmailTemplate(
      { subject: "{{a}}|{{a-b}}|{a}|{{{a}}}|{{ a b }}", text: "", html: "" },
      {}
    );

    expect(rendered.subject).toBe("|{{a-b}}|{a}|{}|{{ a b }}");
  });

  it("no es recursivo: el valor interpolado nunca se vuelve a interpolar", () => {
    const rendered = renderEmailTemplate(
      { subject: "{{a}}", text: "{{a}}", html: "{{a}}" },
      { a: "<b>{{b}}</b>", b: "nope" }
    );

    expect(rendered.subject).toBe("<b>{{b}}</b>");
    expect(rendered.text).toBe("<b>{{b}}</b>");
    expect(rendered.html).toBe("&lt;b&gt;{{b}}&lt;/b&gt;");
  });

  it("escapa los valores al interpolarlos en html y los deja crudos en subject y text", () => {
    const scriptPayload = "<script>alert('x')</script>";
    const imagePayload = '<img src=x onerror="alert(1)">';

    const rendered = renderEmailTemplate(
      { subject: "Hola {{a}}", text: "Hola {{a}} / {{b}}", html: "<p>{{a}}</p><p>{{b}}</p>" },
      { a: scriptPayload, b: imagePayload }
    );

    expect(rendered.subject).toBe(`Hola ${scriptPayload}`);
    expect(rendered.text).toBe(`Hola ${scriptPayload} / ${imagePayload}`);
    expect(rendered.html).toBe(
      `<p>${escapeHtml(scriptPayload)}</p><p>${escapeHtml(imagePayload)}</p>`
    );
    expect(rendered.html).not.toMatch(/<script|<img/i);
  });

  it("respeta las claves *_html: el llamante ya entrega HTML seguro y no se vuelve a escapar", () => {
    const rawName = "Tom & <Jerry>";

    const rendered = renderEmailTemplate(
      {
        subject: "{{name}}",
        text: "{{name}}\n{{lines_text}}",
        html: "<p>{{name_html}}</p><ol>{{lines_html}}</ol>",
      },
      {
        name: rawName,
        name_html: escapeHtml(rawName),
        lines_text: "1. Cliente <x>",
        lines_html: "<li>Cliente &lt;x&gt;</li>",
      }
    );

    expect(rendered.html).toBe("<p>Tom &amp; &lt;Jerry&gt;</p><ol><li>Cliente &lt;x&gt;</li></ol>");
    expect(rendered.subject).toBe(rawName);
    expect(rendered.text).toBe("Tom & <Jerry>\n1. Cliente <x>");
  });

  it("no muta la plantilla de entrada", () => {
    const frozen = Object.freeze({ subject: "{{a}}", text: "{{a}}", html: "{{a}}" });

    const rendered = renderEmailTemplate(frozen, { a: "x" });

    expect(frozen.subject).toBe("{{a}}");
    expect(rendered).not.toBe(frozen);
    expect(rendered).toEqual({ subject: "x", text: "x", html: "x" });
  });

  it("los tokens que coinciden con propiedades heredadas de Object se resuelven a vacio", () => {
    // interpolateTemplate resuelve solo propiedades propias (Object.hasOwn): "{{constructor}}"
    // ya no se convierte en "function Object() { [native code] }".
    const rendered = renderEmailTemplate(
      { subject: "{{constructor}}", text: "{{toString}}", html: "{{__proto__}}" },
      {}
    );

    expect(rendered.subject).toBe("");
    expect(rendered.text).toBe("");
    expect(rendered.html).toBe("");
  });

  it("si esas claves llegan como propiedad propia, se interpola el valor propio", () => {
    const rendered = renderEmailTemplate(
      { subject: "{{constructor}}", text: "{{toString}}", html: "<p>{{constructor}}</p>" },
      { constructor: "Ana", toString: "Luis" }
    );

    expect(rendered.subject).toBe("Ana");
    expect(rendered.text).toBe("Luis");
    expect(rendered.html).toBe("<p>Ana</p>");
  });
});

describe("getDefaultEmailTemplatesConfig / getDefaultLocalizedEmailTemplatesConfig", () => {
  it("devuelve una entrada por id con subject, text y html premium generado (no el html de la definicion)", () => {
    const config = getDefaultEmailTemplatesConfig();

    expect(Object.keys(config).sort()).toEqual([...EMAIL_TEMPLATE_IDS].sort());

    const invite = config.CUSTOMER_INVITE;
    expect(invite.subject).toBe("Welcome to AcostasPool - Complete your profile");
    expect(invite.text).toBe(EMAIL_TEMPLATE_DEFINITIONS.CUSTOMER_INVITE.defaults.text);
    expect(invite.html).toMatch(/^<!DOCTYPE html>/);
    expect(invite.html).not.toBe(EMAIL_TEMPLATE_DEFINITIONS.CUSTOMER_INVITE.defaults.html);
    expect(invite.html).toContain("Customer invite");
  });

  it("usa el copy ES cuando existe y cae al default (mismo texto) cuando no hay traduccion", () => {
    const es = getDefaultEmailTemplatesConfig("ES");
    const en = getDefaultEmailTemplatesConfig("EN");

    expect(es.CUSTOMER_INVITE.subject).toBe("Bienvenido a AcostasPool - Completa tu perfil");
    expect(es.INVOICE_SENT.text).toContain(
      "Has recibido una nueva factura de AcostasPool - {{invoice_number}} por {{invoice_total}}."
    );
    expect(en.INVOICE_SENT.text).toContain(
      "You have received a new invoice from AcostasPool - {{invoice_number}} for {{invoice_total}}."
    );

    // Plantillas sin traduccion: identicas en ambos idiomas
    expect(es.TECH_DAILY_DIGEST).toEqual(en.TECH_DAILY_DIGEST);
    expect(es.TECH_CHANGE_DIGEST).toEqual(en.TECH_CHANGE_DIGEST);
    expect(es.QUOTE_REQUEST).toEqual(en.QUOTE_REQUEST);
    expect(es.TECH_ACCOUNT_INVITE).toEqual(en.TECH_ACCOUNT_INVITE);

    // ...y el "EN" de los digests tecnicos esta redactado en espanol
    expect(en.TECH_DAILY_DIGEST.subject).toBe("Ruta diaria confirmada - {{tech_name}} - {{route_date}}");
  });

  it("la version localizada agrupa EN y ES por id y coincide con la version plana", () => {
    const localized = getDefaultLocalizedEmailTemplatesConfig();
    const en = getDefaultEmailTemplatesConfig("EN");
    const es = getDefaultEmailTemplatesConfig("ES");

    expect(Object.keys(localized).sort()).toEqual([...EMAIL_TEMPLATE_IDS].sort());
    for (const templateId of EMAIL_TEMPLATE_IDS) {
      expect(Object.keys(localized[templateId]).sort()).toEqual(["EN", "ES"]);
      expect(localized[templateId].EN).toEqual(en[templateId]);
      expect(localized[templateId].ES).toEqual(es[templateId]);
    }
  });
});

describe("buildPremiumEmailTemplateHtml", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("envuelve el cuerpo con cabecera (label + subject escapado), bloque de ayuda y pie legal", () => {
    vi.stubEnv("APP_URL", "");

    const html = buildPremiumEmailTemplateHtml("INVOICE_SENT", 'Invoice <"1">', "Body");

    expect(html).toMatch(/^<!DOCTYPE html><html lang="en">/);
    expect(html).toContain(">Invoice received</h2>");
    expect(html).toContain(">Invoice &lt;&quot;1&quot;&gt;</p>");
    expect(html).toContain(`${PARAGRAPH_OPEN}Body</p>`);
    expect(html).toContain("Need help?");
    expect(html).toContain(`href="${DEFAULT_ORIGIN}/legal"`);
    expect(html).toContain(`href="${DEFAULT_ORIGIN}/legal/privacy-policy"`);
    expect(html).toContain(`href="${DEFAULT_ORIGIN}/legal/terms-of-service"`);
    expect(html).toContain(`href="${DEFAULT_ORIGIN}/legal/payment-cancellation-policy"`);
    expect(html).toContain(`href="${DEFAULT_ORIGIN}/legal/disclaimer-limitation-of-liability"`);
    expect(html).toContain(`href="${DEFAULT_ORIGIN}/legal/cookie-notice"`);
    expect(html).toContain("Digitally signed by AcostasPool Operations Team");
  });

  it("construye los enlaces legales solo a partir del origen de APP_URL (sin ruta) y trata un valor sin esquema como no configurado", () => {
    vi.stubEnv("APP_URL", "https://app.acme.test/portal/index.html");
    expect(buildPremiumEmailTemplateHtml("INVOICE_SENT", "S", "B")).toContain(
      'href="https://app.acme.test/legal/terms-of-service"'
    );

    vi.stubEnv("APP_URL", " http://localhost:3000/admin ");
    expect(buildPremiumEmailTemplateHtml("INVOICE_SENT", "S", "B")).toContain(
      'href="http://localhost:3000/legal"'
    );

    // Sin esquema (p. ej. la direccion interna de Render "host:puerto") no es una URL publica valida:
    // se ignora y se usa el dominio por defecto, igual que hace getPublicAppUrl para el resto de enlaces.
    vi.stubEnv("APP_URL", "app.acme.test/portal/index.html");
    expect(buildPremiumEmailTemplateHtml("INVOICE_SENT", "S", "B")).toContain(
      `href="${DEFAULT_ORIGIN}/legal/terms-of-service"`
    );
  });

  it("cae al dominio por defecto cuando APP_URL no es una URL valida", () => {
    vi.stubEnv("APP_URL", "https://");

    expect(buildPremiumEmailTemplateHtml("INVOICE_SENT", "S", "B")).toContain(
      `href="${DEFAULT_ORIGIN}/legal"`
    );
  });

  it("convierte parrafos escapando HTML, omitiendo lineas vacias y conservando los tokens {{...}}", () => {
    const html = buildPremiumEmailTemplateHtml(
      "CUSTOMER_INVITE",
      "S",
      "Hi <b>{{customer_name}}</b>\r\n\r\n  Second line  \n"
    );

    expect(html).toContain(`${PARAGRAPH_OPEN}Hi &lt;b&gt;{{customer_name}}&lt;/b&gt;</p>`);
    expect(html).toContain(`${PARAGRAPH_OPEN}Second line</p>`);
    expect(html.split(PARAGRAPH_OPEN)).toHaveLength(2 + 1);
    expect(html).not.toContain("{{customer_name_html}}");
  });

  it("convierte una linea que solo contiene {{invite_link}} o {{reset_link}} en un boton con etiqueta por plantilla", () => {
    const customer = buildPremiumEmailTemplateHtml("CUSTOMER_INVITE", "S", "Intro\n{{invite_link}}\nOutro");
    expect(customer).toContain('<a href="{{invite_link}}"');
    expect(customer).toContain("background-color:#18b978;");
    expect(customer).toContain(">Complete profile</a>");

    const tech = buildPremiumEmailTemplateHtml("TECH_ACCOUNT_INVITE", "S", "{{invite_link}}");
    expect(tech).toContain(">Complete account</a>");

    const reset = buildPremiumEmailTemplateHtml("PASSWORD_RESET", "S", "{{reset_link}}");
    expect(reset).toContain('<a href="{{reset_link}}"');
    expect(reset).toContain(">Reset password</a>");
    expect(reset).toContain("background-color:#0ea5e9;");

    // Si el token no ocupa toda la linea, se trata como parrafo normal
    const inline = buildPremiumEmailTemplateHtml("PASSWORD_RESET", "S", "Use this link: {{reset_link}}");
    expect(inline).not.toContain('<a href="{{reset_link}}"');
    expect(inline).toContain(`${PARAGRAPH_OPEN}Use this link: {{reset_link}}</p>`);
  });

  it("convierte {{lines_text}} en <ol>{{lines_html}}</ol> para digests tecnicos y en parrafo para el resto", () => {
    const digest = buildPremiumEmailTemplateHtml("TECH_DAILY_DIGEST", "S", "Hola\n{{lines_text}}");
    expect(digest).toContain(
      '<ol style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.6;">{{lines_html}}</ol>'
    );
    expect(digest).not.toContain("{{lines_text}}");

    const other = buildPremiumEmailTemplateHtml("INVOICE_SENT", "S", "{{lines_text}}");
    expect(other).toContain(`${PARAGRAPH_OPEN}{{lines_text}}</p>`);
    expect(other).not.toContain("{{lines_html}}");
  });

  it("agrupa lineas con guion, asterisco o numero en una lista <ul> y la cierra ante un parrafo", () => {
    const html = buildPremiumEmailTemplateHtml(
      "INVOICE_SENT",
      "S",
      "- one\n* two <x>\n3. three\nPara\n- four"
    );
    const lists = html.match(/<ul [^>]*>[\s\S]*?<\/ul>/g) ?? [];

    expect(lists).toHaveLength(2);
    expect(lists[0]).toBe(
      '<ul style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.6;"><li style="margin:0 0 6px;">one</li><li style="margin:0 0 6px;">two &lt;x&gt;</li><li style="margin:0 0 6px;">three</li></ul>'
    );
    expect(lists[1]).toContain('<li style="margin:0 0 6px;">four</li>');
    expect(html.indexOf(`${PARAGRAPH_OPEN}Para</p>`)).toBeGreaterThan(html.indexOf(lists[0] ?? ""));
  });

  it("el HTML premium no inserta sin escapar los valores de los tokens de texto plano", () => {
    // El HTML premium se genera desde `text`, que usa {{customer_name}}: renderEmailTemplate
    // escapa esos valores antes de interpolarlos, asi que el valor crudo no llega al HTML.
    const rawName = '<img src=x onerror="alert(1)">';
    const template = getDefaultEmailTemplatesConfig("EN").CUSTOMER_INVITE;

    const rendered = renderEmailTemplate(template, {
      customer_name: rawName,
      customer_name_html: escapeHtml(rawName),
      invite_link: "https://x.test",
      invite_hours: "48",
    });

    expect(rendered.html).not.toContain(rawName);
    expect(rendered.html).not.toMatch(/<img/i);
    expect(rendered.html).toContain(`${PARAGRAPH_OPEN}Hi ${escapeHtml(rawName)},</p>`);
    expect(rendered.text).toContain(`Hi ${rawName},`);
  });

  it("escapa un nombre con <script> en el HTML y lo deja literal en el texto plano", () => {
    const rawName = "<script>alert('x')</script>";
    const template = getDefaultEmailTemplatesConfig("EN").CUSTOMER_INVITE;

    const rendered = renderEmailTemplate(template, {
      customer_name: rawName,
      customer_name_html: escapeHtml(rawName),
      invite_link: "https://x.test",
      invite_hours: "48",
    });

    expect(rendered.html).not.toContain("<script");
    expect(rendered.html).toContain(`${PARAGRAPH_OPEN}Hi ${escapeHtml(rawName)},</p>`);
    expect(rendered.text).toContain(`Hi ${rawName},`);
  });

  it("conserva el markup de {{lines_html}} en los digests y escapa el resto de valores", () => {
    const rawName = "Carlos <Diaz>";
    const template = getDefaultEmailTemplatesConfig("EN").TECH_DAILY_DIGEST;

    const rendered = renderEmailTemplate(template, {
      tech_name: rawName,
      tech_name_html: escapeHtml(rawName),
      route_date: "03/01/2026",
      lines_text: "1. Cliente <x>",
      lines_html: "<li>Cliente &lt;x&gt;</li>",
    });

    expect(rendered.html).toContain("<li>Cliente &lt;x&gt;</li>");
    expect(rendered.html).toContain(`Hola ${escapeHtml(rawName)},`);
    expect(rendered.html).not.toContain(rawName);
    expect(rendered.text).toContain(`Hola ${rawName},`);
  });

  it("no escapa el asunto: es texto plano aunque el cuerpo HTML si escape el mismo valor", () => {
    const rawName = "Tom & <Jerry>";
    const template = getDefaultEmailTemplatesConfig("EN").QUOTE_REQUEST;

    const rendered = renderEmailTemplate(template, {
      ...EMAIL_TEMPLATE_DEFINITIONS.QUOTE_REQUEST.previewValues,
      name: rawName,
      name_html: escapeHtml(rawName),
    });

    expect(rendered.subject).toBe("New quote request - Doral - Tom & <Jerry>");
    expect(rendered.subject).not.toContain("&amp;");
    expect(rendered.subject).not.toContain("&lt;");
    expect(rendered.html).toContain(`Name: ${escapeHtml(rawName)}`);
  });
});

describe("normalizeEmailTemplateContent", () => {
  const fallback: EmailTemplateContent = { subject: "FS", text: "FT", html: "FH" };

  it("devuelve una copia del fallback para null, undefined y no-objetos", () => {
    expect(normalizeEmailTemplateContent(null, fallback)).toEqual(fallback);
    expect(normalizeEmailTemplateContent(null, fallback)).not.toBe(fallback);
    expect(normalizeEmailTemplateContent(undefined, fallback)).toEqual(fallback);
    expect(normalizeEmailTemplateContent("x", fallback)).toEqual(fallback);
    expect(normalizeEmailTemplateContent(7, fallback)).toEqual(fallback);
  });

  it("mezcla campo a campo: null/undefined caen al fallback, otros valores se convierten a string", () => {
    expect(normalizeEmailTemplateContent({ subject: "S", text: null, html: 123 }, fallback)).toEqual({
      subject: "S",
      text: "FT",
      html: "123",
    });
    expect(normalizeEmailTemplateContent({ subject: "", extra: "ignored" }, fallback)).toEqual({
      subject: "",
      text: "FT",
      html: "FH",
    });
    expect(normalizeEmailTemplateContent({ subject: { nested: true } }, fallback).subject).toBe(
      "[object Object]"
    );
  });
});

describe("normalizeLocalizedEmailTemplates", () => {
  it("devuelve los defaults localizados para entradas vacias o invalidas e ignora ids desconocidos", () => {
    const defaults = getDefaultLocalizedEmailTemplatesConfig();

    expect(normalizeLocalizedEmailTemplates(null)).toEqual(defaults);
    expect(normalizeLocalizedEmailTemplates("x")).toEqual(defaults);

    const result = normalizeLocalizedEmailTemplates({
      UNKNOWN: { EN: { subject: "x" } },
      CUSTOMER_INVITE: "no-objeto",
    });
    expect(result).toEqual(defaults);
    expect(result).not.toHaveProperty("UNKNOWN");
  });

  it("con forma localizada, copia el idioma presente al ausente y regenera el html desde text", () => {
    const result = normalizeLocalizedEmailTemplates({
      INVOICE_SENT: {
        EN: { subject: "Custom subject", text: "Custom body {{invoice_number}}", html: "<custom/>" },
      },
    });

    expect(result.INVOICE_SENT.EN.subject).toBe("Custom subject");
    expect(result.INVOICE_SENT.EN.text).toBe("Custom body {{invoice_number}}");
    expect(result.INVOICE_SENT.EN.html).not.toContain("<custom/>");
    expect(result.INVOICE_SENT.EN.html).toContain("Custom body {{invoice_number}}</p>");

    expect(result.INVOICE_SENT.ES.subject).toBe("Custom subject");
    expect(result.INVOICE_SENT.ES.text).toBe("Custom body {{invoice_number}}");

    expect(result.CUSTOMER_INVITE).toEqual(getDefaultLocalizedEmailTemplatesConfig().CUSTOMER_INVITE);
  });

  it("con forma legacy (sin EN/ES) detecta el idioma por pistas y rellena el otro con defaults", () => {
    const defaults = getDefaultLocalizedEmailTemplatesConfig().INVOICE_SENT;

    const spanish = normalizeLocalizedEmailTemplates({
      INVOICE_SENT: { subject: "Tu factura {{invoice_number}}", text: "Hola {{customer_name}}, gracias." },
    });
    expect(spanish.INVOICE_SENT.ES.subject).toBe("Tu factura {{invoice_number}}");
    expect(spanish.INVOICE_SENT.ES.text).toBe("Hola {{customer_name}}, gracias.");
    expect(spanish.INVOICE_SENT.EN).toEqual(defaults.EN);

    const english = normalizeLocalizedEmailTemplates({
      INVOICE_SENT: { subject: "Your invoice {{invoice_number}}", text: "Hi {{customer_name}}, thanks." },
    });
    expect(english.INVOICE_SENT.EN.subject).toBe("Your invoice {{invoice_number}}");
    expect(english.INVOICE_SENT.EN.text).toBe("Hi {{customer_name}}, thanks.");
    expect(english.INVOICE_SENT.ES).toEqual(defaults.ES);
  });

  it("alinea el subject con el cuerpo: subject vacio, o en idioma distinto al del cuerpo cuando el cuerpo coincide con el slot, cae al default", () => {
    const defaults = getDefaultLocalizedEmailTemplatesConfig().INVOICE_SENT;

    const emptySubject = normalizeLocalizedEmailTemplates({
      INVOICE_SENT: { EN: { subject: "   ", text: "Hi there" } },
    });
    expect(emptySubject.INVOICE_SENT.EN.subject).toBe(defaults.EN.subject);
    expect(emptySubject.INVOICE_SENT.ES.subject).toBe(defaults.ES.subject);

    const mismatched = normalizeLocalizedEmailTemplates({
      INVOICE_SENT: {
        EN: { subject: "Servicio confirmado", text: "Hi {{customer_name}}, your invoice is attached." },
      },
    });
    expect(mismatched.INVOICE_SENT.EN.subject).toBe(defaults.EN.subject);

    // Si el cuerpo NO esta en el idioma del slot, el subject se conserva aunque difiera del cuerpo
    const bodyInOtherLocale = normalizeLocalizedEmailTemplates({
      INVOICE_SENT: { EN: { subject: "Welcome", text: "Hola {{customer_name}}, gracias." } },
    });
    expect(bodyInOtherLocale.INVOICE_SENT.EN.subject).toBe("Welcome");
  });

  it("no muta la entrada", () => {
    const input = Object.freeze({
      INVOICE_SENT: Object.freeze({ EN: Object.freeze({ subject: "S", text: "T" }) }),
    });

    expect(() => normalizeLocalizedEmailTemplates(input)).not.toThrow();
    expect(input.INVOICE_SENT.EN).toEqual({ subject: "S", text: "T" });
  });
});

describe("normalizeEmailTemplates", () => {
  it("aplana la configuracion localizada al idioma pedido (EN por defecto)", () => {
    const es = normalizeEmailTemplates(null, "ES");
    const en = normalizeEmailTemplates(null);

    expect(Object.keys(es).sort()).toEqual([...EMAIL_TEMPLATE_IDS].sort());
    expect(es.CUSTOMER_INVITE.subject).toBe("Bienvenido a AcostasPool - Completa tu perfil");
    expect(en.CUSTOMER_INVITE.subject).toBe("Welcome to AcostasPool - Complete your profile");
  });

  it("respeta overrides localizados y cae a EN para un locale desconocido", () => {
    const value = {
      INVOICE_SENT: {
        EN: { subject: "EN subject", text: "Hi" },
        ES: { subject: "Asunto ES", text: "Hola" },
      },
    };
    const unknownLocale = "fr" as unknown as EmailTemplateLocale;

    expect(normalizeEmailTemplates(value, "ES").INVOICE_SENT.subject).toBe("Asunto ES");
    expect(normalizeEmailTemplates(value, "EN").INVOICE_SENT.subject).toBe("EN subject");
    expect(normalizeEmailTemplates(value, unknownLocale).INVOICE_SENT.subject).toBe("EN subject");
  });
});
