const { del, list } = require("@vercel/blob");
const { verifySession, getDirectory, saveDirectory, projectsForUser, canManageProject } = require("./auth-lib");

const RODGER_NOTIFY_EMAIL = process.env.RODGER_NOTIFY_EMAIL || "rodgerwerkhoven@gmail.com";

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
  const canManage = canManageProject(project, session);
  return {
    id: project.id,
    title: project.title,
    owner: project.owner || "",
    clientName: project.clientName || "",
    clientEmail: project.clientEmail || "",
    clientPassword: canManage ? project.clientPassword || "" : "",
    projectPassword: canManage ? project.clientPassword || "" : "",
    curatorEmails: project.curatorEmails || [],
    voterName: project.voterName || "",
    voterEmail: project.voterEmail || "",
    voterPassword: canManage ? project.voterPassword || "" : "",
    members: project.members || [],
    createdAt: project.createdAt,
    canManage,
    baseAssets: project.baseAssets === true || project.id === "Alien",
  };
}

function appOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

function projectUrl(req, project) {
  return `${appOrigin(req)}/?project=${encodeURIComponent(project.id)}`;
}

function requestedProject(req) {
  const url = new URL(req.url || "/api/projects", `https://${req.headers.host || "localhost"}`);
  return url.searchParams.get("id") || url.searchParams.get("project") || "";
}

function isMemberElsewhere(directory, projectId, clientName) {
  return Object.values(directory.projects || {}).some((project) => (
    project.id !== projectId && (project.members || []).includes(clientName)
  ));
}

async function deleteProjectBlobs(projectId) {
  const paths = [`clients/${projectId}/review-state.json`];
  try {
    const uploads = await list({ prefix: `uploads/${projectId}/`, limit: 1000 });
    paths.push(...(uploads.blobs || []).map((blob) => blob.pathname));
  } catch (error) {
    console.error("Project upload cleanup listing failed", error);
  }
  try {
    await del(paths);
  } catch (error) {
    console.error("Project blob cleanup failed", error);
  }
}

async function sendRodgerProjectNotification(req, project, creator) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`Project notification skipped: RESEND_API_KEY missing for ${project.id}`);
    return { sent: false, reason: "RESEND_API_KEY missing" };
  }
  const from = process.env.RESEND_FROM_EMAIL || "ANÓTHER DIMENSION CONTENT CURATOR <onboarding@resend.dev>";
  const url = projectUrl(req, project);
  const subject = `Nieuwe content curator: ${project.title}`;
  const curators = (project.curatorEmails || []).join(", ");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.45; color: #111;">
      <h1 style="font-size: 22px;">Nieuwe content curator aangemaakt</h1>
      <p><strong>Project:</strong> ${escapeHtml(project.title)}</p>
      <p><strong>Aangemaakt door:</strong> ${escapeHtml(creator.label || creator.client)}</p>
      <p><strong>Project-login:</strong> ${escapeHtml(project.clientName || project.title || "")}</p>
      <p><strong>Andere curatoren:</strong> ${escapeHtml(curators || "geen")}</p>
      <p><strong>Project URL:</strong> <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
    </div>
  `;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [RODGER_NOTIFY_EMAIL],
      subject,
      html,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Project notification failed", body);
    return { sent: false, reason: body.message || "Resend request failed" };
  }
  return { sent: true, id: body.id || "" };
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
      const body = await readBody(req);
      const title = String(body.title || "").trim();
      const clientName = String(body.clientName || title).trim();
      const clientPassword = String(body.projectPassword || body.clientPassword || "").trim();
      const clientEmail = String(body.clientEmail || "").trim();
      const voterName = String(body.voterName || "").trim();
      const voterPassword = String(body.voterPassword || "").trim();
      const voterEmail = String(body.voterEmail || "").trim();
      const curatorEmails = Array.isArray(body.curatorEmails)
        ? body.curatorEmails.map((email) => String(email || "").trim()).filter(Boolean)
        : [body.curatorEmailA, body.curatorEmailB].map((email) => String(email || "").trim()).filter(Boolean);
      const normalizedCuratorEmails = [...new Set([clientEmail, ...curatorEmails].filter(Boolean))];
      if (!title || !clientName || !clientPassword) return res.status(400).json({ error: "Projectnaam en projectpassword zijn verplicht" });
      if ((voterName || voterPassword || voterEmail) && (!voterName || !voterPassword)) return res.status(400).json({ error: "Derde voter heeft naam en wachtwoord nodig" });

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
      normalizedCuratorEmails.forEach((email) => {
        directory.users[email] = {
          password: clientPassword,
          label: email,
          role: "client",
          email,
        };
      });
      if (voterName) {
        directory.users[voterName] = {
          password: voterPassword,
          label: voterName,
          role: "voter3",
          email: voterEmail,
        };
      }
      const members = [...new Set([clientName, ...normalizedCuratorEmails, voterName, session.client, "Rodger"].filter(Boolean))];
      directory.projects[id] = {
        id,
        title,
        owner: session.client,
        clientName,
        clientEmail: normalizedCuratorEmails[0] || clientEmail,
        clientPassword,
        curatorEmails: normalizedCuratorEmails,
        voterName,
        voterEmail,
        voterPassword,
        members,
        baseAssets: false,
        createdAt: new Date().toISOString(),
      };
      await saveDirectory(directory);
      let notification;
      try {
        notification = await sendRodgerProjectNotification(req, directory.projects[id], session);
      } catch (error) {
        console.error("Project notification crashed", error);
        notification = { sent: false, reason: error.message || "Notification failed" };
      }
      return res.status(201).json({ project: publicProject(directory.projects[id], session), notification });
    }

    if (req.method === "DELETE") {
      const projectId = requestedProject(req);
      const project = directory.projects[projectId];
      if (!project) return res.status(404).json({ error: "Project niet gevonden" });
      if (project.id === "Alien" || project.baseAssets === true) return res.status(403).json({ error: "Basisproject kan niet worden verwijderd" });
      if (!canManageProject(project, session)) return res.status(403).json({ error: "Geen rechten om dit project te verwijderen" });

      delete directory.projects[projectId];
      [project.clientName, project.voterName, ...(project.curatorEmails || [])].filter(Boolean).forEach((member) => {
        if (member !== "Rodger" && member !== project.owner && !isMemberElsewhere(directory, projectId, member)) delete directory.users[member];
      });
      await deleteProjectBlobs(projectId);
      await saveDirectory(directory);
      return res.status(200).json({ deleted: true, id: projectId });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Projects API failed" });
  }
};
