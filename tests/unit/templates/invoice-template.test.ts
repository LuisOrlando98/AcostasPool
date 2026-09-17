import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVOICE_TEMPLATE,
  formatTaxRateLabelSuffix,
  getInvoiceTemplateLocaleCopy,
  localizeInvoiceNotes,
  localizeInvoiceTemplate,
  normalizeInvoiceTemplateConfig,
  renderInvoiceTemplateHtml,
  renderInvoiceTemplatePreview,
  resolveInvoiceTemplateLocale,
  toPdfRgbTuple,
  type InvoiceTemplateRenderInput,
  type InvoiceTemplateRenderLineItem,
} from "@/lib/invoice-template";

// Tests de caracterizacion: fijan el comportamiento ACTUAL del modulo antes de refactorizar.

// Tipo derivado del propio modulo para no acoplar el test al nombre exacto del tipo exportado.
type TemplateConfig = ReturnType<typeof normalizeInvoiceTemplateConfig>;

const BASE_ITEMS: InvoiceTemplateRenderLineItem[] = [
  { label: "Weekly cleaning", quantity: 1, unitPrice: 125, amount: 125 },
  { label: "Chemicals", quantity: 2, unitPrice: 24.25, amount: 48.5 },
];

const XSS_PAYLOAD = `<script>alert("x")</script> & 'q'`;
const XSS_ESCAPED = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;";
const XSS_OCCURRENCES_IN_RENDER = 6;

function buildRenderInput(
  overrides: Partial<InvoiceTemplateRenderInput> = {}
): InvoiceTemplateRenderInput {
  return {
    template: DEFAULT_INVOICE_TEMPLATE,
    theme: "STANDARD",
    locale: "EN",
    invoiceNumber: "INV-0001",
    issueDateLabel: "01/15/2026",
    customerName: "Jane Doe",
    customerAddress: "123 Palm Ave",
    customerEmail: "jane@example.com",
    customerPhone: "+1 305 555 0100",
    items: BASE_ITEMS,
    subtotal: 173.5,
    tax: 12.15,
    total: 185.65,
    notes: null,
    ...overrides,
  };
}

function withThemes(
  themes: Partial<TemplateConfig["themes"]>
): TemplateConfig {
  return {
    ...DEFAULT_INVOICE_TEMPLATE,
    themes: { ...DEFAULT_INVOICE_TEMPLATE.themes, ...themes },
  };
}

describe("resolveInvoiceTemplateLocale", () => {
  it("solo acepta 'ES' exacto; cualquier otro valor cae en 'EN'", () => {
    expect(resolveInvoiceTemplateLocale("ES")).toBe("ES");
    expect(resolveInvoiceTemplateLocale("es")).toBe("EN");
    expect(resolveInvoiceTemplateLocale("EN")).toBe("EN");
    expect(resolveInvoiceTemplateLocale(null)).toBe("EN");
    expect(resolveInvoiceTemplateLocale(undefined)).toBe("EN");
    expect(resolveInvoiceTemplateLocale("")).toBe("EN");
    expect(resolveInvoiceTemplateLocale(1)).toBe("EN");
  });
});

describe("getInvoiceTemplateLocaleCopy", () => {
  it("expone el copy de cada idioma con htmlLang e intlLocale coherentes", () => {
    const en = getInvoiceTemplateLocaleCopy("EN");
    const es = getInvoiceTemplateLocaleCopy("ES");

    expect(en).toMatchObject({
      htmlLang: "en",
      intlLocale: "en-US",
      noLineItemsLabel: "No line items",
      issuedByLabel: "Issued By",
    });
    expect(es).toMatchObject({
      htmlLang: "es",
      intlLocale: "es-US",
      noLineItemsLabel: "Sin conceptos",
      issuedByLabel: "Emitido por",
    });
    expect(en.legalClauses).toHaveLength(3);
    expect(es.legalClauses).toHaveLength(3);
  });
});

