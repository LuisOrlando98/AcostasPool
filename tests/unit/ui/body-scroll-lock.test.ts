import { describe, expect, it, vi } from "vitest";
import {
  computeLockStyles,
  createScrollLockController,
  isIosPlatform,
  parsePixels,
  type ScrollLockMetrics,
  type ScrollLockStyleSnapshot,
  type ScrollLockTarget,
} from "@/lib/ui/body-scroll-lock";

const LOCK_COUNT_ATTR = "data-ap-scroll-lock-count";
const SCROLLBAR_WIDTH = 15;
const BODY_PADDING_RIGHT = 8;
const SCROLL_Y = 320;

const EMPTY_STYLES: ScrollLockStyleSnapshot = {
  overflow: "",
  paddingRight: "",
  position: "",
  top: "",
  left: "",
  right: "",
  width: "",
};

const DESKTOP_METRICS: ScrollLockMetrics = {
  scrollbarWidth: SCROLLBAR_WIDTH,
  scrollX: 0,
  scrollY: SCROLL_Y,
  bodyPaddingRight: BODY_PADDING_RIGHT,
  useFixedPosition: false,
};

const IOS_METRICS: ScrollLockMetrics = {
  scrollbarWidth: 0,
  scrollX: 0,
  scrollY: SCROLL_Y,
  bodyPaddingRight: 0,
  useFixedPosition: true,
};

function createFakeBody(): ScrollLockTarget & { readonly attributes: Map<string, string> } {
  const attributes = new Map<string, string>();
  return {
    attributes,
    style: { ...EMPTY_STYLES },
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => {
      attributes.set(name, value);
    },
    removeAttribute: (name) => {
      attributes.delete(name);
    },
  };
}

function createFakeEnvironment(metrics: ScrollLockMetrics) {
  const body = createFakeBody();
  const scrollTo = vi.fn<(x: number, y: number) => void>();
  return { body, scrollTo, readMetrics: () => metrics };
}

describe("parsePixels", () => {
  it.each([
    ["12px", 12],
    ["0.5px", 0.5],
    ["", 0],
    ["auto", 0],
    [null, 0],
    [undefined, 0],
  ])("parses %p as %p", (raw, expected) => {
    expect(parsePixels(raw)).toBe(expected);
  });
});

describe("isIosPlatform", () => {
  it("detects iPhone and iPad user agents", () => {
    expect(
      isIosPlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", maxTouchPoints: 5 })
    ).toBe(true);
    expect(isIosPlatform({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0)", maxTouchPoints: 5 })).toBe(
      true
    );
  });

  it("detects iPadOS with a desktop user agent through touch points", () => {
    expect(
      isIosPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })
    ).toBe(true);
  });

  it("treats a desktop Mac and Android as non-iOS", () => {
    expect(
      isIosPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 })
    ).toBe(false);
    expect(isIosPlatform({ userAgent: "Mozilla/5.0 (Linux; Android 14)", maxTouchPoints: 5 })).toBe(
      false
    );
  });
});

describe("computeLockStyles", () => {
  it("hides overflow and compensates the scrollbar width on desktop", () => {
    expect(computeLockStyles(DESKTOP_METRICS, EMPTY_STYLES)).toEqual({
      ...EMPTY_STYLES,
      overflow: "hidden",
      paddingRight: `${BODY_PADDING_RIGHT + SCROLLBAR_WIDTH}px`,
    });
  });

  it("keeps the current padding when there is no scrollbar", () => {
    const current = { ...EMPTY_STYLES, paddingRight: "4px" };
    expect(computeLockStyles({ ...DESKTOP_METRICS, scrollbarWidth: 0 }, current)).toEqual({
      ...current,
      overflow: "hidden",
    });
  });

  it("fixes the body at the current scroll offset on iOS", () => {
    expect(computeLockStyles(IOS_METRICS, EMPTY_STYLES)).toEqual({
      overflow: "hidden",
      paddingRight: "",
      position: "fixed",
      top: `-${SCROLL_Y}px`,
      left: "0px",
      right: "0",
      width: "100%",
    });
  });
});

