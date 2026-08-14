require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const requireApiKey = require("./src/middleware/auth");

const projectRoutes = require("./src/routes/projects");
const sessionRoutes = require("./src/routes/sessions");
const docRoutes = require("./src/routes/docs");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" })); // diffs can get sizable, keep some headroom

// Minimal request logger - logs every request in and every response status
// out, so a silent terminal is never ambiguous about whether a request
// arrived. Deliberately not using morgan/etc to keep dependencies minimal.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Everything below requires the shared API key the extension sends.
app.use(requireApiKey);

app.use("/projects", projectRoutes);
app.use("/sessions", sessionRoutes);
app.use("/docs", docRoutes);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
});