describe("localizeInvoiceTemplate", () => {
  it("traduce etiquetas y nombres de tema a ES, incluido el watermark de ESTIMATE", () => {
    const localized = localizeInvoiceTemplate(DEFAULT_INVOICE_TEMPLATE, "ES");

    expect(localized).toMatchObject({
      headerSubtitle: "REPARACION Y MANTENIMIENTO",
      footerNote: "Gracias por confiar en AcostasPool.",
      invoiceNumberLabel: "Factura #",
      issueDateLabel: "Fecha de emision",
      billToLabel: "Facturar a",
      notesLabel: "Notas",
      taxLabel: "Impuesto",
      clausesTitle: "Terminos y clausulas",
    });
    expect(localized.themes.STANDARD.label).toBe("FACTURA");
    expect(localized.themes.SPECIAL.label).toBe("FACTURA ESPECIAL");
    expect(localized.themes.ESTIMATE).toMatchObject({ label: "ESTIMADO", watermarkText: "ESTIMADO" });
  });

  it("conserva datos de empresa, colores, flags y las clausulas legales sin traducir", () => {
    const template: TemplateConfig = {
      ...withThemes({
        STANDARD: { ...DEFAULT_INVOICE_TEMPLATE.themes.STANDARD, brandHex: "#123456", watermarkText: "DRAFT" },
      }),
      companyName: "Mi Empresa",
      legalClauses: ["Clause one.", "Clause two."],
      showEstimateWatermark: false,
    };

    const localized = localizeInvoiceTemplate(template, "ES");

    expect(localized.companyName).toBe("Mi Empresa");
    expect(localized.legalClauses).toBe(template.legalClauses);
    expect(localized.themes.STANDARD).toMatchObject({ brandHex: "#123456", watermarkText: "DRAFT" });
    expect(localized.showEstimateWatermark).toBe(false);
  });

  it("no muta la plantilla de entrada y sobrescribe etiquetas personalizadas con el copy del idioma", () => {
    const template = Object.freeze({ ...DEFAULT_INVOICE_TEMPLATE, billToLabel: "Cliente" });

    const localized = localizeInvoiceTemplate(template, "EN");

    expect(localized).not.toBe(template);
    expect(localized.billToLabel).toBe("Bill To");
    expect(template.billToLabel).toBe("Cliente");
  });
});

