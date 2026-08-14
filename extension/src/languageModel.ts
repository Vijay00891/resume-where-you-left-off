import * as vscode from "vscode";

/**
 * Uses the developer's own AI access inside VS Code (GitHub Copilot, or
 * any other extension that registers a language model chat provider)
 * instead of a backend-held API key. This is the vscode.lm API:
 * https://code.visualstudio.com/api/extension-guides/ai/language-model
 *
 * Trade-offs worth knowing:
 * - Requires the user to have a chat model provider (usually Copilot)
 *   installed and signed in. If none is available, we surface a clear
 *   message rather than failing silently.
 * - The first call in a session triggers a one-time consent prompt from
 *   VS Code - this is expected, not a bug.
 * - Subject to whatever rate limits the user's own Copilot plan has.
 */

export class NoLanguageModelError extends Error {
  constructor() {
    super(
      "No AI chat model is available. Install and sign in to GitHub Copilot " +
        "(or another extension that provides a language model) to use AI-generated docs."
    );
    this.name = "NoLanguageModelError";
  }
}

async function selectModel(): Promise<vscode.LanguageModelChat> {
  // Prefer Copilot's gpt-4o if available; fall back to any registered model.
  let models = await vscode.lm.selectChatModels({ vendor: "copilot", family: "gpt-4o" });

  if (models.length === 0) {
    models = await vscode.lm.selectChatModels({});
  }

  if (models.length === 0) {
    throw new NoLanguageModelError();
  }

  return models[0];
}

/**
 * Sends a single-turn prompt to the user's available chat model and
 * returns the full response text (streaming is collected internally,
 * not surfaced - the extension shows the final result in a diff view,
 * not a live stream).
 */
export async function runPrompt(
  prompt: string,
  token: vscode.CancellationToken
): Promise<string> {
  const model = await selectModel();
  const messages = [vscode.LanguageModelChatMessage.User(prompt)];

  let response: vscode.LanguageModelChatResponse;

  try {
    response = await model.sendRequest(messages, {}, token);
  } catch (err) {
    if (err instanceof vscode.LanguageModelError) {
      // Known failure modes: model doesn't exist, user declined consent,
      // or quota limits were hit. Surface the reason plainly.
      throw new Error(`AI request failed (${err.code}): ${err.message}`);
    }
    throw err;
  }

  let result = "";
  for await (const fragment of response.text) {
    result += fragment;
  }

  return result;
}
