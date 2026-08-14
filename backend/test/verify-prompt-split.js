// Dev-only harness verifying the buildDocPrompt/persistGeneratedDoc split
// works correctly - no AI call involved anymore, just the retrieve +
// compress + prompt-construction + persistence logic.
const Module = require("module");
const originalRequire = Module.prototype.require;

const db = { sessions: [], docs: [] };
let idCounter = 1;
const nextId = () => `fake_${idCounter++}`;

function makeSessionDoc(data) {
  const doc = { _id: nextId(), createdAt: new Date(), summary: null, ...data };
  doc.save = async () => {
    const idx = db.sessions.findIndex((s) => s._id === doc._id);
    if (idx >= 0) db.sessions[idx] = doc;
  };
  return doc;
}

const SessionMock = {
  create: async (data) => {
    const doc = makeSessionDoc(data);
    db.sessions.push(doc);
    return doc;
  },
  find: (filter) => ({
    sort: async (spec) => {
      let results = db.sessions.filter((s) => s.projectId === filter.projectId);
      if (filter.createdAt?.$gt) results = results.filter((s) => s.createdAt > filter.createdAt.$gt);
      const dir = spec.createdAt === 1 ? 1 : -1;
      return results.sort((a, b) => dir * (a.createdAt - b.createdAt));
    },
  }),
};

const GeneratedDocMock = {
  create: async (data) => {
    const doc = { _id: nextId(), createdAt: new Date(), ...data };
    db.docs.push(doc);
    return doc;
  },
  findOne: (filter) => ({
    sort: async (spec) => {
      let results = db.docs.filter((d) => d.projectId === filter.projectId && d.docType === filter.docType);
      if (results.length === 0) return null;
      const key = spec.createdAt !== undefined ? "createdAt" : "version";
      const dir = spec[key] === 1 ? 1 : -1;
      results.sort((a, b) => dir * (a[key] > b[key] ? 1 : -1));
      return results[results.length - 1];
    },
  }),
  find: (filter) => ({
    sort: async (spec) => {
      let results = db.docs.filter((d) => d.projectId === filter.projectId && d.docType === filter.docType);
      const dir = spec.createdAt === 1 ? 1 : -1;
      return results.sort((a, b) => dir * (a.createdAt - b.createdAt));
    },
  }),
};

Module.prototype.require = function (id) {
  if (id.includes("models/Session") && !id.includes("Project")) return SessionMock;
  if (id.includes("models/GeneratedDoc")) return GeneratedDocMock;
  return originalRequire.apply(this, arguments);
};

const { buildDocPrompt, persistGeneratedDoc } = require("../src/services/docGenerator");

async function main() {
  const project = { _id: "proj_1", name: "NexChat", techStack: ["react", "node", "socket.io"] };

  await SessionMock.create({
    projectId: project._id,
    branch: "main",
    openFiles: ["src/chat.js"],
    gitDiff: "+ io.on('connection', ...)",
    commitMessage: "feat: add real-time chat with Socket.io",
    triggerType: "commit",
  });
  await SessionMock.create({
    projectId: project._id,
    branch: "main",
    openFiles: ["src/webrtc.js"],
    gitDiff: "- if (peer) {\n+ if (peer && peer.connected) {",
    commitMessage: "fix: race condition causing black screen on video call",
    triggerType: "commit",
  });

  console.log("--- Testing buildDocPrompt (no AI call, backend-only) ---\n");

  for (const docType of ["overview", "progress", "readme"]) {
    const { prompt, sourceSessionIds } = await buildDocPrompt(project, docType);
    console.log(`[${docType}] prompt length: ${prompt.length} chars, sourceSessionIds: ${sourceSessionIds.length}`);
    if (!prompt.includes(project.name)) throw new Error(`${docType} prompt missing project name!`);
    if (!prompt.includes("Grounding rules")) throw new Error(`${docType} prompt missing grounding rules!`);
  }

  console.log("\n--- Testing persistGeneratedDoc (simulating extension posting AI result back) ---\n");

  const { prompt, sourceSessionIds } = await buildDocPrompt(project, "progress");
  const fakeAiContent = "## 2026-08-11\n\n**Added:**\n- Real-time chat via Socket.io\n\n**Fixed:**\n- Race condition on video call black screen";
  const savedDoc = await persistGeneratedDoc(project, "progress", fakeAiContent, sourceSessionIds);

  console.log("Saved doc:", { docType: savedDoc.docType, version: savedDoc.version, sourceSessionIds: savedDoc.sourceSessionIds.length });
  if (savedDoc.content !== fakeAiContent) throw new Error("Content mismatch after persist!");
  if (savedDoc.sourceSessionIds.length !== sourceSessionIds.length) throw new Error("sourceSessionIds not preserved!");

  console.log("\nAll checks passed: buildDocPrompt + persistGeneratedDoc split works correctly.");
}

main().catch((err) => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
