const crypto = require("crypto");

const CLIENTS = {
  Alien: { password: "Beton", label: "Alien", role: "client" },
  Rodger: { password: "Beton", label: "Rodger", role: "admin" },
};

function secret() {
  return process.env.AUTH_SECRET || process.env.BLOB_READ_WRITE_TOKEN || "local-dev-only";
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function createSession(client) {
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = `${client}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function verifySession(req) {
  const token = parseCookies(req).beton_session;
  if (!token) return null;
  const [client, expires, signature] = token.split(".");
  if (!client || !expires || !signature) return null;
  const payload = `${client}.${expires}`;
  if (signature !== sign(payload)) return null;
  if (Number(expires) < Date.now()) return null;
  if (!CLIENTS[client]) return null;
  return { client, label: CLIENTS[client].label, role: CLIENTS[client].role };
}

function sessionCookie(token) {
  return [
    `beton_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=2592000",
  ].join("; ");
}

function clearCookie() {
  return "beton_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

module.exports = { CLIENTS, createSession, verifySession, sessionCookie, clearCookie };
