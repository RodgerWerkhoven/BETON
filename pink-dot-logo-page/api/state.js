const { del, get, list, put } = require("@vercel/blob");
const { verifySession, getDirectory, canAccessProject } = require("./auth-lib");

const EMPTY_STATE = {
  crops: {},
  cropHistory: {},
  review: {},
  addedItems: {},
  text: {},
  voters: {},
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

function statePath(projectId) {
  return `clients/${projectId}/review-state.json`;
}

function requestedProject(req) {
  const url = new URL(req.url || "/api/state", `https://${req.headers.host || "localhost"}`);
  return url.searchParams.get("project") || url.searchParams.get("client") || "Alien";
}

function requestedAsset(req) {
  const url = new URL(req.url || "/api/state", `https://${req.headers.host || "localhost"}`);
  return url.searchParams.get("asset") || url.searchParams.get("id") || "";
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

async function findSuffixedPath(path) {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  if (dot <= slash) return "";
  const prefix = `${path.slice(0, dot)}-`;
  const extension = path.slice(dot);
  const result = await list({ prefix, limit: 50 });
  const candidates = result.blobs
    .filter((blob) => blob.pathname.endsWith(extension))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  return candidates[0]?.pathname || "";
}

async function deleteAssetBlob(pathname) {
  if (!pathname) return false;
  const paths = [pathname];
  const suffixedPath = await findSuffixedPath(pathname);
  if (suffixedPath && !paths.includes(suffixedPath)) paths.push(suffixedPath);
  await del(paths);
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const session = verifySession(req);
    if (!session) return res.status(401).json({ error: "Login nodig" });
    const directory = await getDirectory();
    const projectId = requestedProject(req);
    if (!canAccessProject(directory, session, projectId)) return res.status(403).json({ error: "Geen toegang tot dit project" });

    if (req.method === "GET") {
      return res.status(200).json(await loadState(projectId));
    }

    if (req.method === "POST") {
      const patch = await readBody(req);
      const state = await loadState(projectId);
      mergeMap(state.crops, patch.crops);
      mergeMap(state.cropHistory, patch.cropHistory);
      mergeMap(state.review, patch.review);
      mergeMap(state.addedItems, patch.addedItems);
      mergeMap(state.text, patch.text);
      mergeMap(state.voters, patch.voters);
      await saveState(projectId, state);
      return res.status(200).json(state);
    }

    if (req.method === "DELETE") {
      const assetId = requestedAsset(req);
      if (!assetId) return res.status(400).json({ error: "Asset ontbreekt" });
      const state = await loadState(projectId);
      const item = state.addedItems[assetId];
      if (!item) return res.status(404).json({ error: "Asset niet gevonden" });

      const blobPathname = item.blobPathname || "";
      const blobDeleted = await deleteAssetBlob(blobPathname);
      delete state.addedItems[assetId];
      delete state.review[assetId];
      delete state.crops[assetId];
      delete state.cropHistory[assetId];
      await saveState(projectId, state);
      return res.status(200).json({ deleted: true, asset: assetId, blobDeleted });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "State API failed" });
  }
};