describe("normalizeInvoiceTemplateConfig", () => {
  it("devuelve la misma referencia DEFAULT_INVOICE_TEMPLATE para entradas que no son objeto", () => {
    expect(normalizeInvoiceTemplateConfig(null)).toBe(DEFAULT_INVOICE_TEMPLATE);
    expect(normalizeInvoiceTemplateConfig(undefined)).toBe(DEFAULT_INVOICE_TEMPLATE);
    expect(normalizeInvoiceTemplateConfig("texto")).toBe(DEFAULT_INVOICE_TEMPLATE);
    expect(normalizeInvoiceTemplateConfig(0)).toBe(DEFAULT_INVOICE_TEMPLATE);
  });

  it("produce una copia equivalente a los defaults para objetos vacios y es idempotente", () => {
    const fromEmpty = normalizeInvoiceTemplateConfig({});

    expect(fromEmpty).toEqual(DEFAULT_INVOICE_TEMPLATE);
    expect(fromEmpty).not.toBe(DEFAULT_INVOICE_TEMPLATE);
    expect(normalizeInvoiceTemplateConfig([])).toEqual(DEFAULT_INVOICE_TEMPLATE);
    expect(normalizeInvoiceTemplateConfig(DEFAULT_INVOICE_TEMPLATE)).toEqual(DEFAULT_INVOICE_TEMPLATE);
  });

  it("los textos obligatorios se recortan y caen al default si estan vacios o no son string", () => {
    const result = normalizeInvoiceTemplateConfig({
      companyName: "  Acme Pools  ",
      headerSubtitle: "   ",
      totalLabel: 42,
      billToLabel: null,
    });

    expect(result.companyName).toBe("Acme Pools");
    expect(result.headerSubtitle).toBe(DEFAULT_INVOICE_TEMPLATE.headerSubtitle);
    expect(result.totalLabel).toBe(DEFAULT_INVOICE_TEMPLATE.totalLabel);
    expect(result.billToLabel).toBe(DEFAULT_INVOICE_TEMPLATE.billToLabel);
  });

  it("los datos de contacto opcionales aceptan cadena vacia, se recortan y solo caen al default si no son string", () => {
    const result = normalizeInvoiceTemplateConfig({
      companyPhone: "",
      companyEmail: "  ops@acme.test ",
      companyWebsite: 123,
      companyTaxId: "   ",
    });

    expect(result.companyPhone).toBe("");
    expect(result.companyEmail).toBe("ops@acme.test");
    expect(result.companyWebsite).toBe(DEFAULT_INVOICE_TEMPLATE.companyWebsite);
    expect(result.companyTaxId).toBe("");
  });

  it("normaliza legalClauses desde string multilinea o array, y cae al default si queda vacio", () => {
    const defaults = DEFAULT_INVOICE_TEMPLATE.legalClauses;

    expect(normalizeInvoiceTemplateConfig({ legalClauses: " One \n\n  Two  \n" }).legalClauses).toEqual(["One", "Two"]);
    expect(normalizeInvoiceTemplateConfig({ legalClauses: ["  A ", "", 7, null, "B"] }).legalClauses).toEqual(["A", "B"]);
    expect(normalizeInvoiceTemplateConfig({ legalClauses: [] }).legalClauses).toEqual(defaults);
    expect(normalizeInvoiceTemplateConfig({ legalClauses: "  \n " }).legalClauses).toEqual(defaults);
    expect(normalizeInvoiceTemplateConfig({ legalClauses: 5 }).legalClauses).toEqual(defaults);
  });

  it("showEstimateWatermark solo acepta booleanos", () => {
    expect(normalizeInvoiceTemplateConfig({ showEstimateWatermark: false }).showEstimateWatermark).toBe(false);
    expect(normalizeInvoiceTemplateConfig({ showEstimateWatermark: "false" }).showEstimateWatermark).toBe(true);
    expect(normalizeInvoiceTemplateConfig({ showEstimateWatermark: 0 }).showEstimateWatermark).toBe(true);
  });

  it("normaliza colores de tema a hex de 6 digitos en mayusculas; invalidos caen al default por campo", () => {
    const result = normalizeInvoiceTemplateConfig({
      themes: {
        STANDARD: { brandHex: " #a1b2c3 ", accentHex: "#FFF", lightHex: "red", label: "  Custom " },
      },
    });

    expect(result.themes.STANDARD).toEqual({
      label: "Custom",
      brandHex: "#A1B2C3",
      accentHex: DEFAULT_INVOICE_TEMPLATE.themes.STANDARD.accentHex,
      lightHex: DEFAULT_INVOICE_TEMPLATE.themes.STANDARD.lightHex,
      watermarkText: "",
    });
    expect(result.themes.SPECIAL).toEqual(DEFAULT_INVOICE_TEMPLATE.themes.SPECIAL);
    expect(result.themes.ESTIMATE).toEqual(DEFAULT_INVOICE_TEMPLATE.themes.ESTIMATE);
  });

  it("watermarkText se recorta (incluso a vacio) y cae al default solo si no es string; temas no-objeto caen al default", () => {
    const result = normalizeInvoiceTemplateConfig({
      themes: {
        ESTIMATE: { watermarkText: "   ", label: "" },
        SPECIAL: { watermarkText: 99 },
        STANDARD: "no soy un objeto",
      },
    });

    expect(result.themes.ESTIMATE).toMatchObject({ watermarkText: "", label: "ESTIMATE" });
    expect(result.themes.SPECIAL.watermarkText).toBe("");
    expect(result.themes.STANDARD).toBe(DEFAULT_INVOICE_TEMPLATE.themes.STANDARD);
    expect(normalizeInvoiceTemplateConfig({ themes: null }).themes).toEqual(DEFAULT_INVOICE_TEMPLATE.themes);
  });
});

