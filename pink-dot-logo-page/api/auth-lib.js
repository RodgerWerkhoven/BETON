const crypto = require("crypto");
const { get, put } = require("@vercel/blob");

const CLIENTS = {
  Alien: { password: "Beton", label: "Alien", role: "client" },
  Rodger: { password: "Beton", label: "Rodger", role: "admin" },
  Voter3: { password: "Beton", label: "Voter 3", role: "voter3" },
};

const DEFAULT_DIRECTORY = {
  users: {
    Rodger: { password: "Beton", label: "Rodger", role: "admin" },
    Alien: { password: "Beton", label: "Alien", role: "client" },
    Voter3: { password: "Beton", label: "Voter 3", role: "voter3" },
  },
  projects: {
    Alien: {
      id: "Alien",
      title: "BETON",
      owner: "Rodger",
      members: ["Alien", "Rodger", "Voter3"],
      baseAssets: true,
      createdAt: "2026-06-20T00:00:00.000Z",
    },
  },
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

async function streamToString(stream) {
  const reader = stream.getReader();
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function getDirectory() {
  try {
    const result = await get("directory.json", { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return structuredClone(DEFAULT_DIRECTORY);
    const directory = JSON.parse(await streamToString(result.stream));
    const merged = {
      users: { ...DEFAULT_DIRECTORY.users, ...(directory.users || {}) },
      projects: { ...DEFAULT_DIRECTORY.projects, ...(directory.projects || {}) },
    };
    return normalizeDirectory(merged);
  } catch (error) {
    if (error?.name === "BlobNotFoundError") return structuredClone(DEFAULT_DIRECTORY);
    return structuredClone(DEFAULT_DIRECTORY);
  }
}

function ensureRodgerMembership(project) {
  const members = new Set(project.members || []);
  members.add("Rodger");
  return { ...project, members: [...members] };
}

function normalizeDirectory(directory) {
  Object.entries(directory.projects || {}).forEach(([id, project]) => {
    let normalized = ensureRodgerMembership(project);
    if (id === "Alien") {
      const members = new Set(normalized.members || []);
      members.add("Voter3");
      normalized = { ...normalized, members: [...members], baseAssets: true };
    }
    directory.projects[id] = normalized;
  });
  return directory;
}

async function saveDirectory(directory) {
  normalizeDirectory(directory);
  await put("directory.json", JSON.stringify(directory), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
    contentType: "application/json",
  });
}

function projectsForUser(directory, session) {
  const projects = Object.values(directory.projects || {}).map(ensureRodgerMembership);
  if (session.role === "admin") return projects;
  return projects.filter((project) => (project.members || []).includes(session.client));
}

function canAccessProject(directory, session, projectId) {
  if (session.role === "admin") return Boolean(directory.projects[projectId]);
  const project = directory.projects[projectId];
  return Boolean(project && ensureRodgerMembership(project).members.includes(session.client));
}

function canManageProject(project, session) {
  return session.role === "admin" || project.owner === session.client;
}

function createSession(client, role = CLIENTS[client]?.role || "client") {
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = `v2.${client}.${role}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function verifySession(req) {
  const token = parseCookies(req).beton_session;
  if (!token) return null;
  const parts = token.split(".");
  let client;
  let role;
  let expires;
  let signature;
  let payload;
  if (parts[0] === "v2") {
    [, client, role, expires, signature] = parts;
    payload = `v2.${client}.${role}.${expires}`;
  } else {
    [client, expires, signature] = parts;
    role = CLIENTS[client]?.role;
    payload = `${client}.${expires}`;
  }
  if (!client || !role || !expires || !signature) return null;
  if (signature !== sign(payload)) return null;
  if (Number(expires) < Date.now()) return null;
  return { client, label: CLIENTS[client]?.label || client, role };
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

module.exports = {
  CLIENTS,
  createSession,
  verifySession,
  sessionCookie,
  clearCookie,
  getDirectory,
  saveDirectory,
  projectsForUser,
  canAccessProject,
  canManageProject,
};
