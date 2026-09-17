import { describe, expect, it } from "vitest";
import { createLayerStack, isEscapeKeyEvent } from "@/lib/ui/use-escape-key";

describe("createLayerStack", () => {
  it("treats the last pushed entry as the top layer", () => {
    // Arrange
    const stack = createLayerStack<string>();

    // Act
    stack.push("parent");
    stack.push("child");

    // Assert
    expect(stack.isTop("child")).toBe(true);
    expect(stack.isTop("parent")).toBe(false);
    expect(stack.size()).toBe(2);
  });

  it("restores the previous layer as top when the last one is removed", () => {
    // Arrange
    const stack = createLayerStack<string>();
    stack.push("parent");
    stack.push("child");

    // Act
    stack.remove("child");

    // Assert
    expect(stack.isTop("parent")).toBe(true);
    expect(stack.size()).toBe(1);
  });

  it("keeps the top layer when a lower layer is removed out of order", () => {
    // Arrange
    const stack = createLayerStack<string>();
    stack.push("parent");
    stack.push("child");

    // Act
    stack.remove("parent");

    // Assert
    expect(stack.isTop("child")).toBe(true);
    expect(stack.size()).toBe(1);
  });

  it("moves an entry to the top when it is pushed again", () => {
    // Arrange
    const stack = createLayerStack<string>();
    stack.push("first");
    stack.push("second");

    // Act
    stack.push("first");

    // Assert
    expect(stack.isTop("first")).toBe(true);
    expect(stack.size()).toBe(2);
  });

  it("reports nothing as top when empty", () => {
    // Arrange
    const stack = createLayerStack<string>();

    // Act
    stack.push("only");
    stack.remove("only");

    // Assert
    expect(stack.isTop("only")).toBe(false);
    expect(stack.size()).toBe(0);
  });
});

describe("isEscapeKeyEvent", () => {
  it.each(["Escape", "Esc"])("accepts the %s key", (key) => {
    expect(
      isEscapeKeyEvent({ key, defaultPrevented: false, isComposing: false })
    ).toBe(true);
  });

  it("ignores other keys", () => {
    expect(
      isEscapeKeyEvent({ key: "Enter", defaultPrevented: false, isComposing: false })
    ).toBe(false);
  });

  it("ignores Escape already consumed by an inner component", () => {
    expect(
      isEscapeKeyEvent({ key: "Escape", defaultPrevented: true, isComposing: false })
    ).toBe(false);
  });

  it("ignores Escape pressed during an IME composition", () => {
    expect(
      isEscapeKeyEvent({ key: "Escape", defaultPrevented: false, isComposing: true })
    ).toBe(false);
  });
});
