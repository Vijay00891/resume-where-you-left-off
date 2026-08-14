import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getCurrentBranch, getCurrentDiff, getLastCommitDiff, getLastCommitMessage } from "./gitHelper";
import { postSession, SessionPayload } from "./apiClient";

function getWorkspaceRoot(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
}

function getOpenFiles(): string[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .map((tab) => (tab.input as any)?.uri?.fsPath)
    .filter((p): p is string => Boolean(p));
}

function getCursorContext() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;

  const line = editor.selection.active.line;
  const startLine = Math.max(0, line - 3);
  const endLine = Math.min(editor.document.lineCount - 1, line + 3);

  let surroundingCode = "";
  for (let i = startLine; i <= endLine; i++) {
    surroundingCode += editor.document.lineAt(i).text + "\n";
  }

  return {
    file: editor.document.uri.fsPath,
    line: line + 1, // 1-indexed for humans
    surroundingCode,
  };
}

/**
 * TERMINAL CAPTURE - KNOWN LIMITATION.
 * VS Code's terminal shell-integration API (window.onDidStartTerminalShellExecution)
 * can expose recent commands, but it requires shell integration to be enabled
 * and behaves inconsistently across shells (bash/zsh/pwsh). For the MVP we
 * leave this as an empty array rather than ship a flaky implementation.
 * Revisit once the core snapshot loop is proven out.
 */
function getTerminalTail(): string[] {
  return [];
}

/** Best-effort tech stack detection from package.json - used once at
 * project creation, not on every snapshot. */
export function detectTechStack(workspaceRoot: string): string[] {
  const pkgPath = path.join(workspaceRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return [];

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Object.keys(deps).slice(0, 20); // cap it, this just seeds the AI prompt
  } catch {
    return [];
  }
}

/**
 * Builds and sends a snapshot. `projectId` is resolved once at activation
 * and cached by the caller (see extension.ts).
 */
export async function captureSnapshot(
  projectId: string,
  triggerType: SessionPayload["triggerType"]
) {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  const branch = await getCurrentBranch(workspaceRoot);
  const isCommit = triggerType === "commit";
  const gitDiff = isCommit ? await getLastCommitDiff(workspaceRoot) : await getCurrentDiff(workspaceRoot);
  const commitMessage = isCommit ? await getLastCommitMessage(workspaceRoot) : "";

  const payload: SessionPayload = {
    projectId,
    branch,
    openFiles: getOpenFiles(),
    cursorContext: getCursorContext(),
    gitDiff,
    commitMessage,
    terminalTail: getTerminalTail(),
    triggerType,
  };

  try {
    await postSession(payload);
  } catch (err: any) {
    // Fail silently in the status bar rather than interrupting the
    // developer with an error popup every time the backend is unreachable.
    console.error("[resumeWhereYouLeftOff] failed to post session:", err.message);
  }
}
