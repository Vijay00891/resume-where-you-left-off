# Resume Where You Left Off

A VS Code extension that captures your coding context as you work — so you
can resume after an interruption in one click instead of losing 20+
minutes rebuilding your train of thought — and auto-generates living
documentation (Overview.md, Progress.md, README.md, Summary.md) grounded
in your real development history, using your own AI (GitHub Copilot via
`vscode.lm`), not a separate paid API.

## Why

Developers lose an average of 23+ minutes of focus after every
interruption. Existing tools (Notion, Linear, task managers) organize
*what to do* — none of them capture and restore your *mental state*.
Separately, most teams skip documentation because it's tedious and goes
stale immediately — and every AI doc generator on the market only sees
your current code, never *why* it evolved the way it did.

This project solves both with one underlying data source: a timeline of
real development sessions.

## Features

- **Automatic context capture** — on save (debounced), on every git
  commit (including the commit message as a grounding signal), and on
  window-blur interruptions (configurable threshold)
- **`Resume: Restore Where I Left Off`** — jumps straight back to the
  file/line you were on before you got pulled away
- **`Resume: Generate Documentation`** — Overview/Progress/README grounded
  in your real session history, not guessed from a single code snapshot
- **`Resume: Generate Overview/README from Codebase Scan`** — grounds
  documentation in your actual source files (function/class/route
  signatures), so it works from the very first run, even on an existing
  codebase with no captured history yet
- **`Resume: Mark Project Done`** — generates a Summary.md meant to double
  as a first draft of a portfolio/resume bullet point
- **Zero AI cost** — doc generation runs through `vscode.lm`, using
  whatever chat model you already have access to in VS Code (GitHub
  Copilot), not a backend-held API key
- **Grounded, not hallucinated** — every prompt includes explicit
  anti-hallucination rules ("if evidence is thin, say so"), and every
  generated doc stores exactly which sessions it came from
- **Review before write** — AI output always opens in an editor tab for
  approval; nothing touches disk automatically

## Architecture

```
VS Code Extension  <-->  Node/Express Backend  <-->  MongoDB
   (captures sessions,        (builds grounded          (Project,
    runs prompts via           prompts - no AI            Session,
    vscode.lm/Copilot)         call happens here)         GeneratedDoc)
```

The backend never calls an AI model — it only builds a grounded prompt
from real session data. The extension is the only thing that talks to an
AI, using the developer's own access, then posts the result back to be
saved.

## Tech Stack

**Backend:** Node.js, Express, MongoDB/Mongoose
**Extension:** TypeScript, VS Code Extension API, `vscode.lm`, simple-git
**Packaging:** `@vscode/vsce`

## Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env
# fill in MONGODB_URI and API_KEY
npm run dev
```

### Extension
```bash
cd extension
npm install
npm run compile
```
Open the `extension` folder in VS Code, press `F5` to launch a dev
instance, or package it as a real install:
```bash
npx vsce package --allow-missing-repository
code --install-extension resume-where-you-left-off-0.0.1.vsix
```

You'll need **GitHub Copilot** (or another extension providing a
`vscode.lm` chat model) installed and signed in — that's what actually
generates the docs.

## Known Limitations

- Codebase scanner uses a hardcoded exclusion list, not `.gitignore`
- No automated test suite committed yet
- Terminal command capture is stubbed (VS Code's shell integration API is
  inconsistent across shells)
- Regex-based signature extraction, not a full AST parser

## License

MIT
