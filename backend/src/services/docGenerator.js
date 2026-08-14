const Session = require("../models/Session");
const GeneratedDoc = require("../models/GeneratedDoc");

/**
 * Thrown when there's nothing new to generate from - this is an EXPECTED,
 * normal state (e.g. the developer already generated Progress.md today
 * and hasn't committed anything since), not a failure. Routes and the
 * extension both special-case this to avoid showing a scary error toast
 * for what is actually just "nothing to report."
 */
class NoNewSessionsError extends Error {
  constructor(docType) {
    super(`No new activity since your last ${docType}.md update.`);
    this.name = "NoNewSessionsError";
  }
}

/**
 * ARCHITECTURE NOTE: this module used to call Gemini directly. It no
 * longer does - the AI call now happens inside the VS Code extension via
 * vscode.lm, using whatever chat model the developer already has access
 * to (e.g. GitHub Copilot), instead of a backend-held API key.
 *
 * This module's job is now split into two halves:
 *   1. buildDocPrompt()   - retrieve + compress + construct the prompt text
 *   2. persistGeneratedDoc() - save the content the extension got back
 *
 * The extension calls (1), runs the prompt through vscode.lm itself, then
 * calls (2) with the result. See routes/docs.js for the two endpoints
 * that expose this split.
 */

/**
 * STEP 1 (compress): reduce a raw session's diff/context into a short,
 * cheap one-line summary. Commit message is the strongest signal
 * available (the developer's own stated intent) - lead with it when
 * present, fall back to file-touched heuristics otherwise.
 */
function heuristicSummarize(session) {
  const trigger = session.triggerType;
  const diffLines = session.gitDiff ? session.gitDiff.split("\n").length : 0;

  if (session.commitMessage) {
    return `[commit] "${session.commitMessage.trim()}" on branch ${session.branch} (${diffLines} diff lines)`;
  }

  const filesTouched = session.openFiles.slice(0, 3).join(", ") || "no files recorded";
  return `[${trigger}] Touched: ${filesTouched} (${diffLines} diff lines) on branch ${session.branch}`;
}

async function ensureSummaries(sessions) {
  const summaries = [];

  for (const session of sessions) {
    if (!session.summary) {
      session.summary = heuristicSummarize(session);
      await session.save();
    }
    summaries.push(session.summary);
  }

  return summaries;
}

async function getSessionsSince(projectId, docType) {
  const lastDoc = await GeneratedDoc.findOne({ projectId, docType }).sort({ createdAt: -1 });
  const query = { projectId };

  if (lastDoc) {
    query.createdAt = { $gt: lastDoc.createdAt };
  }

  return Session.find(query).sort({ createdAt: 1 });
}

const GROUNDING_RULES = `
Grounding rules (do not violate these):
1. Only state facts that are directly evidenced in the session summaries below.
2. Never invent a feature, file, library, or decision that isn't shown.
3. If evidence for a section is thin or missing, write "Not yet established"
   for that section instead of guessing or padding with generic filler.
4. Prefer a short, accurate output over a long, speculative one.
`.trim();

