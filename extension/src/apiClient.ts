import * as vscode from "vscode";
import axios, { AxiosInstance } from "axios";

export interface SessionPayload {
  projectId: string;
  branch: string;
  openFiles: string[];
  cursorContext?: { file: string; line: number; surroundingCode: string };
  gitDiff: string;
  commitMessage?: string;
  terminalTail: string[];
  triggerType: "interruption" | "commit" | "autosave" | "project_done";
}

function getConfig() {
  const config = vscode.workspace.getConfiguration("resumeWhereYouLeftOff");
  const apiUrl = config.get<string>("apiUrl", "http://localhost:5000");
  const apiKey = config.get<string>("apiKey", "");
  return { apiUrl, apiKey };
}

function getClient(): AxiosInstance {
  const { apiUrl, apiKey } = getConfig();

  if (!apiKey) {
    vscode.window.showWarningMessage(
      "Resume Where You Left Off: no API key set. Configure resumeWhereYouLeftOff.apiKey in settings."
    );
  }

  return axios.create({
    baseURL: apiUrl,
    headers: { "x-api-key": apiKey },
    timeout: 15000,
  });
}

export async function getOrCreateProject(name: string, rootPath: string, techStack: string[]) {
  const client = getClient();
  const res = await client.post("/projects", { name, rootPath, techStack });
  return res.data;
}

export async function postSession(payload: SessionPayload) {
  const client = getClient();
  const res = await client.post("/sessions", payload);
  return res.data;
}

export async function getTimeline(projectId: string) {
  const client = getClient();
  const res = await client.get(`/sessions/project/${projectId}/timeline`);
  return res.data;
}

export async function getLastInterruption(projectId: string) {
  const client = getClient();
  const res = await client.get(`/sessions/project/${projectId}/last-interruption`);
  return res.data;
}

export async function buildDocPrompt(projectId: string, docType: string) {
  const client = getClient();
  const res = await client.post(`/docs/${projectId}/build-prompt/${docType}`);
  return res.data as {
    prompt?: string;
    sourceSessionIds?: string[];
    noNewSessions?: boolean;
    message?: string;
  };
}

export async function saveGeneratedDoc(
  projectId: string,
  docType: string,
  content: string,
  sourceSessionIds: string[]
) {
  const client = getClient();
  const res = await client.post(`/docs/${projectId}/save-doc/${docType}`, {
    content,
    sourceSessionIds,
  });
  return res.data;
}

export async function markDocReviewed(docId: string) {
  const client = getClient();
  const res = await client.post(`/docs/${docId}/review`);
  return res.data;
}

export async function markProjectDone(projectId: string) {
  const client = getClient();
  const res = await client.post(`/projects/${projectId}/mark-done`);
  return res.data;
}