describe("toPdfRgbTuple", () => {
  it("convierte hex a tupla RGB normalizada en 0..1, aceptando minusculas y espacios", () => {
    expect(toPdfRgbTuple("#FFFFFF")).toEqual([1, 1, 1]);
    expect(toPdfRgbTuple("#000000")).toEqual([0, 0, 0]);
    expect(toPdfRgbTuple("#ff0000")).toEqual([1, 0, 0]);
    expect(toPdfRgbTuple("  #00FF00 ")).toEqual([0, 1, 0]);

    const [red, green, blue] = toPdfRgbTuple("#304B88");
    expect(red).toBeCloseTo(48 / 255);
    expect(green).toBeCloseTo(75 / 255);
    expect(blue).toBeCloseTo(136 / 255);
  });

  it("cae a negro para valores invalidos (hex corto, sin #, nombre de color, vacio)", () => {
    expect(toPdfRgbTuple("#FFF")).toEqual([0, 0, 0]);
    expect(toPdfRgbTuple("FFFFFF")).toEqual([0, 0, 0]);
    expect(toPdfRgbTuple("red")).toEqual([0, 0, 0]);
    expect(toPdfRgbTuple("")).toEqual([0, 0, 0]);
  });
});

describe("localizeInvoiceNotes", () => {
  it("devuelve cadena vacia para null, undefined o solo espacios", () => {
    expect(localizeInvoiceNotes(null, "EN")).toBe("");
    expect(localizeInvoiceNotes(undefined, "ES")).toBe("");
    expect(localizeInvoiceNotes("   ", "EN")).toBe("");
  });

  it("traduce las notas conocidas entre EN y ES en ambos sentidos", () => {
    expect(
      localizeInvoiceNotes("Service completed and balanced. Thank you for trusting us.", "ES")
    ).toBe("Servicio completado y balanceado. Gracias por confiar en nosotros.");
    expect(localizeInvoiceNotes("Sin notas adicionales.", "EN")).toBe("No additional notes.");
    expect(localizeInvoiceNotes("Service completed and balanced.", "EN")).toBe(
      "Service completed and balanced."
    );
  });

  it("compara ignorando mayusculas y espacios repetidos, pero devuelve la version canonica", () => {
    expect(localizeInvoiceNotes("  service   COMPLETED and balanced. ", "ES")).toBe(
      "Servicio completado y balanceado."
    );
  });

  it("devuelve las notas desconocidas recortadas y sin traducir", () => {
    expect(localizeInvoiceNotes("  Gate code 1234  ", "ES")).toBe("Gate code 1234");
    expect(localizeInvoiceNotes("Service completed and balanced. Extra.", "ES")).toBe(
      "Service completed and balanced. Extra."
    );
  });
});

