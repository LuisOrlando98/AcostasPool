import { describe, expect, it } from "vitest";
import { resolveParams } from "@/lib/utils/params";

describe("resolveParams", () => {
  it("returns a plain object by reference", async () => {
    const params = { id: "42" };
    await expect(resolveParams(params)).resolves.toBe(params);
  });

  it("unwraps a promise of params", async () => {
    await expect(resolveParams(Promise.resolve({ id: "42" }))).resolves.toEqual({
      id: "42",
    });
  });

  it("unwraps a custom thenable", async () => {
    const thenable = {
      then(resolve: (value: { id: string }) => void) {
        resolve({ id: "thenable" });
      },
    };
    await expect(
      resolveParams(thenable as unknown as Promise<{ id: string }>)
    ).resolves.toEqual({ id: "thenable" });
  });

  it("passes through null and undefined", async () => {
    await expect(resolveParams(null)).resolves.toBeNull();
    await expect(resolveParams(undefined)).resolves.toBeUndefined();
  });

  it("passes through falsy primitives", async () => {
    await expect(resolveParams(0)).resolves.toBe(0);
    await expect(resolveParams("")).resolves.toBe("");
    await expect(resolveParams(false)).resolves.toBe(false);
  });

  it("passes through arrays and strings", async () => {
    await expect(resolveParams(["a", "b"])).resolves.toEqual(["a", "b"]);
    await expect(resolveParams("slug")).resolves.toBe("slug");
  });

  it("always returns a native Promise", () => {
    expect(resolveParams({ id: "x" })).toBeInstanceOf(Promise);
    expect(resolveParams(Promise.resolve({ id: "x" }))).toBeInstanceOf(Promise);
  });

  it("propagates rejections from the input promise", async () => {
    await expect(resolveParams(Promise.reject(new Error("boom")))).rejects.toThrow(
      "boom"
    );
  });

  it("does not treat objects with a non-function 'then' as thenables", async () => {
    const params = { then: "not a function" };
    await expect(resolveParams(params)).resolves.toBe(params);
  });
});
