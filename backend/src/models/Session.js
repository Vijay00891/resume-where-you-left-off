const mongoose = require("mongoose");

const cursorContextSchema = new mongoose.Schema(
  {
    file: String,
    line: Number,
    surroundingCode: String,
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    branch: { type: String, default: "unknown" },
    openFiles: { type: [String], default: [] },
    cursorContext: cursorContextSchema,
    gitDiff: { type: String, default: "" },
    // The developer's own stated intent, in their own words - captured
    // only on commit triggers. This is the single strongest grounding
    // signal the prompts have; prioritize it over diff-guessing wherever
    // it's available.
    commitMessage: { type: String, default: "" },
    terminalTail: { type: [String], default: [] }, // last few shell commands, best-effort
    triggerType: {
      type: String,
      enum: ["interruption", "commit", "autosave", "project_done"],
      required: true,
    },
    // One-line auto-summary of this session, filled in lazily by the
    // compression step before a doc-generation run (see docGenerator.js).
    // Kept separate from raw data so we don't re-summarize the same
    // session twice.
    summary: { type: String, default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model("Session", sessionSchema);
