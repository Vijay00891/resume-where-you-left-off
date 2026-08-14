// Minimal shared-secret auth for the extension <-> backend link.
// Good enough for a solo/local MVP. Swap for real user auth (JWT + accounts)
// before this ever has more than one user.
function requireApiKey(req, res, next) {
  const provided = req.headers["x-api-key"];

  if (!provided || provided !== process.env.API_KEY) {
    return res.status(401).json({ error: "Missing or invalid API key" });
  }

  next();
}

module.exports = requireApiKey;
