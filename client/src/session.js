const SESSION_KEY = "civicvoice.session";

function validSession(session) {
  return typeof session?.token === "string" && session.token.length > 0
    && typeof session.user?.nric === "string" && session.user.nric.length > 0
    && typeof session.user?.name === "string" && session.user.name.length > 0
    && ["citizen", "admin"].includes(session.user?.role);
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be disabled; signing out in the current page must still work.
  }
}

export function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (validSession(session)) return session;
  } catch {
    // Malformed or unavailable storage should return the user to sign-in.
  }
  clearSession();
  return null;
}

export function persistSession(session) {
  try {
    // Store only the demo session response, never the sign-in password.
    const { token, user: { nric, name, role } } = session;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user: { nric, name, role } }));
  } catch {
    // If storage is unavailable, keep the session in memory for this page.
  }
}
