const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // Path on disk, used by the extension to identify which project a
    // workspace folder belongs to. Not globally unique across users,
    // but fine for a single-user local MVP.
    rootPath: { type: String, required: true, unique: true },
    status: { type: String, enum: ["active", "done"], default: "active" },
    techStack: { type: [String], default: [] }, // detected from package.json etc.
    doneAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
