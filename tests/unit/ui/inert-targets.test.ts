import { describe, expect, it } from "vitest";
import {
  APP_MODAL_SIZE_CLASS,
  applyInertOutside,
  collectInertTargets,
  joinClassNames,
  type InertTarget,
} from "@/components/ui/AppModal";

interface FakeNode extends InertTarget<FakeNode> {
  readonly id: string;
  readonly attributes: Set<string>;
  parentElement: FakeNode | null;
}

type FakeNodeOptions = {
  readonly inert?: boolean;
  readonly children?: readonly FakeNode[];
};

/** Crea un nodo y enlaza a sus hijos (la referencia al padre es inherente al DOM). */
function createNode(
  id: string,
  tagName: string,
  { inert = false, children = [] }: FakeNodeOptions = {}
): FakeNode {
  const attributes = new Set<string>(inert ? ["inert"] : []);
  const node: FakeNode = {
    id,
    tagName,
    attributes,
    parentElement: null,
    children,
    hasAttribute: (name) => attributes.has(name),
    setAttribute: (name) => {
      attributes.add(name);
    },
    removeAttribute: (name) => {
      attributes.delete(name);
    },
  };
  children.forEach((child) => {
    child.parentElement = node;
  });
  return node;
}

/**
 * body
 *  ├─ div#app
 *  │   ├─ main#content
 *  │   └─ aside#sidebar (ya inert)
 *  ├─ script#script
 *  └─ div#layer (el modal en portal)
 */
function buildTree() {
  const content = createNode("content", "MAIN");
  const sidebar = createNode("sidebar", "ASIDE", { inert: true });
  const app = createNode("app", "DIV", { children: [content, sidebar] });
  const script = createNode("script", "SCRIPT");
  const layer = createNode("layer", "DIV");
  const body = createNode("body", "BODY", { children: [app, script, layer] });
  return { body, app, content, sidebar, layer };
}

describe("collectInertTargets", () => {
  it("returns the rendered siblings of a portal layer under body", () => {
    // Arrange
    const { layer } = buildTree();

    // Act
    const targets = collectInertTargets(layer);

    // Assert
    expect(targets.map((target) => target.id)).toEqual(["app"]);
  });

  it("walks up to body collecting siblings at each level for inline modals", () => {
    // Arrange
    const { content } = buildTree();

    // Act
    const targets = collectInertTargets(content);

    // Assert
    // `sidebar` ya es inert y `script` no se renderiza: ninguno se incluye.
    expect(targets.map((target) => target.id)).toEqual(["layer"]);
  });

  it("returns nothing for a detached node", () => {
    expect(collectInertTargets(createNode("orphan", "DIV"))).toEqual([]);
  });
});

describe("applyInertOutside", () => {
  it("marks the collected targets as inert and reverts only those on cleanup", () => {
    // Arrange
    const { app, sidebar, layer } = buildTree();

    // Act
    const release = applyInertOutside(layer);

    // Assert
    expect(app.attributes.has("inert")).toBe(true);
    expect(layer.attributes.has("inert")).toBe(false);

    // Act
    release();

    // Assert
    expect(app.attributes.has("inert")).toBe(false);
    expect(sidebar.attributes.has("inert")).toBe(true);
  });
});

describe("joinClassNames", () => {
  it("skips empty and undefined parts", () => {
    expect(joinClassNames("a", undefined, "", "  ", "b")).toBe("a b");
  });

  it("maps every size to a Tailwind max-width class", () => {
    expect(
      Object.values(APP_MODAL_SIZE_CLASS).every((value) => value.startsWith("max-w-"))
    ).toBe(true);
  });
});