describe("renderInvoiceTemplateHtml", () => {
  it("usa el atributo lang del idioma y EN por defecto", () => {
    expect(renderInvoiceTemplateHtml(buildRenderInput({ locale: "ES" }))).toContain('<html lang="es">');
    expect(renderInvoiceTemplateHtml(buildRenderInput({ locale: undefined }))).toContain('<html lang="en">');
  });

  it("inyecta los colores del tema como variables CSS y su etiqueta como titulo", () => {
    const template = withThemes({
      SPECIAL: {
        label: "VIP INVOICE",
        brandHex: "#112233",
        accentHex: "#445566",
        lightHex: "#778899",
        watermarkText: "",
      },
    });

    const html = renderInvoiceTemplateHtml(buildRenderInput({ template, theme: "SPECIAL" }));

    expect(html).toContain("--brand: #112233;");
    expect(html).toContain("--accent: #445566;");
    expect(html).toContain("--light: #778899;");
    expect(html).toContain('<p class="invoice-label">VIP INVOICE</p>');
  });

  it("renderiza una fila por item con indice, cantidad y montos en formato $0.00", () => {
    const html = renderInvoiceTemplateHtml(buildRenderInput());
    const rows = html.match(/<tr>\n {2}<td class="col-index">[\s\S]*?<\/tr>/g) ?? [];

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchInlineSnapshot(`
      "<tr>
        <td class="col-index">1</td>
        <td class="col-description">Weekly cleaning</td>
        <td class="col-qty">1</td>
        <td class="col-money">$125.00</td>
        <td class="col-money col-money-strong">$125.00</td>
      </tr>"
    `);
    expect(rows[1]).toContain('<td class="col-index">2</td>');
    expect(rows[1]).toContain('<td class="col-qty">2</td>');
    expect(rows[1]).toContain('<td class="col-money">$24.25</td>');
    expect(rows[1]).toContain('<td class="col-money col-money-strong">$48.50</td>');
  });

  it("muestra la fila vacia localizada cuando no hay items", () => {
    const en = renderInvoiceTemplateHtml(buildRenderInput({ items: [] }));
    const es = renderInvoiceTemplateHtml(buildRenderInput({ items: [], locale: "ES" }));

    expect(en).toContain('<td colspan="5" class="empty-row">No line items</td>');
    expect(es).toContain('<td colspan="5" class="empty-row">Sin conceptos</td>');
    expect(en).not.toContain('class="col-index"');
  });

  it("solo muestra la marca de agua en ESTIMATE con flag activo y texto no vacio", () => {
    const withWatermark = renderInvoiceTemplateHtml(buildRenderInput({ theme: "ESTIMATE" }));
    expect(withWatermark).toContain('<div class="watermark">ESTIMATE</div>');

    const flagOff = { ...DEFAULT_INVOICE_TEMPLATE, showEstimateWatermark: false };
    expect(
      renderInvoiceTemplateHtml(buildRenderInput({ theme: "ESTIMATE", template: flagOff }))
    ).not.toContain('class="watermark"');

    const emptyText = withThemes({
      ESTIMATE: { ...DEFAULT_INVOICE_TEMPLATE.themes.ESTIMATE, watermarkText: "" },
    });
    expect(
      renderInvoiceTemplateHtml(buildRenderInput({ theme: "ESTIMATE", template: emptyText }))
    ).not.toContain('class="watermark"');

    const standardWithText = withThemes({
      STANDARD: { ...DEFAULT_INVOICE_TEMPLATE.themes.STANDARD, watermarkText: "PAID" },
    });
    expect(
      renderInvoiceTemplateHtml(buildRenderInput({ theme: "STANDARD", template: standardWithText }))
    ).not.toContain('class="watermark"');
  });

  it("escapa el texto de la marca de agua", () => {
    const template = withThemes({
      ESTIMATE: { ...DEFAULT_INVOICE_TEMPLATE.themes.ESTIMATE, watermarkText: "<b>EST</b>" },
    });

    const html = renderInvoiceTemplateHtml(buildRenderInput({ theme: "ESTIMATE", template }));

    expect(html).toContain('<div class="watermark">&lt;b&gt;EST&lt;/b&gt;</div>');
  });

  it("localiza las notas conocidas y usa el texto por defecto cuando no hay notas", () => {
    const es = renderInvoiceTemplateHtml(
      buildRenderInput({ locale: "ES", notes: "Service completed and balanced." })
    );
    expect(es).toContain('<p class="service-main">Servicio completado y balanceado.</p>');

    const empty = renderInvoiceTemplateHtml(buildRenderInput({ notes: "   " }));
    expect(empty).toContain('<p class="service-main">No additional notes.</p>');

    const custom = renderInvoiceTemplateHtml(buildRenderInput({ notes: " Gate code 1234 " }));
    expect(custom).toContain('<p class="service-main">Gate code 1234</p>');
  });

  it("usa footerNote y legalClauses de la plantilla, con fallbacks localizados si estan vacios", () => {
    const template = {
      ...DEFAULT_INVOICE_TEMPLATE,
      footerNote: "  Custom thanks  ",
      legalClauses: [" Clause A. ", "", "Clause B."],
    };
    const html = renderInvoiceTemplateHtml(buildRenderInput({ template }));
    expect(html).toContain('<p class="service-sub">Custom thanks</p>');
    expect(html).toContain(
      '<span class="service-sub-label">Payment Authorization Consent:</span> Clause A. Clause B.</p>'
    );

    const bare = { ...DEFAULT_INVOICE_TEMPLATE, footerNote: "", legalClauses: [] };
    const es = renderInvoiceTemplateHtml(buildRenderInput({ template: bare, locale: "ES" }));
    expect(es).toContain('<p class="service-sub">Gracias por confiar en AcostasPool.</p>');
    expect(es).toContain(
      '<span class="service-sub-label">Consentimiento de Autorizacion de Pago:</span> El pago vence al recibir esta factura salvo acuerdo por escrito.</p>'
    );
  });

  it("muestra el nombre del cliente en negrita y omite lineas de contacto vacias", () => {
    const html = renderInvoiceTemplateHtml(
      buildRenderInput({
        customerName: "  Jane Doe ",
        customerAddress: null,
        customerEmail: "   ",
        customerPhone: "+1 305 555 0100",
      })
    );

    expect(html).toContain(
      '<p class="block-line block-line-strong">Jane Doe</p><p class="block-line">+1 305 555 0100</p>'
    );
    expect(html).not.toContain("jane@example.com");
  });

  it("compone el bloque del emisor uniendo las lineas de direccion con coma y omitiendo vacios", () => {
    const html = renderInvoiceTemplateHtml(buildRenderInput());
    expect(html).toContain(
      '<p class="block-line block-line-strong">ACOSTASPOOL</p><p class="block-line">Miami, Florida, United States</p><p class="block-line">contact@acostaspool.com</p>'
    );

    const noLine2 = { ...DEFAULT_INVOICE_TEMPLATE, companyAddressLine2: "", companyTaxId: "" };
    const html2 = renderInvoiceTemplateHtml(buildRenderInput({ template: noLine2 }));
    expect(html2).toContain('<p class="block-line">Miami, Florida</p>');
    expect(html2).not.toContain("Tax ID");
  });

  it("escapa HTML en todos los datos de usuario (etiquetas, cliente, numero, notas, items)", () => {
    const html = renderInvoiceTemplateHtml(
      buildRenderInput({
        customerName: XSS_PAYLOAD,
        invoiceNumber: XSS_PAYLOAD,
        notes: XSS_PAYLOAD,
        items: [{ label: XSS_PAYLOAD, quantity: 1, unitPrice: 1, amount: 1 }],
        template: { ...DEFAULT_INVOICE_TEMPLATE, companyName: XSS_PAYLOAD, billToLabel: XSS_PAYLOAD },
      })
    );

    expect(html).not.toContain("<script>");
    expect(html.split(XSS_ESCAPED)).toHaveLength(XSS_OCCURRENCES_IN_RENDER + 1);
  });

  it("no traduce las etiquetas de la plantilla: con locale ES y plantilla EN se mezclan idiomas", () => {
    const mixed = renderInvoiceTemplateHtml(buildRenderInput({ locale: "ES" }));
    expect(mixed).toContain('<p class="block-title">Bill To</p>');
    expect(mixed).toContain('<p class="block-title">Emitido por</p>');

    const localized = renderInvoiceTemplateHtml(
      buildRenderInput({ locale: "ES", template: localizeInvoiceTemplate(DEFAULT_INVOICE_TEMPLATE, "ES") })
    );
    expect(localized).toContain('<p class="block-title">Facturar a</p>');
    expect(localized).toContain('<p class="invoice-label">FACTURA</p>');
  });

  it("formatea los totales con dos decimales y sin separador de miles", () => {
    const html = renderInvoiceTemplateHtml(buildRenderInput({ subtotal: 1234.5, tax: 0, total: 1234.5 }));

    expect(html).toContain("<span>Subtotal:</span><strong>$1234.50</strong>");
    expect(html).toContain("<span>Tax:</span><strong>$0.00</strong>");
    expect(html).toContain("<span>Total:</span><strong>$1234.50</strong>");
  });

  it("calcula el porcentaje de la etiqueta de impuesto desde tax/subtotal en vez de fijar 7%", () => {
    const tenPercent = renderInvoiceTemplateHtml(
      buildRenderInput({ subtotal: 100, tax: 10, total: 110 })
    );
    expect(tenPercent).toContain("<span>Tax (10%):</span><strong>$10.00</strong>");
    expect(tenPercent).not.toContain("(7%)");

    const sevenPercent = renderInvoiceTemplateHtml(buildRenderInput());
    expect(sevenPercent).toContain("<span>Tax (7%):</span><strong>$12.15</strong>");

    const withDecimal = renderInvoiceTemplateHtml(
      buildRenderInput({ subtotal: 200, tax: 17, total: 217 })
    );
    expect(withDecimal).toContain("<span>Tax (8.5%):</span>");
  });

  it("omite el porcentaje cuando no hay subtotal o el impuesto es cero, en ambos idiomas", () => {
    const noSubtotal = renderInvoiceTemplateHtml(
      buildRenderInput({ subtotal: 0, tax: 5, total: 5 })
    );
    expect(noSubtotal).toContain("<span>Tax:</span><strong>$5.00</strong>");

    const es = renderInvoiceTemplateHtml(
      buildRenderInput({
        locale: "ES",
        template: localizeInvoiceTemplate(DEFAULT_INVOICE_TEMPLATE, "ES"),
        tax: 0,
        total: 173.5,
      })
    );
    expect(es).toContain("<span>Impuesto:</span><strong>$0.00</strong>");
  });

  it("incluye el propietario fijo y los metodos de pago localizados", () => {
    const html = renderInvoiceTemplateHtml(buildRenderInput({ locale: "ES" }));

    expect(html).toContain('<p class="owner-name">Luis Acosta</p>');
    expect(html).toContain('<p class="owner-role">Presidente / Propietario</p>');
    expect(html).toContain("Credito | Debito | ACH | Cheque | Zelle | Efectivo");
    expect(html).toContain("Aceptamos: Visa, MasterCard, Zelle, Efectivo");
  });
});

