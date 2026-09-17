import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

type MessageTree = { readonly [key: string]: string | MessageTree };

/**
 * Directorio temporal de claves nuevas (`<area>.en.json` + `<area>.es.json`).
 * Se fusiona en en.json/es.json al cerrar la fase y desaparece: cuando no
 * existe, las comprobaciones de additions no tienen nada que validar.
 */
const ADDITIONS_DIR = path.resolve(process.cwd(), "src/i18n/messages/additions");
const EN_SUFFIX = ".en.json";
const ES_SUFFIX = ".es.json";

type AdditionPair = {
  readonly name: string;
  readonly en: MessageTree;
  readonly es: MessageTree | null;
};

function collectLeaves(tree: MessageTree, prefix = ""): Map<string, string> {
  return Object.entries(tree).reduce((leaves, [key, value]) => {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      return new Map([...leaves, [keyPath, value]]);
    }
    return new Map([...leaves, ...collectLeaves(value, keyPath)]);
  }, new Map<string, string>());
}

function lookup(tree: MessageTree, keyPath: string): unknown {
  return keyPath.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree);
}

const placeholdersOf = (value: string) =>
  [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

function readTree(filePath: string): MessageTree {
  return JSON.parse(readFileSync(filePath, "utf8")) as MessageTree;
}

function loadAdditionPairs(): AdditionPair[] {
  if (!existsSync(ADDITIONS_DIR)) {
    return [];
  }
  const files = readdirSync(ADDITIONS_DIR);
  return files
    .filter((file) => file.endsWith(EN_SUFFIX))
    .map((enFile) => {
      const name = enFile.slice(0, -EN_SUFFIX.length);
      const esFile = `${name}${ES_SUFFIX}`;
      return {
        name,
        en: readTree(path.join(ADDITIONS_DIR, enFile)),
        es: files.includes(esFile) ? readTree(path.join(ADDITIONS_DIR, esFile)) : null,
      };
    });
}

function expectSameKeysAndPlaceholders(
  label: string,
  leavesEn: Map<string, string>,
  leavesEs: Map<string, string>
) {
  expect([...leavesEs.keys()].sort(), label).toEqual([...leavesEn.keys()].sort());
  for (const [key, valueEn] of leavesEn) {
    expect(placeholdersOf(leavesEs.get(key) ?? ""), `${label}: ${key}`).toEqual(
      placeholdersOf(valueEn)
    );
  }
}

const baseEn = en as MessageTree;
const baseEs = es as MessageTree;

describe("base dictionaries", () => {
  it("have the same keys and placeholders in English and Spanish", () => {
    const leavesEn = collectLeaves(baseEn);
    expect(leavesEn.size).toBeGreaterThan(0);
    expectSameKeysAndPlaceholders("en.json vs es.json", leavesEn, collectLeaves(baseEs));
  });
});

describe("message additions", () => {
  const pairs = loadAdditionPairs();

  it("pair every English file with a Spanish twin", () => {
    for (const pair of pairs) {
      expect(pair.es, `${pair.name}${ES_SUFFIX} is missing`).not.toBeNull();
    }
  });

  it("keep keys and placeholders in parity", () => {
    for (const pair of pairs) {
      expectSameKeysAndPlaceholders(
        pair.name,
        collectLeaves(pair.en),
        collectLeaves(pair.es ?? {})
      );
    }
  });

  it("only add keys that do not exist yet in the base dictionaries", () => {
    for (const pair of pairs) {
      for (const key of collectLeaves(pair.en).keys()) {
        expect(lookup(baseEn, key), `${pair.name}: ${key} (en)`).toBeUndefined();
        expect(lookup(baseEs, key), `${pair.name}: ${key} (es)`).toBeUndefined();
      }
    }
  });
});
