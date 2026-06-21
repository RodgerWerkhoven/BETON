const { Readable } = require("stream");
const { get, list } = require("@vercel/blob");
const { verifySession, getDirectory, canAccessProject } = require("./auth-lib");

function requestUrl(req) {
  return new URL(req.url || "/api/media", `https://${req.headers.host || "localhost"}`);
}

async function loadMedia(path, range) {
  const headers = {};
  if (range) headers.Range = range;
  return get(path, { access: "private", useCache: false, headers });
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

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "Login nodig" });

  const url = requestUrl(req);
  const projectId = url.searchParams.get("project") || "Alien";
  const path = url.searchParams.get("path");
  if (!path || !path.startsWith(`uploads/${projectId}/`)) return res.status(400).json({ error: "Media pad klopt niet" });

  const directory = await getDirectory();
  if (!canAccessProject(directory, session, projectId)) return res.status(403).json({ error: "Geen toegang tot dit project" });

  try {
    let result = await loadMedia(path, req.headers.range);
    if (!result || !result.stream) {
      const suffixedPath = await findSuffixedPath(path);
      if (suffixedPath) result = await loadMedia(suffixedPath, req.headers.range);
    }
    if (!result || !result.stream) return res.status(404).json({ error: "Media niet gevonden" });

    const contentType = result.headers.get("content-type") || result.blob.contentType || "application/octet-stream";
    const contentLength = result.headers.get("content-length");
    const contentRange = result.headers.get("content-range");
    const acceptRanges = result.headers.get("accept-ranges") || "bytes";
    res.statusCode = contentRange ? 206 : 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", acceptRanges);
    res.setHeader("Cache-Control", "private, no-store");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);
    Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Media stream mislukt" });
  }
};
