# Resume Where You Left Off

A VS Code extension + backend that captures your coding context (open files,
cursor position, git diffs, commit messages) as you work, so you can restore
your mental state after an interruption instead of rebuilding it from
scratch — and generates living documentation (Overview / Progress / README /
Summary) from that same captured history.

**AI architecture note:** doc generation does NOT use a backend-held API key.
The backend only builds a grounded prompt from real session data; the actual
AI call happens inside the VS Code extension via `vscode.lm`, using whatever
chat model the developer already has access to (typically GitHub Copilot).
This means no API costs on your end and no key management — but it does mean
the developer running this extension needs Copilot (or another chat model
provider) installed and signed in.

## Project structure

```
resume-where-you-left-off/
├── backend/          Express + MongoDB API - builds grounded prompts, no AI key
│   ├── server.js
│   └── src/
│       ├── models/       Project, Session, GeneratedDoc (Mongoose schemas)
│       ├── routes/       projects, sessions, docs (build-prompt / save-doc)
│       ├── services/     docGenerator.js (retrieve + compress + prompt build)
│       ├── middleware/    simple shared-key auth
│       └── config/       db connection
├── backend/test/      Dev-only harnesses to inspect/verify prompts without a live DB
└── extension/         VS Code extension (TypeScript)
    └── src/
        ├── extension.ts       activation, triggers, commands
        ├── captureService.ts  builds snapshot payloads
        ├── gitHelper.ts       branch/diff/commit-message via simple-git
        ├── apiClient.ts       talks to the backend
        └── languageModel.ts   runs prompts via vscode.lm (the user's own AI)
```

## Backend setup

```bash
cd backend
npm install
cp .env.example .env
# fill in MONGODB_URI and pick an API_KEY value (no AI key needed)
npm run dev
```

The server starts on `http://localhost:5000` by default. Check `/health`
to confirm it's up (no API key required for that route).

## Extension setup

```bash
cd extension
npm install
npm run compile
```

Then open the `extension/` folder in VS Code and press **F5** to launch an
Extension Development Host with it loaded. In that new window, open
**Settings → Extensions → Resume Where You Left Off** and set:

- `apiUrl` — `http://localhost:5000` (or wherever the backend is running)
- `apiKey` — must match `API_KEY` from `backend/.env`

You'll also need **GitHub Copilot** (or another extension that registers a
`vscode.lm` chat model provider) installed and signed in — that's what
actually generates the docs. The first AI request in a session will prompt
you for consent; that's expected VS Code behavior, not a bug.

Open any workspace folder with a git repo in the dev host window — the
extension activates automatically and starts capturing.

## What's implemented vs. what's stubbed

**Implemented:**
- Project creation/lookup by workspace path
- Session capture on save (debounced), on commit (via git ref watcher, now
  including the commit message itself as a grounding signal), and on
  window-blur interruption (with a configurable threshold)
- Doc generation split cleanly across the trust boundary: backend builds a
  grounded prompt from real session data (no AI call), the extension runs
  it through the developer's own `vscode.lm` chat model, then posts the
  result back to be saved
- Traceability: every generated doc stores which sessions fed it
- Diff-view review step before any file is written to disk
- Clear, actionable error message (with a shortcut to install Copilot) if
  no chat model is available

**Deliberately stubbed for the MVP (see comments in code):**
- Terminal command capture (`captureService.ts`) — VS Code's shell
  integration API is inconsistent across shells; left as an empty array
  rather than ship something flaky
- Auth is a single shared API key — fine for solo/local use, not
  multi-user ready

## Suggested next steps

1. Get the capture loop working end-to-end (save → session → MongoDB)
   before touching doc generation.
2. Wire up `Progress.md` generation first — it's the most differentiated
   feature and the best demo.
3. Add the React timeline dashboard (not scaffolded yet) once the backend
   data is flowing.
4. Only then invest in terminal capture and a real per-user auth system.
