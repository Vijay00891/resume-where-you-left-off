const mongoose = require("mongoose");

const generatedDocSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    docType: {
      type: String,
      enum: ["overview", "progress", "readme", "summary"],
      required: true,
    },
    content: { type: String, required: true },
    // Traceability: which sessions actually fed this doc, so it's never a
    // black box. Useful for the "regenerate since last update" flow too.
    sourceSessionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Session" }],
    status: { type: String, enum: ["draft", "reviewed"], default: "draft" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Most recent doc of a given type for a project
generatedDocSchema.index({ projectId: 1, docType: 1, createdAt: -1 });

module.exports = mongoose.model("GeneratedDoc", generatedDocSchema);
