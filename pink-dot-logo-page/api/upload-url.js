const { issueSignedToken, presignUrl } = require("@vercel/blob");
const { verifySession, getDirectory, canAccessProject } = require("./auth-lib");

function requestUrl(req) {
  return new URL(req.url || "/api/upload-url", `https://${req.headers.host || "localhost"}`);
}

function safeUploadName(value) {
  return String(value || "upload")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "upload";
}

function allowedContentTypes() {
  return [
    "audio/aac",
    "audio/aacp",
    "audio/mp3",
    "audio/mp4",
    "audio/mpeg",
    "audio/vnd.dlna.adts",
    "audio/x-aac",
    "audio/x-m4a",
    "video/mp4",
    "video/quicktime",
    "video/x-m4v",
  ];
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "Login nodig" });

  const url = requestUrl(req);
  const projectId = url.searchParams.get("project") || "Alien";
  const name = safeUploadName(url.searchParams.get("name"));
  const type = url.searchParams.get("type") || "application/octet-stream";

  const directory = await getDirectory();
  if (!canAccessProject(directory, session, projectId)) return res.status(403).json({ error: "Geen toegang tot dit project" });

  try {
    const maximumSizeInBytes = 250 * 1024 * 1024;
    const pathname = `uploads/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
    const token = await issueSignedToken({
      pathname,
      operations: ["put"],
      allowedContentTypes: allowedContentTypes(),
      maximumSizeInBytes,
      validUntil: Date.now() + 30 * 60 * 1000,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: "put",
      pathname,
      access: "private",
      allowedContentTypes: allowedContentTypes(),
      maximumSizeInBytes,
      addRandomSuffix: true,
    });
    return res.status(200).json({ presignedUrl, pathname, contentType: type });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Upload URL mislukt" });
  }
};
