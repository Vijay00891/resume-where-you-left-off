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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateProject = getOrCreateProject;
exports.postSession = postSession;
exports.getTimeline = getTimeline;
exports.getLastInterruption = getLastInterruption;
exports.buildDocPrompt = buildDocPrompt;
exports.saveGeneratedDoc = saveGeneratedDoc;
exports.markDocReviewed = markDocReviewed;
exports.markProjectDone = markProjectDone;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
function getConfig() {
    const config = vscode.workspace.getConfiguration("resumeWhereYouLeftOff");
    const apiUrl = config.get("apiUrl", "http://localhost:5000");
    const apiKey = config.get("apiKey", "");
    return { apiUrl, apiKey };
}
function getClient() {
    const { apiUrl, apiKey } = getConfig();
    if (!apiKey) {
        vscode.window.showWarningMessage("Resume Where You Left Off: no API key set. Configure resumeWhereYouLeftOff.apiKey in settings.");
    }
    return axios_1.default.create({
        baseURL: apiUrl,
        headers: { "x-api-key": apiKey },
        timeout: 15000,
    });
}
async function getOrCreateProject(name, rootPath, techStack) {
    const client = getClient();
    const res = await client.post("/projects", { name, rootPath, techStack });
    return res.data;
}
async function postSession(payload) {
    const client = getClient();
    const res = await client.post("/sessions", payload);
    return res.data;
}
async function getTimeline(projectId) {
    const client = getClient();
    const res = await client.get(`/sessions/project/${projectId}/timeline`);
    return res.data;
}
async function getLastInterruption(projectId) {
    const client = getClient();
    const res = await client.get(`/sessions/project/${projectId}/last-interruption`);
    return res.data;
}
async function buildDocPrompt(projectId, docType) {
    const client = getClient();
    const res = await client.post(`/docs/${projectId}/build-prompt/${docType}`);
    return res.data;
}
async function saveGeneratedDoc(projectId, docType, content, sourceSessionIds) {
    const client = getClient();
    const res = await client.post(`/docs/${projectId}/save-doc/${docType}`, {
        content,
        sourceSessionIds,
    });
    return res.data;
}
async function markDocReviewed(docId) {
    const client = getClient();
    const res = await client.post(`/docs/${docId}/review`);
    return res.data;
}
async function markProjectDone(projectId) {
    const client = getClient();
    const res = await client.post(`/projects/${projectId}/mark-done`);
    return res.data;
}
//# sourceMappingURL=apiClient.js.map