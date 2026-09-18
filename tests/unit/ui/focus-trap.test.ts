import { describe, expect, it } from "vitest";
import {
  getTabbableElements,
  isTabbable,
  resolveTabTarget,
  sortByTabIndex,
  type FocusableLike,
} from "@/lib/ui/use-focus-trap";

type FakeFocusableOptions = {
  readonly tabIndex?: number;
  readonly disabled?: boolean;
  readonly insideInert?: boolean;
  readonly rendered?: boolean;
};

function fakeFocusable({
  tabIndex = 0,
  disabled = false,
  insideInert = false,
  rendered = true,
}: FakeFocusableOptions = {}): FocusableLike {
  return {
    tabIndex,
    hasAttribute: (name) => name === "disabled" && disabled,
    closest: (selector) => (selector === "[inert]" && insideInert ? {} : null),
    getClientRects: () => ({ length: rendered ? 1 : 0 }),
  };
}

describe("isTabbable", () => {
  it("accepts a rendered enabled element with a non-negative tabindex", () => {
    expect(isTabbable(fakeFocusable())).toBe(true);
  });

  it("rejects elements removed from the tab order with tabindex -1", () => {
    expect(isTabbable(fakeFocusable({ tabIndex: -1 }))).toBe(false);
  });

  it("rejects disabled elements", () => {
    expect(isTabbable(fakeFocusable({ disabled: true }))).toBe(false);
  });

  it("rejects elements inside an inert subtree", () => {
    expect(isTabbable(fakeFocusable({ insideInert: true }))).toBe(false);
  });

  it("rejects elements that are not rendered", () => {
    expect(isTabbable(fakeFocusable({ rendered: false }))).toBe(false);
  });
});

describe("sortByTabIndex", () => {
  it("places positive tabindexes first in ascending order, then document order", () => {
    // Arrange
    const elements = [
      { id: "a", tabIndex: 0 },
      { id: "b", tabIndex: 3 },
      { id: "c", tabIndex: 0 },
      { id: "d", tabIndex: 1 },
    ];

    // Act
    const sorted = sortByTabIndex(elements);

    // Assert
    expect(sorted.map((element) => element.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("returns a new array without mutating the input", () => {
    // Arrange
    const elements = [{ tabIndex: 2 }, { tabIndex: 0 }];

    // Act
    const sorted = sortByTabIndex(elements);

    // Assert
    expect(sorted).not.toBe(elements);
    expect(elements.map((element) => element.tabIndex)).toEqual([2, 0]);
  });
});

describe("resolveTabTarget", () => {
  const elements = ["first", "middle", "last"] as const;

  it("returns null when there is nothing to focus", () => {
    expect(resolveTabTarget([], null, false)).toBeNull();
  });

  it("wraps from the last element to the first on Tab", () => {
    expect(resolveTabTarget(elements, "last", false)).toBe("first");
  });

  it("wraps from the first element to the last on Shift+Tab", () => {
    expect(resolveTabTarget(elements, "first", true)).toBe("last");
  });

  it("lets the browser move naturally from a middle element", () => {
    expect(resolveTabTarget(elements, "middle", false)).toBeNull();
    expect(resolveTabTarget(elements, "middle", true)).toBeNull();
  });

  it("re-enters the container when focus is outside of it", () => {
    expect(resolveTabTarget(elements, null, false)).toBe("first");
    expect(resolveTabTarget(elements, null, true)).toBe("last");
    expect(resolveTabTarget(elements, "container", false)).toBe("first");
  });
});

describe("getTabbableElements", () => {
  it("filters out non-tabbable candidates and sorts the rest", () => {
    // Arrange
    const close = { ...fakeFocusable(), id: "close" };
    const hidden = { ...fakeFocusable({ rendered: false }), id: "hidden" };
    const priority = { ...fakeFocusable({ tabIndex: 1 }), id: "priority" };
    const disabled = { ...fakeFocusable({ disabled: true }), id: "disabled" };
    const container = {
      querySelectorAll: () => [close, hidden, priority, disabled],
    } as unknown as ParentNode;

    // Act
    const tabbable = getTabbableElements(container) as unknown as Array<{ id: string }>;

    // Assert
    expect(tabbable.map((element) => element.id)).toEqual(["priority", "close"]);
  });
});