describe("formatTaxRateLabelSuffix", () => {
  it("redondea a un decimal como maximo y omite los decimales cuando el porcentaje es entero", () => {
    expect(formatTaxRateLabelSuffix(100, 7)).toBe(" (7%)");
    expect(formatTaxRateLabelSuffix(173.5, 12.145)).toBe(" (7%)");
    expect(formatTaxRateLabelSuffix(200, 17)).toBe(" (8.5%)");
    expect(formatTaxRateLabelSuffix(300, 20)).toBe(" (6.7%)");
  });

  it("devuelve cadena vacia sin subtotal, sin impuesto o con valores no finitos", () => {
    expect(formatTaxRateLabelSuffix(0, 7)).toBe("");
    expect(formatTaxRateLabelSuffix(100, 0)).toBe("");
    expect(formatTaxRateLabelSuffix(Number.NaN, 7)).toBe("");
    expect(formatTaxRateLabelSuffix(100, Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("renderInvoiceTemplatePreview", () => {
  it("renderiza datos de muestra fijos en ingles con totales calculados", () => {
    const html = renderInvoiceTemplatePreview(DEFAULT_INVOICE_TEMPLATE, "STANDARD");

    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Invoice #: INV-2026-1042");
    expect(html).toContain("Issue date: 03/03/2026");
    expect(html).toContain("Sample Customer");
    expect(html).toContain("Weekly cleaning");
    expect(html).toContain("<strong>$173.50</strong>");
    expect(html).toContain("<strong>$12.15</strong>");
    expect(html).toContain("<strong>$185.65</strong>");
    expect(html).not.toContain('class="watermark"');
  });

  it("muestra la marca de agua en la vista previa ESTIMATE", () => {
    const html = renderInvoiceTemplatePreview(DEFAULT_INVOICE_TEMPLATE, "ESTIMATE");

    expect(html).toContain('<p class="invoice-label">ESTIMATE</p>');
    expect(html).toContain('<div class="watermark">ESTIMATE</div>');
  });
});
