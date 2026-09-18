import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SERVICE_AGREEMENT_CLAUSES,
  SERVICE_AGREEMENT_EXECUTIVE_SUMMARY,
  SERVICE_AGREEMENT_FEATURES,
  SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN,
  SERVICE_AGREEMENT_INITIAL_GUARANTEE,
  SERVICE_AGREEMENT_INTERNAL_SOURCES,
  SERVICE_AGREEMENT_LOGOS,
  SERVICE_AGREEMENT_META,
  SERVICE_AGREEMENT_PLAN_PRICING,
  SERVICE_AGREEMENT_PLUS_PLAN,
  SERVICE_AGREEMENT_REFERENCES,
  SERVICE_AGREEMENT_VALUE_PROPS,
  type AgreementLogoEntry,
} from "@/lib/service-agreement-content";

// Tests de caracterizacion de contenido estatico: fijan estructura e invariantes del documento.

const PROJECT_ROOT = process.cwd();
const HEX_COLOR_LOWERCASE = /^#[0-9a-f]{6}$/;
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;
const MONTHLY_PRICE = /^\$\d+\.\d{2} \/ mes$/;
const LOGO_CATEGORIES: readonly AgreementLogoEntry["category"][] = [
  "brand",
  "platform",
  "infrastructure",
  "operation",
];
const EXPECTED_LOGO_COUNT = 23;
const EXPECTED_FEATURE_COUNT = 10;
const EXPECTED_CLAUSE_COUNT = 13;
const MAX_LOGO_SHORT_LENGTH = 4;
const CLAUSE_LETTERS = "ABCDEFGHIJKLM".split("");

