const express = require("express");
const Project = require("../models/Project");
const GeneratedDoc = require("../models/GeneratedDoc");
const { buildDocPrompt, persistGeneratedDoc, NoNewSessionsError } = require("../services/docGenerator");

const router = express.Router();

const VALID_TYPES = ["overview", "progress", "readme", "summary"];

/**
 * Step 1 of 2: returns the fully-constructed prompt for a doc type,
 * grounded in real session data, WITHOUT calling any AI model. The
 * extension runs this prompt through vscode.lm (the developer's own
 * Copilot access) and then calls the save endpoint below with the result.
 */
router.post("/:projectId/build-prompt/:docType", async (req, res) => {
  try {
    const { projectId, docType } = req.params;

    if (!VALID_TYPES.includes(docType)) {
      console.warn(`[build-prompt] rejected: invalid docType "${docType}"`);
      return res.status(400).json({ error: `docType must be one of ${VALID_TYPES.join(", ")}` });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { prompt, sourceSessionIds } = await buildDocPrompt(project, docType);
    res.json({ prompt, sourceSessionIds });
  } catch (err) {
    if (err instanceof NoNewSessionsError) {
      // Expected state, not a failure - 200 with a flag the extension
      // checks for, so it can show a calm info message instead of an
      // error toast.
      return res.json({ noNewSessions: true, message: err.message });
    }
    console.error("[build-prompt] error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Step 2 of 2: the extension posts back the content it got from vscode.lm,
 * along with the same sourceSessionIds returned by build-prompt above, so
 * every saved doc stays traceable to real captured data.
 */
router.post("/:projectId/save-doc/:docType", async (req, res) => {
  try {
    const { projectId, docType } = req.params;
    const { content, sourceSessionIds } = req.body;

    if (!VALID_TYPES.includes(docType)) {
      console.warn(`[save-doc] rejected: invalid docType "${docType}"`);
      return res.status(400).json({ error: `docType must be one of ${VALID_TYPES.join(", ")}` });
    }
    if (!content || !Array.isArray(sourceSessionIds)) {
      // This is the check most likely to fire if vscode.lm returned empty
      // content, or the extension's request body got malformed somehow -
      // log exactly what arrived so it's never a mystery.
      console.warn(
        `[save-doc] rejected: content=${JSON.stringify(content)?.slice(0, 100)} ` +
          `sourceSessionIds=${JSON.stringify(sourceSessionIds)}`
      );
      return res.status(400).json({ error: "content and sourceSessionIds are required" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const doc = await persistGeneratedDoc(project, docType, content, sourceSessionIds);
    res.status(201).json(doc);
  } catch (err) {
    console.error("[save-doc] error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Called once the developer approves the draft in the VS Code diff view.
router.post("/:docId/review", async (req, res) => {
  try {
    const doc = await GeneratedDoc.findByIdAndUpdate(
      req.params.docId,
      { status: "reviewed" },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Doc not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
