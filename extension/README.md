# extension

The extension project appears to provide functionality for managing projects and capturing snapshots of codebases, likely integrating with version control systems. It includes features for interacting with APIs, detecting technology stacks, and handling language models.

## Key Features
- Manage projects with functions like `getOrCreateProject`, `markProjectDone`, and `postSession`.
- Capture snapshots of the codebase using `captureSnapshot`.
- Scan codebases with the `scanCodebase` function.
- Interact with Git repositories through functions like `getCurrentBranch` and `getLastCommitMessage`.
- Handle language model operations with `runPrompt` and error management via `NoLanguageModelError`.

## Project Structure
- **src/**: Contains the main source files including API client, capture service, codebase scanner, extension logic, Git helper, and language model.
- **.vscodeignore**: Specifies files to ignore in Visual Studio Code.
- **package.json**: Contains metadata and dependencies for the project.
- **package-lock.json**: Locks the versions of dependencies.
- **tsconfig.json**: TypeScript configuration file.

## Status
This README was auto-drafted from a scan of 6 source file(s) and should be reviewed by a human before publishing.