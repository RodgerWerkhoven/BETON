const { verifySession, guestProject } = require("./auth-lib");

module.exports = async function handler(req, res) {
  const session = verifySession(req);
  if (!session) return res.status(401).json({ authenticated: false });
  const project = guestProject(session);
  return res.status(200).json({ authenticated: true, ...session, ...(project ? { project } : {}) });
};
