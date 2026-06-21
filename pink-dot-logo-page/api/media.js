const { Readable } = require("stream");
const { get } = require("@vercel/blob");
const { verifySession, getDirectory, canAccessProject } = require("./auth-lib");

function requestUrl(req) {
  return new URL(req.url || "/api/media", `https://${req.headers.host || "localhost"}`);
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
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const result = await get(path, { access: "private", useCache: false, headers });
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
