const { getDirectory, createSession, sessionCookie } = require("./auth-lib");

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { name, password } = await readBody(req);
  const directory = await getDirectory();
  const client = directory.users[name];
  if (!client || client.password !== password) return res.status(401).json({ error: "Login mislukt" });
  res.setHeader("Set-Cookie", sessionCookie(createSession(name, client.role)));
  return res.status(200).json({ client: name, label: client.label || name, role: client.role });
};
