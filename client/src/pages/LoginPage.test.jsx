import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement } from "react";
import { LoginPage } from "./LoginPage";
import { login } from "../api";

// Exercise form handlers and rerenders without adding a browser DOM dependency.
const state = vi.hoisted(() => ({ values: [], cursor: 0 }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useState(initial) {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (value) => { state.values[index] = value; }];
  },
}));
vi.mock("../api", () => ({ login: vi.fn() }));

const onLogin = vi.fn();
function render() {
  state.cursor = 0;
  return LoginPage({ onLogin });
}
function find(element, predicate) {
  if (!isValidElement(element)) return undefined;
  if (predicate(element)) return element;
  for (const child of Children.toArray(element.props.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}
const idInput = (tree) => find(tree, (node) => node.type === "input" && node.props.type !== "password");
const fieldError = (tree) => find(tree, (node) => node.props.id === "nric-error");
async function submit() {
  const preventDefault = vi.fn();
  await find(render(), (node) => node.type === "form").props.onSubmit({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
}

beforeEach(() => {
  state.values = [];
  state.cursor = 0;
  vi.resetAllMocks();
});

describe("CV-002 workshop ID validation", () => {
  it.each(["", "   ", "S000001A", "S00000001A", "S0000001", "S00000011", "X0000001A", "S000000AA", "S000 001A"])(
    "rejects malformed ID %j with an inline error and no login request",
    async (nric) => {
      idInput(render()).props.onChange({ target: { value: nric } });
      await submit();
      expect(login).not.toHaveBeenCalled();
      expect(onLogin).not.toHaveBeenCalled();
      const tree = render();
      expect(fieldError(tree).props.children).toContain("Enter a workshop ID");
      expect(fieldError(tree).props.role).toBe("alert");
      expect(idInput(tree).props["aria-invalid"]).toBe(true);
      expect(idInput(tree).props["aria-describedby"]).toBe("nric-error");
      expect(find(tree, (node) => node.props.className === "primary-button").props.disabled).toBe(false);
    },
  );

  it.each([
    ["S0000001A", "citizen123", "citizen"],
    ["S0000002B", "admin123", "admin"],
  ])("accepts seeded account %s without a real-identity checksum", async (nric, password, role) => {
    if (role === "admin") find(render(), (node) => node.type === "button" && node.props.children === "Admin").props.onClick();
    idInput(render()).props.onChange({ target: { value: nric } });
    find(render(), (node) => node.props.type === "password").props.onChange({ target: { value: password } });
    const session = { token: "fictional-session", user: { nric, role } };
    login.mockResolvedValueOnce(session);
    await submit();
    expect(login).toHaveBeenCalledExactlyOnceWith({ nric, password, role });
    expect(onLogin).toHaveBeenCalledWith(session);
    expect(fieldError(render())).toBeUndefined();
  });

  it("normalizes surrounding whitespace and lowercase before sending", async () => {
    idInput(render()).props.onChange({ target: { value: " s0000001a " } });
    await submit();
    expect(login).toHaveBeenCalledExactlyOnceWith({ nric: "S0000001A", password: "", role: "citizen" });
  });

  it("clears the inline format error when editing the ID", async () => {
    await submit();
    idInput(render()).props.onChange({ target: { value: "S0000001A" } });
    expect(fieldError(render())).toBeUndefined();
    expect(idInput(render()).props["aria-invalid"]).toBe(false);
  });

  it("continues to display API authentication failures for well-formed IDs", async () => {
    idInput(render()).props.onChange({ target: { value: "S0000001A" } });
    login.mockRejectedValueOnce(new Error("Invalid credentials"));
    await submit();
    expect(find(render(), (node) => node.props.className === "error-message").props.children).toBe("Invalid credentials");
    expect(onLogin).not.toHaveBeenCalled();
    expect(find(render(), (node) => node.props.className === "primary-button").props.disabled).toBe(false);
  });
});
