import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import {
  driveSourceKey,
  driveSourceTone,
  jobStatusKey,
  jobStatusTone,
  parseUndoKind,
  undoKindKey,
} from "@/components/routes/assistant/labels";

type MessageTree = { readonly [key: string]: string | MessageTree };

function lookup(tree: MessageTree, keyPath: string): unknown {
  return keyPath.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree);
}

// Las claves nuevas del asistente ya están fusionadas en el diccionario.
const resolves = (key: string) => typeof lookup(en as MessageTree, key) === "string";

describe("jobStatusKey", () => {
  it("maps every assistant status to an existing dictionary key", () => {
    const keys = (["SCHEDULED", "PENDING", "ON_THE_WAY", "IN_PROGRESS"] as const).map(
      jobStatusKey
    );

    expect(keys).toEqual([
      "jobs.status.scheduled",
      "jobs.status.pending",
      "jobs.status.onTheWay",
      "jobs.status.inProgress",
    ]);
    expect(keys.every(resolves)).toBe(true);
  });
});

describe("jobStatusTone", () => {
  it("highlights only the jobs already under way", () => {
    expect(jobStatusTone("ON_THE_WAY")).toBe("warning");
    expect(jobStatusTone("IN_PROGRESS")).toBe("warning");
    expect(jobStatusTone("SCHEDULED")).toBe("neutral");
  });
});

describe("driveSourceKey", () => {
  it("maps every drive source to an existing dictionary key", () => {
    const keys = (["LIVE_TRAFFIC", "ESTIMATED", "SAME_ADDRESS"] as const).map(
      driveSourceKey
    );

    expect(keys.every((key) => key !== null && resolves(key))).toBe(true);
  });

  it("returns null when the plan did not report a source", () => {
    expect(driveSourceKey(undefined)).toBeNull();
    expect(driveSourceTone(undefined)).toBe("neutral");
  });
});

describe("parseUndoKind", () => {
  it("reads the kind out of the opaque draft label", () => {
    expect(parseUndoKind("move:job-1")).toBe("move");
    expect(parseUndoKind("reassign:job-1")).toBe("reassign");
    expect(parseUndoKind("remove:job-1")).toBe("remove");
    expect(parseUndoKind("restore:job-1")).toBe("restore");
  });

  it("returns null for an absent or unknown label", () => {
    expect(parseUndoKind(null)).toBeNull();
    expect(parseUndoKind("explode:job-1")).toBeNull();
    expect(parseUndoKind("job-1")).toBeNull();
  });
});

describe("undoKindKey", () => {
  it("builds keys that exist in the dictionary", () => {
    const keys = (["move", "reassign", "remove", "restore"] as const).map(undoKindKey);

    expect(keys.every(resolves)).toBe(true);
  });
});
