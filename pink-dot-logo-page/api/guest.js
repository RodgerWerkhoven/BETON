const { getDirectory, createSession, sessionCookie } = require("./auth-lib");

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

// Grant a vote-only "guest" session for a project — no password. This is what a
// shared 🚀 link uses: anyone with the link can view + vote, nothing else.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { project } = await readBody(req);
  if (!project) return res.status(400).json({ error: "Project ontbreekt" });
  const directory = await getDirectory();
  if (!directory.projects[project]) return res.status(404).json({ error: "Project bestaat niet" });
  const client = `guest:${project}`;
  res.setHeader("Set-Cookie", sessionCookie(createSession(client, "guest")));
  return res.status(200).json({ client, label: "Gast", role: "guest", project });
};
