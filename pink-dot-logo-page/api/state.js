const { get, put } = require("@vercel/blob");
const { verifySession } = require("./auth-lib");

const EMPTY_STATE = {
  crops: {},
  cropHistory: {},
  review: {},
  addedItems: {},
  text: {},
};

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
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

function statePath(client) {
  return `clients/${client}/review-state.json`;
}

function requestedClient(req, session) {
  const url = new URL(req.url || "/api/state", `https://${req.headers.host || "localhost"}`);
  const target = url.searchParams.get("client") || "Alien";
  if (session.role === "admin") return target;
  return session.client;
}

async function loadState(client) {
  try {
    const result = await get(statePath(client), { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return { ...EMPTY_STATE };
    return { ...EMPTY_STATE, ...JSON.parse(await streamToString(result.stream)) };
  } catch (error) {
    if (error?.name === "BlobNotFoundError") return { ...EMPTY_STATE };
    throw error;
  }
}

function mergeMap(target, patch) {
  if (!patch || typeof patch !== "object") return;
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null) delete target[key];
    else target[key] = value;
  });
}

async function saveState(client, state) {
  await put(statePath(client), JSON.stringify(state), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
    contentType: "application/json",
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const session = verifySession(req);
    if (!session) return res.status(401).json({ error: "Login nodig" });
    const client = requestedClient(req, session);

    if (req.method === "GET") {
      return res.status(200).json(await loadState(client));
    }

    if (req.method === "POST") {
      const patch = await readBody(req);
      const state = await loadState(client);
      mergeMap(state.crops, patch.crops);
      mergeMap(state.cropHistory, patch.cropHistory);
      mergeMap(state.review, patch.review);
      mergeMap(state.addedItems, patch.addedItems);
      mergeMap(state.text, patch.text);
      await saveState(client, state);
      return res.status(200).json(state);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "State API failed" });
  }
};