function formatSummaries(summaries) {
  return summaries.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

function buildOverviewPrompt(project, summaries) {
  return `
You are drafting Overview.md for a software project, to be read by a
developer joining the project later.

Project name: ${project.name}
Detected tech stack (from package.json): ${project.techStack.join(", ") || "none detected"}

Session summaries so far (chronological):
${formatSummaries(summaries)}

${GROUNDING_RULES}

Output format - use exactly these four headings, in this order:

## Purpose
1-2 sentences on what this project appears to be for, based only on the
evidence above. If it's too early to tell, say so plainly.

## Tech Stack
A bulleted list built from the detected tech stack above. Do not add
libraries that aren't in that list.

## Architecture Notes
Bulleted, only include points directly evidenced by the session summaries
(e.g. "uses WebSocket for real-time messaging" only if a summary shows that).
If nothing is evidenced yet, write "Not yet established."

## Status
One line: how many sessions this overview is based on, and the date range.
`.trim();
}

function buildProgressPrompt(project, summaries) {
  const dateLabel = new Date().toISOString().slice(0, 10);

  return `
You are appending ONE new dated entry to a project's Progress.md changelog.

Project name: ${project.name}

Session summaries since the last entry (chronological):
${formatSummaries(summaries)}

${GROUNDING_RULES}

Output format - exactly this structure, nothing before or after it:

## ${dateLabel}

**Added:**
- (bullet per new capability evidenced above - omit this subsection entirely if none)

**Fixed:**
- (bullet per bug fix evidenced above, prefer quoting the commit message's
  own wording where one is available - omit this subsection if none)

**Changed:**
- (bullet per refactor/modification to existing behavior - omit this
  subsection if none)

Rules for this entry specifically:
- Every bullet must trace back to a specific summary line above - don't merge
  unrelated summaries into one vague bullet.
- If a summary is a commit message in quotes, prefer using its own wording
  over rephrasing it, since it's the developer's own stated intent.
- If NONE of the three subsections have evidenced content, output only:
  "## ${dateLabel}\\n\\nNo significant changes recorded this session."
`.trim();
}

function buildReadmePrompt(project, summaries, sessionCount) {
  const hasNode = project.techStack.some((d) => ["express", "react", "next", "vite"].includes(d.toLowerCase()));

  return `
You are writing a standard external-facing README.md for a project's repo.

Project name: ${project.name}
Detected tech stack: ${project.techStack.join(", ") || "none detected"}

Session summaries (chronological):
${formatSummaries(summaries)}

${GROUNDING_RULES}

Output format - exactly these headings, in this order:

# ${project.name}

One paragraph (2-3 sentences) describing what the project does, based only
on evidence above. If purpose is unclear, say "Purpose not yet established"
instead of guessing.

## Tech Stack
Bulleted list from the detected tech stack only.

## Getting Started
${
  hasNode
    ? "Provide npm-based install/run steps (npm install, then the likely dev command). Mark this block clearly with '(placeholder - verify against package.json scripts)' since exact script names aren't confirmed."
    : "Write '(Setup instructions not yet established - add manually once the install process is confirmed.)'"
}

## Status
One line noting this README was auto-drafted from ${sessionCount} captured
session(s) and should be reviewed by a human before publishing.
`.trim();
}

function buildSummaryPrompt(project, summaries, allSessions, progressEntries) {
  const firstDate = allSessions[0]?.createdAt?.toISOString().slice(0, 10) ?? "unknown";
  const lastDate = allSessions[allSessions.length - 1]?.createdAt?.toISOString().slice(0, 10) ?? "unknown";

  return `
You are writing the final Summary.md for a completed project. This will
likely be reused as portfolio/resume material, so accuracy matters more
than enthusiasm - do not oversell anything that isn't evidenced.

Project name: ${project.name}
Detected tech stack: ${project.techStack.join(", ") || "none detected"}
Development span: ${firstDate} to ${lastDate} (${allSessions.length} captured sessions)

Full session history summaries (chronological):
${formatSummaries(summaries)}

Prior Progress.md entries (already-reviewed changelog):
${progressEntries.map((p) => p.content).join("\n---\n") || "(none recorded)"}

${GROUNDING_RULES}

Output format - exactly these headings, in this order:

## What This Project Does
2-3 sentences, plain language, based only on evidence above.

## Tech Stack
Bulleted list from the detected tech stack only.

## Key Features Built
Bulleted, pulled from the Progress.md entries above where possible - these
are already-reviewed facts, so they're the most reliable source for this
section. Do not add anything not present in either the progress entries or
session summaries.

## Problems Solved
Bulleted, ONLY include entries where a commit message or summary explicitly
indicates a fix or resolved issue (e.g. summaries starting with "[commit]"
whose message mentions "fix", "resolve", "bug", or similar). If none are
evidenced, write "Not yet established" - do not invent debugging stories.

## Development Timeline
One line: "${firstDate} to ${lastDate}, across ${allSessions.length} recorded
sessions."
`.trim();
}

/**
 * PUBLIC: retrieve + compress + construct the prompt for a given doc type.
 * Returns the prompt text plus the session IDs it's grounded in - the
 * extension sends the prompt to vscode.lm, then passes sourceSessionIds
 * back unchanged when it calls persistGeneratedDoc().
 */
async function buildDocPrompt(project, docType) {
  const sessions = await getSessionsSince(project._id, docType);

  if (sessions.length === 0) {
    throw new NoNewSessionsError(docType);
  }

  const summaries = await ensureSummaries(sessions);
  let prompt;

  if (docType === "overview") {
    prompt = buildOverviewPrompt(project, summaries);
  } else if (docType === "progress") {
    prompt = buildProgressPrompt(project, summaries);
  } else if (docType === "readme") {
    prompt = buildReadmePrompt(project, summaries, sessions.length);
  } else if (docType === "summary") {
    const allSessions = await Session.find({ projectId: project._id }).sort({ createdAt: 1 });
    const allSummaries = await ensureSummaries(allSessions);
    const progressEntries = await GeneratedDoc.find({ projectId: project._id, docType: "progress" }).sort({
      createdAt: 1,
    });
    prompt = buildSummaryPrompt(project, allSummaries, allSessions, progressEntries);
    return { prompt, sourceSessionIds: allSessions.map((s) => s._id) };
  } else {
    throw new Error(`Unknown docType: ${docType}`);
  }

  return { prompt, sourceSessionIds: sessions.map((s) => s._id) };
}

/**
 * PUBLIC: persist AI-generated content the extension got back from
 * vscode.lm. sourceSessionIds must be the same array returned by
 * buildDocPrompt(), preserving traceability from doc -> real captured data.
 */
async function persistGeneratedDoc(project, docType, content, sourceSessionIds) {
  const previousVersion = await GeneratedDoc.findOne({ projectId: project._id, docType }).sort({
    version: -1,
  });

  return GeneratedDoc.create({
    projectId: project._id,
    docType,
    content,
    sourceSessionIds,
    status: "draft",
    version: previousVersion ? previousVersion.version + 1 : 1,
  });
}

module.exports = { buildDocPrompt, persistGeneratedDoc, getSessionsSince, ensureSummaries, NoNewSessionsError };
