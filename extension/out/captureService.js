"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectTechStack = detectTechStack;
exports.captureSnapshot = captureSnapshot;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gitHelper_1 = require("./gitHelper");
const apiClient_1 = require("./apiClient");
function getWorkspaceRoot() {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
}
function getOpenFiles() {
    return vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .map((tab) => tab.input?.uri?.fsPath)
        .filter((p) => Boolean(p));
}
function getCursorContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return undefined;
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
function getTerminalTail() {
    return [];
}
/** Best-effort tech stack detection from package.json - used once at
 * project creation, not on every snapshot. */
function detectTechStack(workspaceRoot) {
    const pkgPath = path.join(workspaceRoot, "package.json");
    if (!fs.existsSync(pkgPath))
        return [];
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        return Object.keys(deps).slice(0, 20); // cap it, this just seeds the AI prompt
    }
    catch {
        return [];
    }
}
/**
 * Builds and sends a snapshot. `projectId` is resolved once at activation
 * and cached by the caller (see extension.ts).
 */
async function captureSnapshot(projectId, triggerType) {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot)
        return;
    const branch = await (0, gitHelper_1.getCurrentBranch)(workspaceRoot);
    const isCommit = triggerType === "commit";
    const gitDiff = isCommit ? await (0, gitHelper_1.getLastCommitDiff)(workspaceRoot) : await (0, gitHelper_1.getCurrentDiff)(workspaceRoot);
    const commitMessage = isCommit ? await (0, gitHelper_1.getLastCommitMessage)(workspaceRoot) : "";
    const payload = {
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
        await (0, apiClient_1.postSession)(payload);
    }
    catch (err) {
        // Fail silently in the status bar rather than interrupting the
        // developer with an error popup every time the backend is unreachable.
        console.error("[resumeWhereYouLeftOff] failed to post session:", err.message);
    }
}
//# sourceMappingURL=captureService.js.map