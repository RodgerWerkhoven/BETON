const { verifySession, getDirectory, saveDirectory, projectsForUser } = require("./auth-lib");

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || `project-${Date.now()}`;
}

function publicProject(project, session) {
  return {
    id: project.id,
    title: project.title,
    clientName: project.clientName || "",
    clientEmail: project.clientEmail || "",
    clientPassword: session.role === "admin" ? project.clientPassword || "" : "",
    members: project.members || [],
    createdAt: project.createdAt,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const session = verifySession(req);
    if (!session) return res.status(401).json({ error: "Login nodig" });
    const directory = await getDirectory();

    if (req.method === "GET") {
      return res.status(200).json({
        session,
        projects: projectsForUser(directory, session).map((project) => publicProject(project, session)),
      });
    }

    if (req.method === "POST") {
      if (session.role !== "admin") return res.status(403).json({ error: "Alleen Rodger kan projecten maken" });
      const body = await readBody(req);
      const title = String(body.title || "").trim();
      const clientName = String(body.clientName || "").trim();
      const clientPassword = String(body.clientPassword || "").trim();
      const clientEmail = String(body.clientEmail || "").trim();
      if (!title || !clientName || !clientPassword) return res.status(400).json({ error: "Project, klantnaam en wachtwoord zijn verplicht" });

      let id = slug(title);
      let suffix = 2;
      while (directory.projects[id]) {
        id = `${slug(title)}-${suffix}`;
        suffix += 1;
      }

      directory.users[clientName] = {
        password: clientPassword,
        label: clientName,
        role: "client",
        email: clientEmail,
      };
      directory.projects[id] = {
        id,
        title,
        owner: session.client,
        clientName,
        clientEmail,
        clientPassword,
        members: [clientName],
        createdAt: new Date().toISOString(),
      };
      await saveDirectory(directory);
      return res.status(201).json({ project: publicProject(directory.projects[id], session) });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Projects API failed" });
  }
};
