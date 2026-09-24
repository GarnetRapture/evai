# AGENTS.md — EverSoul AI Chat agent contract

This file is the **single owner of agent discipline** for this repository. `CLAUDE.md`, `GEMINI.md`, `.github/*` and `.claude/skills/*` are harnesses that point here; they never copy rule text. Whichever AI works here converges on the same discipline, the same procedure and the same verification.

Written in English because only agents read it. Human-facing documents (`README.md`, `README.en.md`, `docs/*`) keep their own languages.

## 0. Authority

`user's latest explicit instruction` > `this file` > active entries in `AI_TRACKING.md` > `.claude/skills/*` > code comments > `docs/*`

- On conflict follow that order, and fix the lower document in the same task when you are authorized to touch it.
- `AI_TRACKING.md` is a record, not current truth. Verify code facts against current source.
- Owners marked `// [핵심 아키텍처 · 수정 금지]` or `// [프롬프트 가이드 철학 · 수정 금지]` change only when the user's instruction names that owner. The latter allows bug fixes only.

## 1. Absolute discipline

- Think in Korean and reply in Korean. Keep identifiers, commands, paths and quoted code in their original form.
- Do exactly what was asked, where it was asked, the way it was asked. Never widen scope or drift to another problem.
- Never convert an execution request into a review, a plan or a question. Never use a tool that hands a choice back to the user.
- Never stop, pause or cancel unfinished authorized work on your own. When blocked, diagnose the cause and continue through another permitted path. Only a real external dependency justifies stopping.
- No fake work: no mock, stub, dummy logic, TODO, "temporary workaround" or "just the core part".
- Never call something done that was not verified. A passing build, an existing file or a partly working feature is not completion evidence.
- Warnings and errors are evidence of incomplete work. Fix the cause instead of suppressing, filtering or swallowing them.
- Never re-verify an established fact with a different command, tool or wording.
- Install or clone only under an explicit user instruction. Never create a virtual environment.
- Put temporary artifacts only in `tmp-claude/`. Never leave them in source folders or commits.
- `scripts/` holds only tools the user explicitly approved. Every other script you generate belongs in `tmp-claude/`.
- Write no comments in code you author; express intent through structure and naming. The two lock markers above are the only exception.
- Report size matches work size. No apology, no self-reproach, no restating rules, no preamble, no postamble.

## 2. Work gates

Close 1-4 before editing, execute at 5, validate with 6-10. These are evidence questions, not ten tool calls.

| Gate | Closing evidence |
| --- | --- |
| 1 What | Target symbol/file/artifact, acceptance criteria, verification boundary |
| 2 Why | The user requirement, defect or invariant that demands this change |
| 3 How | Real path: entry point -> caller -> owner -> boundary -> observable result |
| 4 When | Call order, initialization, lifetime, async ordering, failure timing |
| 5 Implement | Changed files and contracts with the rationale |
| 6 Alignment | Every change serves the target, reason and path from 1-3 |
| 7 Impact | Affected owners, callers, interfaces and configuration |
| 8 Closure | Producers and consumers actually agree |
| 9 Consistency | Matches existing contracts, naming and types; checks end with zero warnings and zero errors |
| 10 Centralization | Each shared concept has exactly one owner |

## 3. FIX process

1. Fix the reproduction path: which input produces which observable result.
2. Name the responsible owner and the violated contract. A log is a symptom, not a specification.
3. Apply the smallest **complete** correction at that owner. A local patch that only moves the symptom is forbidden.
4. Close the affected connections in the same task.
5. Rerun only the affected check. Never rerun checks that already passed.

Never use build -> guess -> micro-patch -> rebuild as a design process.

## 4. Error process

- On failure, preserve the command, arguments, working directory, exit code and output, then classify the cause: name resolution / path / quoting / arguments / missing input / permission / actual absence.
- Correct the failed assumption at its authoritative source and rerun. Never repeat the same invocation unchanged.
- One failed probe disproves only that probe. Confirm the exact path and invocation before concluding a tool or file does not exist.
- Keep large output in `tmp-claude/` and read only the needed range. Never hide warnings by narrowing the excerpt.

## 5. Guard and exception process

- Add a guard, default, fallback, retry or early return only when an **independently established boundary contract** requires it. A guard that hides the cause is forbidden.
- Throw at the point the contract is violated; a handler must produce an observable result. Never swallow and continue.
- Never discard diagnostics. Report a failed recovery appended to the original error.
- Paths that unwind state (transactions, locks, handles) must close on both the success and the failure path.

## 6. Edit tool process

- Create-file tools are for new files only. An existing file is **always** changed with the edit tool. "A full rewrite is easier" does not lift this.
- Read the target file before editing. Never rewrite files through shell substitution or scripts.
- Use the dedicated tools for finding files, searching content and reading. Do not substitute recursive shell traversal.
- When several reads or checks are independent, issue them in parallel in one message.
- Change dependencies only through package-manager commands. Never hand-edit `package.json` or a lockfile.

## 7. Shell and verification

The shell is **pinned to PowerShell**. Use `N:\evai\...` paths, `2>$null` for the null device, `$env:NAME` for environment variables and `@'...'@` here-strings.

