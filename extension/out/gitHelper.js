"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentBranch = getCurrentBranch;
exports.getCurrentDiff = getCurrentDiff;
exports.getHeadCommitSha = getHeadCommitSha;
exports.getLastCommitDiff = getLastCommitDiff;
exports.getLastCommitMessage = getLastCommitMessage;
const simple_git_1 = __importDefault(require("simple-git"));
let git = null;
function getGit(workspaceRoot) {
    if (!git) {
        git = (0, simple_git_1.default)(workspaceRoot);
    }
    return git;
}
async function getCurrentBranch(workspaceRoot) {
    try {
        const status = await getGit(workspaceRoot).status();
        return status.current || "unknown";
    }
    catch {
        return "no-git";
    }
}
/**
 * Returns the current uncommitted diff. Truncated to keep payloads small -
 * the backend's compression step summarizes this before it ever reaches
 * a doc-generation prompt, so we don't need the full diff for huge changes.
 */
async function getCurrentDiff(workspaceRoot, maxChars = 8000) {
    try {
        const diff = await getGit(workspaceRoot).diff();
        return diff.length > maxChars ? diff.slice(0, maxChars) + "\n... (truncated)" : diff;
    }
    catch {
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
async function getHeadCommitSha(workspaceRoot) {
    try {
        const log = await getGit(workspaceRoot).log({ maxCount: 1 });
        return log.latest?.hash ?? null;
    }
    catch {
        return null;
    }
}
async function getLastCommitDiff(workspaceRoot, maxChars = 8000) {
    try {
        const diff = await getGit(workspaceRoot).show(["HEAD", "--stat", "-p"]);
        return diff.length > maxChars ? diff.slice(0, maxChars) + "\n... (truncated)" : diff;
    }
    catch {
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
async function getLastCommitMessage(workspaceRoot) {
    try {
        const log = await getGit(workspaceRoot).log({ maxCount: 1 });
        return log.latest?.message ?? "";
    }
    catch {
        return "";
    }
}
//# sourceMappingURL=gitHelper.js.map