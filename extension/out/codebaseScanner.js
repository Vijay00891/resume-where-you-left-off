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
exports.scanCodebase = scanCodebase;
exports.formatScanForPrompt = formatScanForPrompt;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Grounds Overview.md/README.md generation in the ACTUAL codebase, not just
 * captured session history. This matters for two real cases session-based
 * grounding can't cover:
 *   1. An existing codebase opened for the first time - no session history
 *      exists yet, but the code itself has plenty to describe.
 *   2. Sparse session capture - a developer who mostly doesn't commit with
 *      descriptive messages still has a real, describable codebase.
 *
 * Deliberately uses lightweight regex extraction, not a full AST parser -
 * good enough to ground the prompt in real symbol names without pulling in
 * a heavy dependency. This will miss some patterns (e.g. unusual export
 * styles) - that's an acceptable tradeoff for a fast, dependency-free scan.
 */
const EXCLUDED_DIRS = new Set([
    "node_modules",
    ".git",
    "out",
    "dist",
    "build",
    ".vscode",
    "coverage",
    ".next",
    "__pycache__",
    ".venv",
    "venv",
]);
const SOURCE_EXTENSIONS = new Set([".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".go"]);
const MAX_FILES_SCANNED = 150;
const MAX_CHARS_PER_FILE = 4000; // read enough for signatures without pulling whole large files
const MAX_TOTAL_SIGNATURE_CHARS = 6000; // keep the final prompt payload bounded
function walkDirectory(rootPath, currentPath, fileList) {
    if (fileList.length >= MAX_FILES_SCANNED)
        return;
    let entries;
    try {
        entries = fs.readdirSync(currentPath, { withFileTypes: true });
    }
    catch {
        return; // permissions issue or race condition - skip silently
    }
    for (const entry of entries) {
        if (fileList.length >= MAX_FILES_SCANNED)
            return;
        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith("."))
                continue;
            walkDirectory(rootPath, path.join(currentPath, entry.name), fileList);
        }
        else {
            const ext = path.extname(entry.name);
            const relativePath = path.relative(rootPath, path.join(currentPath, entry.name));
            fileList.push(relativePath);
            if (SOURCE_EXTENSIONS.has(ext)) {
                // handled separately in extractSignatures - this list is just the tree
            }
        }
    }
}
/**
 * Extracts function/class/export/route-handler signatures via regex.
 * Covers common JS/TS patterns and a few Python ones - not exhaustive,
 * but every extracted line is a REAL line from the file, so there's no
 * risk of inventing symbols that don't exist.
 */
function extractSignatures(content) {
    const patterns = [
        /^\s*(export\s+)?(async\s+)?function\s+\w+\s*\([^)]*\)/gm,
        /^\s*(export\s+)?class\s+\w+/gm,
        /^\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>/gm,
        /^\s*(app|router)\.(get|post|put|delete|patch)\s*\(\s*["'`][^"'`]+["'`]/gm, // Express-style routes
        /^\s*def\s+\w+\s*\([^)]*\)/gm, // Python
        /^\s*module\.exports\s*=/gm,
        /^\s*export\s+default\s+/gm,
    ];
    const found = [];
    for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches)
            found.push(...matches.map((m) => m.trim()));
    }
    return found;
}
function scanCodebase(workspaceRoot) {
    const fileList = [];
    walkDirectory(workspaceRoot, workspaceRoot, fileList);
    const fileSignatures = [];
    let totalSignatureChars = 0;
    let truncated = fileList.length >= MAX_FILES_SCANNED;
    for (const relativePath of fileList) {
        if (totalSignatureChars >= MAX_TOTAL_SIGNATURE_CHARS) {
            truncated = true;
            break;
        }
        const ext = path.extname(relativePath);
        if (!SOURCE_EXTENSIONS.has(ext))
            continue;
        const fullPath = path.join(workspaceRoot, relativePath);
        let content;
        try {
            content = fs.readFileSync(fullPath, "utf-8").slice(0, MAX_CHARS_PER_FILE);
        }
        catch {
            continue;
        }
        const signatures = extractSignatures(content);
        if (signatures.length === 0)
            continue;
        fileSignatures.push({ file: relativePath, signatures });
        totalSignatureChars += signatures.join("\n").length;
    }
    return { fileTree: fileList, fileSignatures, truncated };
}
/**
 * Formats the scan into prompt-ready text. Every line here traces back to
 * an actual file/symbol - this is the grounding data for codebase-aware
 * doc generation.
 */
function formatScanForPrompt(scan) {
    const treeSection = `File tree (${scan.fileTree.length} files${scan.truncated ? ", truncated" : ""}):\n${scan.fileTree
        .slice(0, 100)
        .map((f) => `  ${f}`)
        .join("\n")}`;
    const signaturesSection = scan.fileSignatures
        .map((fs) => `${fs.file}:\n${fs.signatures.map((s) => `  ${s}`).join("\n")}`)
        .join("\n\n");
    return `${treeSection}\n\nExtracted function/class/route signatures (from actual source files):\n\n${signaturesSection || "(no recognizable signatures found)"}`;
}
//# sourceMappingURL=codebaseScanner.js.map