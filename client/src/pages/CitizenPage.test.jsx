import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement } from "react";
import { CitizenPage } from "./CitizenPage";
import { submitFeedback } from "../api";

// Exercise the component's handlers and rerenders without adding a DOM dependency.
// Real browser typing and paste behavior is verified separately.
const state = vi.hoisted(() => ({ values: [], cursor: 0 }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useState(initial) {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (value) => { state.values[index] = value; }];
  },
}));
vi.mock("../api", () => ({ submitFeedback: vi.fn() }));

const user = { nric: "S0000001A", name: "Demo Citizen" };
function render() {
  state.cursor = 0;
  return CitizenPage({ user });
}
function find(element, predicate) {
  if (!isValidElement(element)) return undefined;
  if (predicate(element)) return element;
  for (const child of Children.toArray(element.props.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}
const textarea = (tree) => find(tree, (node) => node.type === "textarea");
const counter = (tree) => find(tree, (node) => node.props.id === "feedback-character-count");
const counterText = (tree) => Children.toArray(counter(tree).props.children).join("");
async function submit(tree) {
  const preventDefault = vi.fn();
  await find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
}

beforeEach(() => {
  state.values = [];
  state.cursor = 0;
  vi.resetAllMocks();
});

describe("CV-003 feedback character count and limit", () => {
  it("starts at zero and associates the counter with a 500-character textarea", () => {
    const tree = render();
    expect(counterText(tree)).toBe("0 / 500 characters");
    expect(textarea(tree).props.maxLength).toBe(500);
    expect(textarea(tree).props["aria-describedby"]).toBe(counter(tree).props.id);
  });

  it("updates the count after typing and deleting", () => {
    textarea(render()).props.onChange({ target: { value: "Hello" } });
    expect(counterText(render())).toBe("5 / 500 characters");
    textarea(render()).props.onChange({ target: { value: "Hi" } });
    expect(counterText(render())).toBe("2 / 500 characters");
  });

  it("caps oversized input at 500 characters", () => {
    textarea(render()).props.onChange({ target: { value: "x".repeat(501) } });
    const tree = render();
    expect(textarea(tree).props.value).toBe("x".repeat(500));
    expect(counterText(tree)).toBe("500 / 500 characters");
  });

  it("submits exactly 500 characters and resets the counter on success", async () => {
    const message = "x".repeat(500);
    textarea(render()).props.onChange({ target: { value: message } });
    await submit(render());
    expect(submitFeedback).toHaveBeenCalledWith({ ...user, message });
    expect(counterText(render())).toBe("0 / 500 characters");
  });

  it("blocks submission if overlong state bypasses input handling", async () => {
    render();
    state.values[0] = "x".repeat(501);
    await submit(render());
    expect(submitFeedback).not.toHaveBeenCalled();
    const error = find(render(), (node) => node.props.className === "error-message");
    expect(error.props.children).toBe("Please keep feedback to 500 characters or fewer.");
  });

  it("keeps the message and count when the request fails", async () => {
    submitFeedback.mockRejectedValueOnce(new Error("Try again"));
    textarea(render()).props.onChange({ target: { value: "Hello" } });
    await submit(render());
    expect(textarea(render()).props.value).toBe("Hello");
    expect(counterText(render())).toBe("5 / 500 characters");
  });
});