| Layer | Allowed verification | Forbidden |
| --- | --- | --- |
| Web (React 19 / TS 7 / Vite 8) | `npx tsc --noEmit -p N:\evai\tsconfig.app.json`, `npx oxlint N:\evai\src`, vitest | `npm run dev`, `vite`, `npm run build` |
| Server (C++26 / xmake / MSVC) | `xmake f`, `xmake` — compiler and linker diagnostics are the evidence | running the produced binary without instruction |
| Android (React Native / Kotlin / C++) | source review | Gradle builds without instruction |
| Ollama | code review | launching the server, loading models, calling `/api/chat` |

Fix the verification boundary at gate 1. Never add checks out of doubt or for reassurance.

## 8. Multi-agent ownership

When several AIs work at once, respect layer ownership. Files outside your layer are **read-only**; report a contract mismatch instead of fixing it.

| Layer | Path |
| --- | --- |
| Web frontend and domain logic | `src/**` |
| Local server and SQLite | `server/**` |
| Spirit dataset | `data/dataset/**` |
| Android | `android/**` |
| Discipline, ledger, skills | `AGENTS.md`, `AI_TRACKING.md`, `.claude/skills/**` |

## 9. Service identity and core flow

- EverSoul AI Chat is a subculture romance local AI chat. The model IS each spirit talking to the Savior. Any change that turns her into a generic assistant, chatbot or third-person narrator is forbidden.
- Spirit data is `data/dataset/*.json`, 100 entries, where `id` is the real in-game SNO string. The source of truth is `third_party/tbl_json`.
- **The model never keeps or writes conversation context.** Every turn, logic builds the input from the complete stored timeline: recent-flow window in `chat/conversationFlow.ts`, emotion/bond/jealousy ledger in `chat/relationshipLedger.ts`, inner heart and outward expression in `chat/heart.ts`.
- There is one turn assembly path: `chat/service.ts` -> `chat/prompt.ts` + `chat/personaTurnHook.ts` -> `llm/turn.ts` -> `llm/engine.ts` -> engine runtime -> `chat/replyEnvelope.ts` -> repository.
- Turn message order is `context sections` -> `[Savior NOW]` + raw text -> `[YOUR TURN]` behavior instruction LAST.
- The host runtime is decided once at boot by `/api/runtime`. `web` uses IndexedDB, `local_server` uses the server SQLite database, and **the two stores are exclusive, not mirrors**.
- The 12 stores are declared in `src/shared/storage/schema.ts`; the same key paths drive both the IndexedDB and the SQLite implementation.
- Replacement order: build the replacement, wire it, verify it, then clean up. Never delete the existing system first.

## 10. Working rules

- When a runtime setting changes, refresh its derived display, caches, active domain state and server consumers in the same task.
- UI strings carry `ko`, `en` and `zh_cn` together; verify that already-open screens and async state switch language at runtime, not only on first render.
- When save, restore or delete changes, close the shared contract, the IndexedDB implementation, the SQLite implementation, backup and the server API together.
- When one domain state appears on several screens, derive it from one source. Never keep per-screen copies.
- Never guess OS paths or hardware values the browser does not expose.
- Refresh the Windows release with `scripts/update-release.ps1`; it owns the web build, server build, copy, database and CRT DLL steps. Default keeps the user's stored data, `-Clean` rebuilds from scratch, `-SkipWebBuild` / `-SkipServerBuild` reuse existing output.
- The Hugging Face asset dataset keeps **one current snapshot and no version history**. Upload only changed files, delete whatever the manifest no longer lists, and squash the commit history so a single state remains. Never push the whole tree to grow history.
- Never refresh `tmp/release/data` by hand. That copy is the proving ground for the server's own asset check and download; filling it locally destroys the evidence.
- A release package always ships a **clean database**. `scripts/update-release.ps1` replaces `evai-database` with the freshly built one on every run; never package a database that has been used.
- Append one line to `AI_TRACKING.md` **only when a task is complete**. That file's `0. ENTRY FORMAT` owns the format.
- The Android-native work record is `android/ANDROID_TRACKING.md`. Keep its implementation and acceptance state current when Android work changes; it does not replace this file or the completion-only root ledger.

## 11. Current state

- Version `0.0.7`. Six open issues, listed in section 7 of `AI_TRACKING.md`.
- PC web and the local server remain active. The current user request also activates the independent React Native Android project under `android/`, tracked in `android/ANDROID_TRACKING.md`.
- CodeQL default setup languages: `actions`, `c-cpp`, `javascript-typescript`.

## 12. Subordinate skills

A skill owns **detailed procedure only**. It never creates new discipline or widens scope, and this file wins on conflict.

| When | Skill |
| --- | --- |
| Source, server, data or architecture work | `.claude/skills/evai-architecture/SKILL.md` |
| Using a VS Code Copilot built-in skill | `.claude/skills/copilot-skill-harness/SKILL.md` |
| Running a shell command | `.claude/skills/node-react-typescript-shell-lock/SKILL.md` |

`.claude/skills` owns the project workflows Copilot and Claude share. Never copy, modify or absolute-path-link the built-in skills inside the VS Code extension install directory.
