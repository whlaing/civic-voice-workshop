import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement } from "react";
import { AdminPage } from "./AdminPage";
import { getFeedback } from "../api";

// Match the existing lightweight component-test pattern, without a DOM dependency.
const hooks = vi.hoisted(() => ({ values: [], cursor: 0, effectDeps: [], effectCursor: 0 }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useState(initial) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value) => { hooks.values[index] = value; }];
  },
  useEffect(effect, deps) {
    const index = hooks.effectCursor++;
    const previous = hooks.effectDeps[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) {
      hooks.effectDeps[index] = deps;
      effect();
    }
  },
}));
vi.mock("../api", () => ({ getFeedback: vi.fn() }));

const user = { role: "admin" };
const feedback = [
  { id: "1", name: "Demo Avery", message: "Broken LIGHT at the park", createdAt: "2026-01-01", status: "New" },
  { id: "2", name: "Demo Morgan", message: "More buses please", createdAt: "2026-01-02", status: "In review" },
  { id: "3", name: "Demo Blake", message: "Park benches need repair", createdAt: "2026-01-03", status: "Closed" },
];

function render() {
  hooks.cursor = 0;
  hooks.effectCursor = 0;
  return AdminPage({ user });
}
function findAll(element, predicate) {
  if (!isValidElement(element)) return [];
  return [
    ...(predicate(element) ? [element] : []),
    ...Children.toArray(element.props.children).flatMap((child) => findAll(child, predicate)),
  ];
}
const input = (tree) => findAll(tree, (node) => node.type === "input")[0];
const rows = (tree) => findAll(tree, (node) => node.type === "article");
const status = (tree) => findAll(tree, (node) => node.props.role === "status")[0].props.children;
const clear = (tree) => findAll(tree, (node) => node.type === "button")[0];
function search(value) {
  input(render()).props.onChange({ target: { value } });
  return render();
}
async function load() {
  render();
  await Promise.resolve();
  return render();
}

beforeEach(() => {
  hooks.values = [];
  hooks.cursor = 0;
  hooks.effectDeps = [];
  hooks.effectCursor = 0;
  vi.resetAllMocks();
  getFeedback.mockResolvedValue({ feedback });
});

describe("CV-011 client-side keyword search", () => {
  it("initially shows every loaded item and labels the search control", async () => {
    const tree = await load();
    expect(rows(tree)).toHaveLength(3);
    expect(status(tree)).toBe("3 items");
    const label = findAll(tree, (node) => node.type === "label")[0];
    expect(label.props.htmlFor).toBe(input(tree).props.id);
    expect(input(tree).props.type).toBe("search");
    expect(clear(tree)).toBeUndefined();
  });

  it("matches messages case-insensitively", async () => {
    await load();
    const tree = search("lIgHt");
    expect(rows(tree)).toHaveLength(1);
    expect(rows(tree)[0].key).toContain("1");
    expect(status(tree)).toBe("1 of 3 items");
  });

  it("matches citizen names case-insensitively and trims surrounding whitespace", async () => {
    await load();
    const tree = search("  mOrGaN  ");
    expect(rows(tree)).toHaveLength(1);
    expect(rows(tree)[0].key).toContain("2");
  });

  it("keeps original order when multiple messages match", async () => {
    await load();
    const matches = rows(search("PARK"));
    expect(matches).toHaveLength(2);
    expect(matches[0].key).toContain("1");
    expect(matches[1].key).toContain("3");
  });

  it("shows useful no-match guidance and restores all rows when cleared", async () => {
    await load();
    const tree = search("unmatched");
    expect(rows(tree)).toHaveLength(0);
    expect(status(tree)).toBe("0 of 3 items");
    const message = findAll(tree, (node) => node.props.className === "muted")[0];
    expect(Children.toArray(message.props.children).join("")).toContain("Try another message keyword or citizen name, or clear the search.");
    clear(tree).props.onClick();
    expect(input(render()).props.value).toBe("");
    expect(rows(render())).toHaveLength(3);
  });

  it("treats whitespace-only search as unfiltered", async () => {
    await load();
    expect(rows(search("   "))).toHaveLength(3);
    expect(status(render())).toBe("3 items");
  });

  it("does not request feedback again when typing, deleting, or clearing", async () => {
    await load();
    search("p");
    search("park");
    search("par");
    clear(render()).props.onClick();
    render();
    expect(getFeedback).toHaveBeenCalledExactlyOnceWith(user);
  });
});
