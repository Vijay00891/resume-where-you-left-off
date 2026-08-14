const express = require("express");
const Project = require("../models/Project");
const GeneratedDoc = require("../models/GeneratedDoc");

const router = express.Router();

// Extension calls this once per workspace to get-or-create the project record.
router.post("/", async (req, res) => {
  try {
    const { name, rootPath, techStack } = req.body;

    if (!name || !rootPath) {
      return res.status(400).json({ error: "name and rootPath are required" });
    }

    let project = await Project.findOne({ rootPath });

    if (!project) {
      project = await Project.create({ name, rootPath, techStack: techStack || [] });
    }

    res.status(200).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Flips the project to "done". Note: this does NOT generate Summary.md
 * itself anymore - the extension generates it first (build-prompt ->
 * vscode.lm -> save-doc, docType=summary) and calls this endpoint after,
 * once that's confirmed saved. Keeping this endpoint simple avoids the
 * backend needing to know anything about how content gets generated.
 */
router.post("/:id/mark-done", async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status: "done", doneAt: new Date() },
      { new: true }
    );
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/docs", async (req, res) => {
  try {
    const docs = await GeneratedDoc.find({ projectId: req.params.id }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