function isTrimmedNonEmpty(value: string): boolean {
  return value.length > 0 && value === value.trim();
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

const ALL_CONTENT = [
  SERVICE_AGREEMENT_META,
  SERVICE_AGREEMENT_EXECUTIVE_SUMMARY,
  SERVICE_AGREEMENT_VALUE_PROPS,
  SERVICE_AGREEMENT_LOGOS,
  SERVICE_AGREEMENT_INITIAL_GUARANTEE,
  SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN,
  SERVICE_AGREEMENT_PLUS_PLAN,
  SERVICE_AGREEMENT_PLAN_PRICING,
  SERVICE_AGREEMENT_FEATURES,
  SERVICE_AGREEMENT_CLAUSES,
  SERVICE_AGREEMENT_REFERENCES,
  SERVICE_AGREEMENT_INTERNAL_SOURCES,
];

describe("SERVICE_AGREEMENT_META", () => {
  it("identifica el documento con titulo, version semantica corta y autor", () => {
    expect(SERVICE_AGREEMENT_META.title).toContain("AcostasPool");
    expect(SERVICE_AGREEMENT_META.title).toContain("Service Agreement");
    expect(SERVICE_AGREEMENT_META.documentVersion).toMatch(/^v\d+\.\d+$/);
    expect(SERVICE_AGREEMENT_META.preparedBy).toBe("AcostasPool Operations Team");
    expect(SERVICE_AGREEMENT_META.publicationDateLabel).toBe("Fecha de emision");
    expect(isTrimmedNonEmpty(SERVICE_AGREEMENT_META.subtitle)).toBe(true);
  });
});

describe("resumen ejecutivo y propuesta de valor", () => {
  it("contiene 3 parrafos de resumen y 4 propuestas de valor, todos terminados en punto", () => {
    expect(SERVICE_AGREEMENT_EXECUTIVE_SUMMARY).toHaveLength(3);
    expect(SERVICE_AGREEMENT_VALUE_PROPS).toHaveLength(4);
    for (const line of [...SERVICE_AGREEMENT_EXECUTIVE_SUMMARY, ...SERVICE_AGREEMENT_VALUE_PROPS]) {
      expect(line.endsWith(".")).toBe(true);
    }
  });
});

describe("SERVICE_AGREEMENT_LOGOS", () => {
  it("tiene 23 entradas con ids unicos y categorias validas en la distribucion esperada", () => {
    expect(SERVICE_AGREEMENT_LOGOS).toHaveLength(EXPECTED_LOGO_COUNT);
    expect(new Set(SERVICE_AGREEMENT_LOGOS.map((logo) => logo.id)).size).toBe(EXPECTED_LOGO_COUNT);

    const counts = SERVICE_AGREEMENT_LOGOS.reduce<Record<string, number>>(
      (acc, logo) => ({ ...acc, [logo.category]: (acc[logo.category] ?? 0) + 1 }),
      {}
    );
    expect(counts).toEqual({ brand: 2, platform: 11, infrastructure: 6, operation: 4 });
    for (const logo of SERVICE_AGREEMENT_LOGOS) {
      expect(LOGO_CATEGORIES, logo.id).toContain(logo.category);
    }
  });

  it("usa colores hex en minusculas, abreviaturas cortas en mayusculas e ids en kebab-case", () => {
    for (const logo of SERVICE_AGREEMENT_LOGOS) {
      expect(logo.accentHex, logo.id).toMatch(HEX_COLOR_LOWERCASE);
      expect(logo.short.length, logo.id).toBeLessThanOrEqual(MAX_LOGO_SHORT_LENGTH);
      expect(logo.short, logo.id).toBe(logo.short.toUpperCase());
      expect(logo.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("cada imageSrc apunta a un asset existente bajo public/brand", () => {
    for (const logo of SERVICE_AGREEMENT_LOGOS) {
      expect(logo.imageSrc, logo.id).toMatch(/^\/brand\/.+\.svg$/);
      const assetPath = path.join(PROJECT_ROOT, "public", logo.imageSrc ?? "");
      expect(existsSync(assetPath), `${logo.id}: falta ${logo.imageSrc}`).toBe(true);
    }
  });
});

describe("garantia inicial y planes", () => {
  it("describe la garantia inicial de 30 dias con 4 coberturas y nota de transicion", () => {
    expect(SERVICE_AGREEMENT_INITIAL_GUARANTEE.title).toBe("Periodo de Garantia Inicial");
    expect(SERVICE_AGREEMENT_INITIAL_GUARANTEE.summary).toContain("30 dias");
    expect(SERVICE_AGREEMENT_INITIAL_GUARANTEE.supportScope).toHaveLength(4);
    expect(isTrimmedNonEmpty(SERVICE_AGREEMENT_INITIAL_GUARANTEE.transitionNote)).toBe(true);
  });

  it("el plan de infraestructura es obligatorio y el Plan Plus lista servicios, exclusiones y justificacion", () => {
    expect(SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.title).toContain("Obligatorio");
    expect(SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.includedInfrastructure).toHaveLength(4);
    expect(SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.includedInfrastructure.join(" ")).toContain("AWS S3");

    expect(SERVICE_AGREEMENT_PLUS_PLAN.title).toContain("Plan Plus");
    expect(SERVICE_AGREEMENT_PLUS_PLAN.includedServices).toHaveLength(6);
    expect(SERVICE_AGREEMENT_PLUS_PLAN.exclusions).toHaveLength(5);
    expect(SERVICE_AGREEMENT_PLUS_PLAN.businessRationale).toHaveLength(3);
  });

  it("la tabla de precios tiene dos planes con precio mensual y 20% de descuento desde el ano 2", () => {
    expect(SERVICE_AGREEMENT_PLAN_PRICING).toHaveLength(2);
    expect(SERVICE_AGREEMENT_PLAN_PRICING.map((row) => row.plan)).toEqual([
      "Infraestructura (Obligatorio)",
      "Infraestructura + Mantenimiento (Plan Plus)",
    ]);
    expect(SERVICE_AGREEMENT_PLAN_PRICING.map((row) => row.year1)).toEqual(["$49.99 / mes", "$105.99 / mes"]);
    for (const row of SERVICE_AGREEMENT_PLAN_PRICING) {
      expect(row.year1, row.plan).toMatch(MONTHLY_PRICE);
      expect(row.year2Plus, row.plan).toBe("20% de descuento");
      expect(row.year2PlusBadge, row.plan).toBe("20% OFF");
      expect(row.year2PlusSupportingText ?? "", row.plan).toContain("ano 2");
    }
  });
});

describe("SERVICE_AGREEMENT_FEATURES", () => {
  it("lista 10 bloques numerados en orden, cada uno con resumen y al menos 4 bullets", () => {
    expect(SERVICE_AGREEMENT_FEATURES).toHaveLength(EXPECTED_FEATURE_COUNT);
    SERVICE_AGREEMENT_FEATURES.forEach((feature, index) => {
      expect(feature.title.startsWith(`${index + 1}. `), feature.title).toBe(true);
      expect(isTrimmedNonEmpty(feature.summary), feature.title).toBe(true);
      expect(feature.bullets.length, feature.title).toBeGreaterThanOrEqual(4);
    });
  });
});

describe("SERVICE_AGREEMENT_CLAUSES", () => {
  it("lista 13 clausulas etiquetadas A..M en orden; solo C y G llevan bullets", () => {
    expect(SERVICE_AGREEMENT_CLAUSES).toHaveLength(EXPECTED_CLAUSE_COUNT);
    SERVICE_AGREEMENT_CLAUSES.forEach((clause, index) => {
      expect(clause.title.startsWith(`${CLAUSE_LETTERS[index]}. `), clause.title).toBe(true);
      expect(clause.paragraphs.length, clause.title).toBeGreaterThan(0);
      for (const paragraph of clause.paragraphs) {
        expect(paragraph.endsWith("."), clause.title).toBe(true);
      }
    });

    const withBullets = SERVICE_AGREEMENT_CLAUSES.filter((clause) => (clause.bullets?.length ?? 0) > 0);
    expect(withBullets.map((clause) => clause.title.charAt(0))).toEqual(["C", "G"]);
  });

  it("la clausula M enlaza la garantia inicial con los planes de continuidad", () => {
    const clauseM = SERVICE_AGREEMENT_CLAUSES[EXPECTED_CLAUSE_COUNT - 1];

    expect(clauseM.title).toBe("M. Garantia Inicial y Planes de Continuidad");
    expect(clauseM.paragraphs.join(" ")).toContain("treinta (30) dias");
    expect(clauseM.paragraphs.join(" ")).toContain("Plan Plus");
  });
});

describe("referencias", () => {
  it("las referencias externas son URLs https con etiqueta y nota", () => {
    expect(SERVICE_AGREEMENT_REFERENCES).toHaveLength(3);
    for (const reference of SERVICE_AGREEMENT_REFERENCES) {
      expect(reference.url, reference.label).toMatch(/^https:\/\/(www\.sec\.gov|csrc\.nist\.gov)\//);
      expect(isTrimmedNonEmpty(reference.label)).toBe(true);
      expect(isTrimmedNonEmpty(reference.note)).toBe(true);
    }
  });

  it("las fuentes internas apuntan a documentos markdown existentes en docs/", () => {
    expect(SERVICE_AGREEMENT_INTERNAL_SOURCES).toHaveLength(4);
    for (const source of SERVICE_AGREEMENT_INTERNAL_SOURCES) {
      expect(source.url, source.label).toMatch(/^\/docs\/[A-Za-z0-9-]+\.md$/);
      expect(existsSync(path.join(PROJECT_ROOT, source.url)), `${source.label}: falta ${source.url}`).toBe(true);
    }
  });
});

describe("invariantes globales del contenido", () => {
  it("todas las cadenas son ASCII imprimible (sin acentos ni caracteres especiales)", () => {
    const strings = collectStrings(ALL_CONTENT);

    expect(strings.length).toBeGreaterThan(100);
    for (const value of strings) {
      expect(value, value).toMatch(PRINTABLE_ASCII);
    }
  });

  it("ninguna cadena esta vacia ni tiene espacios sobrantes", () => {
    for (const value of collectStrings(ALL_CONTENT)) {
      expect(isTrimmedNonEmpty(value), JSON.stringify(value)).toBe(true);
    }
  });
});
