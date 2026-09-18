import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findExistingLocalPath,
  getPrivateStorageRoot,
  listLocalFiles,
  resolveLocalCandidates,
  resolveLocalWritePath,
} from "@/lib/storage/local-fs";

const INVOICE_KEY = "invoices/2026/09/cust-1/INV-1.pdf";
const AVATAR_KEY = "avatars/tech/mike-1.jpg";
const REPOSITORY_PREFIX = "uploads/customers/cust-1/repository/files/";

let workingDirectory = "";

function writeFixture(root: string, key: string, contents: string) {
  const absolute = path.join(root, ...key.split("/"));
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  return absolute;
}

beforeEach(() => {
  workingDirectory = mkdtempSync(path.join(tmpdir(), "acostas-storage-"));
  vi.spyOn(process, "cwd").mockReturnValue(workingDirectory);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(workingDirectory, { recursive: true, force: true });
});

describe("storage roots", () => {
  it("defaults the private root to <cwd>/storage/private", () => {
    expect(getPrivateStorageRoot()).toBe(path.join(workingDirectory, "storage", "private"));
  });

  it("honours an absolute STORAGE_LOCAL_DIR", () => {
    vi.stubEnv("STORAGE_LOCAL_DIR", "/var/data/acostas");

    expect(getPrivateStorageRoot()).toBe("/var/data/acostas");
  });

  it("resolves a relative STORAGE_LOCAL_DIR against the working directory", () => {
    vi.stubEnv("STORAGE_LOCAL_DIR", "data/private");

    expect(getPrivateStorageRoot()).toBe(path.join(workingDirectory, "data", "private"));
  });
});

describe("resolveLocalWritePath", () => {
  it("writes private resources outside public/", () => {
    expect(resolveLocalWritePath(INVOICE_KEY)).toBe(
      path.join(workingDirectory, "storage", "private", "invoices", "2026", "09", "cust-1", "INV-1.pdf")
    );
  });

  it("keeps avatars inside public/", () => {
    expect(resolveLocalWritePath(AVATAR_KEY)).toBe(
      path.join(workingDirectory, "public", "avatars", "tech", "mike-1.jpg")
    );
  });

  it("rejects a key that escapes its root", () => {
    expect(() => resolveLocalWritePath("../../etc/passwd")).toThrow("Invalid storage path");
  });
});

describe("resolveLocalCandidates", () => {
  it("tries the private root first and the legacy public root second", () => {
    expect(resolveLocalCandidates(INVOICE_KEY)).toEqual([
      path.join(workingDirectory, "storage", "private", "invoices", "2026", "09", "cust-1", "INV-1.pdf"),
      path.join(workingDirectory, "public", "invoices", "2026", "09", "cust-1", "INV-1.pdf"),
    ]);
  });

  it("only looks in public/ for public resources", () => {
    expect(resolveLocalCandidates(AVATAR_KEY)).toHaveLength(1);
  });
});

describe("findExistingLocalPath", () => {
  it("finds a historical file still stored under public/", async () => {
    const legacy = writeFixture(path.join(workingDirectory, "public"), INVOICE_KEY, "legacy");

    expect(await findExistingLocalPath(INVOICE_KEY)).toBe(legacy);
  });

  it("prefers the private copy when both exist", async () => {
    writeFixture(path.join(workingDirectory, "public"), INVOICE_KEY, "legacy");
    const current = writeFixture(
      path.join(workingDirectory, "storage", "private"),
      INVOICE_KEY,
      "current"
    );

    expect(await findExistingLocalPath(INVOICE_KEY)).toBe(current);
  });

  it("returns null when the file is in neither root", async () => {
    expect(await findExistingLocalPath(INVOICE_KEY)).toBeNull();
  });
});

describe("listLocalFiles", () => {
  it("merges both roots so the explorer still sees historical files", async () => {
    writeFixture(path.join(workingDirectory, "public"), `${REPOSITORY_PREFIX}old.pdf`, "old");
    writeFixture(
      path.join(workingDirectory, "storage", "private"),
      `${REPOSITORY_PREFIX}new.pdf`,
      "new"
    );

    const entries = await listLocalFiles(REPOSITORY_PREFIX);

    expect(entries.map((entry) => entry.key).sort()).toEqual([
      `${REPOSITORY_PREFIX}new.pdf`,
      `${REPOSITORY_PREFIX}old.pdf`,
    ]);
  });

  it("lists a key only once when it exists in both roots", async () => {
    writeFixture(path.join(workingDirectory, "public"), `${REPOSITORY_PREFIX}a.pdf`, "old");
    writeFixture(path.join(workingDirectory, "storage", "private"), `${REPOSITORY_PREFIX}a.pdf`, "new");

    const entries = await listLocalFiles(REPOSITORY_PREFIX);

    expect(entries).toHaveLength(1);
    expect(entries[0].size).toBe("new".length);
  });

  it("also merges both roots at the repository root prefix", async () => {
    const rootPrefix = "uploads/customers/cust-1/repository/";
    writeFixture(path.join(workingDirectory, "public"), `${rootPrefix}files/old.pdf`, "old");
    writeFixture(path.join(workingDirectory, "storage", "private"), `${rootPrefix}files/new.pdf`, "new");

    const entries = await listLocalFiles(rootPrefix);

    expect(entries.map((entry) => entry.key).sort()).toEqual([
      `${rootPrefix}files/new.pdf`,
      `${rootPrefix}files/old.pdf`,
    ]);
  });

  it("returns an empty list when no root has the prefix", async () => {
    expect(await listLocalFiles(REPOSITORY_PREFIX)).toEqual([]);
  });
});
