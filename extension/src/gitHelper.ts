import simpleGit, { SimpleGit } from "simple-git";

let git: SimpleGit | null = null;

function getGit(workspaceRoot: string): SimpleGit {
  if (!git) {
    git = simpleGit(workspaceRoot);
  }
  return git;
}

export async function getCurrentBranch(workspaceRoot: string): Promise<string> {
  try {
    const status = await getGit(workspaceRoot).status();
    return status.current || "unknown";
  } catch {
    return "no-git";
  }
}

/**
 * Returns the current uncommitted diff. Truncated to keep payloads small -
 * the backend's compression step summarizes this before it ever reaches
 * a doc-generation prompt, so we don't need the full diff for huge changes.
 */
export async function getCurrentDiff(workspaceRoot: string, maxChars = 8000): Promise<string> {
  try {
    const diff = await getGit(workspaceRoot).diff();
    return diff.length > maxChars ? diff.slice(0, maxChars) + "\n... (truncated)" : diff;
  } catch {
    return "";
  }
}

/**
 * Detects new commits by comparing the current HEAD SHA against the last
 * one we saw. Call this from a file watcher on .git/refs/heads/** and
 * .git/HEAD (see extension.ts) - committing doesn't reliably fire a single
 * clean VS Code event on its own, so polling the ref on file-change is the
 * simplest reliable approach.
 */
export async function getHeadCommitSha(workspaceRoot: string): Promise<string | null> {
  try {
    const log = await getGit(workspaceRoot).log({ maxCount: 1 });
    return log.latest?.hash ?? null;
  } catch {
    return null;
  }
}

export async function getLastCommitDiff(workspaceRoot: string, maxChars = 8000): Promise<string> {
  try {
    const diff = await getGit(workspaceRoot).show(["HEAD", "--stat", "-p"]);
    return diff.length > maxChars ? diff.slice(0, maxChars) + "\n... (truncated)" : diff;
  } catch {
    return "";
  }
}

/**
 * The single best grounding signal available: a developer's own stated
 * intent, in their own words. A commit message like "fix: null check on
 * req.user" tells the doc-generation prompt exactly what happened and why
 * - far more reliable than asking an LLM to infer intent from a raw diff.
 * Always capture this when triggerType is "commit".
 */
export async function getLastCommitMessage(workspaceRoot: string): Promise<string> {
  try {
    const log = await getGit(workspaceRoot).log({ maxCount: 1 });
    return log.latest?.message ?? "";
  } catch {
    return "";
  }
}
