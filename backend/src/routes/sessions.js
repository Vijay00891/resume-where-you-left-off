const express = require("express");
const Session = require("../models/Session");

const router = express.Router();

// Extension posts a captured snapshot here (on save/blur/commit/etc).
router.post("/", async (req, res) => {
  try {
    const { projectId, branch, openFiles, cursorContext, gitDiff, commitMessage, terminalTail, triggerType } =
      req.body;

    if (!projectId || !triggerType) {
      return res.status(400).json({ error: "projectId and triggerType are required" });
    }

    const session = await Session.create({
      projectId,
      branch,
      openFiles,
      cursorContext,
      gitDiff,
      commitMessage,
      terminalTail,
      triggerType,
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Powers the React dashboard's timeline view.
router.get("/project/:projectId/timeline", async (req, res) => {
  try {
    const sessions = await Session.find({ projectId: req.params.projectId })
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Powers the "resume where you left off" restore - most recent interruption.
router.get("/project/:projectId/last-interruption", async (req, res) => {
  try {
    const session = await Session.findOne({
      projectId: req.params.projectId,
      triggerType: "interruption",
    }).sort({ createdAt: -1 });

    if (!session) return res.status(404).json({ error: "No interruption snapshot found" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
