import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Children } from "react";
import App from "./App";
import { Header } from "./components/Header";
import { LoginPage } from "./pages/LoginPage";
import { CitizenPage } from "./pages/CitizenPage";
import { AdminPage } from "./pages/AdminPage";

// Match the existing component-handler tests without requiring a DOM dependency.
const state = vi.hoisted(() => ({ values: [], cursor: 0 }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useState(initial) {
    const index = state.cursor++;
    if (!(index in state.values)) {
      state.values[index] = typeof initial === "function" ? initial() : initial;
    }
    return [state.values[index], (value) => { state.values[index] = value; }];
  },
}));

const key = "civicvoice.session";
const makeSession = (role) => ({
  token: `fictional-${role}-token`,
  user: { nric: role === "admin" ? "S0000002B" : "S0000001A", name: `Demo ${role}`, role },
});
function render() {
  state.cursor = 0;
  return App();
}
function reload() {
  state.values = [];
  return render();
}
const component = (tree, type) => Children.toArray(tree.props.children).find((child) => child.type === type);

beforeEach(() => {
  state.values = [];
  state.cursor = 0;
  const data = new Map();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((item) => data.get(item) ?? null),
    setItem: vi.fn((item, value) => data.set(item, String(value))),
    removeItem: vi.fn((item) => data.delete(item)),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("CV-001 persisted demo sessions", () => {
  it("starts on the login page when no session is saved", () => {
    expect(component(render(), LoginPage)).toBeDefined();
  });

  it.each([["citizen", CitizenPage], ["admin", AdminPage]])(
    "keeps a successful %s session on the correct page after refresh",
    (role, page) => {
      const session = makeSession(role);
      component(render(), LoginPage).props.onLogin(session);
      expect(JSON.parse(localStorage.getItem(key))).toEqual(session);
      expect(component(render(), page).props.user).toEqual(session.user);
      const restored = reload();
      expect(component(restored, LoginPage)).toBeUndefined();
      expect(component(restored, page).props.user).toEqual(session.user);
      expect(component(restored, Header).props.user).toEqual(session.user);
    },
  );

  it.each(["citizen", "admin"])("clears %s persistence on logout, including after refresh", (role) => {
    localStorage.setItem(key, JSON.stringify(makeSession(role)));
    component(render(), Header).props.onLogout();
    expect(localStorage.getItem(key)).toBeNull();
    expect(component(render(), LoginPage)).toBeDefined();
    expect(component(reload(), LoginPage)).toBeDefined();
  });

  it.each([
    "broken JSON", "null", "{}", "[]", '{"user":null}',
    JSON.stringify({ ...makeSession("citizen"), token: "" }),
    JSON.stringify({ token: "demo", user: { name: "Demo", nric: "S0000001A", role: "unknown" } }),
    JSON.stringify({ token: "demo", user: { name: {}, nric: "S0000001A", role: "citizen" } }),
  ])("discards malformed or unsupported session data: %s", (stored) => {
    localStorage.setItem(key, stored);
    expect(component(render(), LoginPage)).toBeDefined();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("does not persist passwords or unrelated login fields", () => {
    const session = makeSession("citizen");
    component(render(), LoginPage).props.onLogin({
      ...session, password: "fictional-password", user: { ...session.user, password: "fictional-password" },
    });
    expect(JSON.parse(localStorage.getItem(key))).toEqual(session);
  });

  it("keeps login and logout usable when browser storage is blocked", () => {
    for (const method of ["getItem", "setItem", "removeItem"]) {
      localStorage[method].mockImplementation(() => { throw new Error("Storage blocked"); });
    }
    component(render(), LoginPage).props.onLogin(makeSession("citizen"));
    expect(component(render(), CitizenPage)).toBeDefined();
    component(render(), Header).props.onLogout();
    expect(component(render(), LoginPage)).toBeDefined();
    expect(component(reload(), LoginPage)).toBeDefined();
  });
});