describe("createScrollLockController", () => {
  it("applies the lock styles once and counts nested locks", () => {
    // Arrange
    const env = createFakeEnvironment(DESKTOP_METRICS);
    const controller = createScrollLockController(env);

    // Act
    const unlockFirst = controller.lock();
    const unlockSecond = controller.lock();

    // Assert
    expect(env.body.style.overflow).toBe("hidden");
    expect(env.body.style.paddingRight).toBe(`${BODY_PADDING_RIGHT + SCROLLBAR_WIDTH}px`);
    expect(env.body.attributes.get(LOCK_COUNT_ATTR)).toBe("2");

    // Act
    unlockFirst();

    // Assert
    expect(env.body.style.overflow).toBe("hidden");
    expect(env.body.attributes.get(LOCK_COUNT_ATTR)).toBe("1");

    // Act
    unlockSecond();

    // Assert
    expect(env.body.style).toEqual(EMPTY_STYLES);
    expect(env.body.attributes.has(LOCK_COUNT_ATTR)).toBe(false);
    expect(env.scrollTo).not.toHaveBeenCalled();
  });

  it("restores the previous inline styles instead of clearing them", () => {
    // Arrange
    const env = createFakeEnvironment(DESKTOP_METRICS);
    env.body.style.overflow = "auto";
    env.body.style.paddingRight = "2px";
    const controller = createScrollLockController(env);

    // Act
    const unlock = controller.lock();
    unlock();

    // Assert
    expect(env.body.style.overflow).toBe("auto");
    expect(env.body.style.paddingRight).toBe("2px");
  });

  it("restores the scroll position after the iOS fixed-body technique", () => {
    // Arrange
    const env = createFakeEnvironment(IOS_METRICS);
    const controller = createScrollLockController(env);

    // Act
    const unlock = controller.lock();

    // Assert
    expect(env.body.style.position).toBe("fixed");
    expect(env.body.style.top).toBe(`-${SCROLL_Y}px`);
    expect(env.body.style.width).toBe("100%");

    // Act
    unlock();

    // Assert
    expect(env.body.style).toEqual(EMPTY_STYLES);
    expect(env.scrollTo).toHaveBeenCalledTimes(1);
    expect(env.scrollTo).toHaveBeenCalledWith(0, SCROLL_Y);
  });

  it("ignores repeated calls to the same unlock function", () => {
    // Arrange
    const env = createFakeEnvironment(DESKTOP_METRICS);
    const controller = createScrollLockController(env);
    const unlockFirst = controller.lock();
    controller.lock();

    // Act
    unlockFirst();
    unlockFirst();

    // Assert
    expect(env.body.attributes.get(LOCK_COUNT_ATTR)).toBe("1");
    expect(env.body.style.overflow).toBe("hidden");
  });

  it("clears the lock styles when the count attribute was set externally", () => {
    // Arrange
    const env = createFakeEnvironment(DESKTOP_METRICS);
    env.body.setAttribute(LOCK_COUNT_ATTR, "1");
    env.body.style.overflow = "hidden";
    const controller = createScrollLockController(env);

    // Act
    const unlock = controller.lock();
    unlock();
    unlock();

    // Assert
    expect(env.body.attributes.get(LOCK_COUNT_ATTR)).toBe("1");
    expect(env.body.style.overflow).toBe("hidden");
  });

  it("relocks with fresh metrics after a full release", () => {
    // Arrange
    const env = createFakeEnvironment(DESKTOP_METRICS);
    const controller = createScrollLockController(env);
    controller.lock()();

    // Act
    const unlock = controller.lock();

    // Assert
    expect(env.body.style.overflow).toBe("hidden");
    expect(env.body.attributes.get(LOCK_COUNT_ATTR)).toBe("1");
    unlock();
    expect(env.body.style).toEqual(EMPTY_STYLES);
  });
});
