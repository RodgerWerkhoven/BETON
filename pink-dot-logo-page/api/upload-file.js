const { put } = require("@vercel/blob");
const { verifySession, getDirectory, canAccessProject } = require("./auth-lib");

function requestedProject(req) {
  const url = new URL(req.url || "/api/upload-file", `https://${req.headers.host || "localhost"}`);
  return url.searchParams.get("project") || "Alien";
}

function requestedName(req) {
  const url = new URL(req.url || "/api/upload-file", `https://${req.headers.host || "localhost"}`);
  return url.searchParams.get("name") || "upload";
}

function safeUploadName(value) {
  return String(value || "upload")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "upload";
}

async function readBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "Login nodig" });

  const directory = await getDirectory();
  const projectId = requestedProject(req);
  if (!canAccessProject(directory, session, projectId)) return res.status(403).json({ error: "Geen toegang tot dit project" });

  try {
    const type = req.headers["content-type"] || "application/octet-stream";
    const body = await readBuffer(req);
    if (!body.length) return res.status(400).json({ error: "Leeg bestand" });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pathname = `uploads/${projectId}/${id}-${safeUploadName(requestedName(req))}`;
    const blob = await put(pathname, body, {
      access: "private",
      addRandomSuffix: true,
      contentType: type,
    });
    return res.status(200).json({ url: blob.url, blobPathname: blob.pathname });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Upload mislukt" });
  }
};
