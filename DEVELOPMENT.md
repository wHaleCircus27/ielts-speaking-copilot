# Development Notes

## Current Implementation State

The V0.1 project folder contains:

- PRD and agent context documents.
- Next.js + React + Tailwind source files.
- A Tauri v2 shell with a minimal Rust command.
- A first-pass workspace UI for local media import, playback, timestamped transcript interaction, generated feedback editing, and copy output.
- A provider facade for Mock/OpenAI/Groq ASR and Mock/OpenAI/Groq/Gemini/NVIDIA LLM.

Mock flows still use local deterministic demo data in `src/lib/mock-ai.ts`. Real provider calls go through `src/lib/providers.ts`, so UI code should not call OpenAI, Groq, or Gemini directly.

## Environment

- Node is available from `E:\node`; use `npm.cmd` in PowerShell to avoid the `npm.ps1` execution-policy block.
- Rust/Cargo stable was upgraded to 1.95.0.
- If the rustup proxy attempts self-update cleanup, set `RUSTUP_SELF_UPDATE=disable` for the shell session before running Cargo commands.

PowerShell example:

```powershell
$env:PATH='E:\node;' + $env:PATH
$env:RUSTUP_SELF_UPDATE='disable'
npm.cmd install
npm.cmd run build
cargo check
```

## Validation Completed

- `npm.cmd install` completed successfully.
- `npm.cmd run test` completed successfully with Vitest.
- `npm.cmd run typecheck` completed successfully.
- `npm.cmd run build` completed successfully with Next.js 15.5.18.
- `cargo check` completed successfully for the Tauri v2 shell after adding `src-tauri/icons/icon.ico`.

## Provider Matrix

| Capability | Mock | OpenAI | Groq | Gemini | NVIDIA |
| --- | --- | --- | --- | --- | --- |
| ASR transcription | Yes | Yes | Yes | Not enabled in V0.1 | Not enabled in V0.1 |
| Timestamped segments | Demo data | Via transcription response | Via transcription response | Not enabled in V0.1 | Not enabled in V0.1 |
| LLM feedback | Demo data | Chat Completions streaming | Chat Completions streaming | `streamGenerateContent` SSE | OpenAI-compatible streaming |
| API key required | No | Yes | Yes | Yes | Yes |

NVIDIA is also supported for LLM feedback through the OpenAI-compatible endpoint `https://integrate.api.nvidia.com/v1/chat/completions`; the default model is `meta/llama-3.3-70b-instruct`.

An NVIDIA smoke test with the provided API key returned the expected `provider-ok` response. Do not commit API keys or paste them into logs.

API keys are no longer saved in browser localStorage. In the Tauri desktop shell they are persisted through the operating system secure credential store via the Rust `keyring` crate. Older V0.1 `api-keys.local.json` files are read for migration into secure storage.

Provider requests still use the frontend facade, but real HTTP calls now prefer `@tauri-apps/plugin-http` in the desktop shell. Web-only development can still use Mock provider without API keys or network. The Tauri HTTP permission scope is limited to OpenAI, Groq, Gemini, and NVIDIA endpoints.

## Next Engineering Steps

1. Run `npm.cmd run dev` to manually verify the web UI with Mock provider.
2. Run `npm.cmd run tauri:dev` to manually verify the desktop shell.
3. Test real OpenAI/Groq ASR and OpenAI/Groq/Gemini/NVIDIA LLM with valid API keys.
4. Expand manual desktop verification with real OpenAI/Groq ASR and OpenAI/Groq/Gemini/NVIDIA LLM provider runs.
5. Add packaging notes for macOS keychain prompts and first-run permission behavior.
