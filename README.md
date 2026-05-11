# IELTS Speaking Copilot

V0.1 desktop MVP for IELTS speaking feedback.

## Scope

This version focuses on local media import, timestamped transcription UI, click-to-seek playback, AI feedback editing, and copy output. Chrome extension, browser auto-fill, and RAG are intentionally out of scope for V0.1.

## Setup

In this workspace, Node is installed under `E:\node`. In PowerShell, prefer `npm.cmd` because `npm.ps1` may be blocked by the execution policy.

```powershell
$env:PATH='E:\node;' + $env:PATH
npm.cmd install
npm.cmd run dev
```

For the Tauri shell:

```powershell
$env:PATH='E:\node;' + $env:PATH
$env:RUSTUP_SELF_UPDATE='disable'
npm.cmd run tauri:dev
```

## Provider Support

- ASR: Mock, OpenAI, Groq
- LLM: Mock, OpenAI, Groq, Gemini, NVIDIA
- Gemini audio understanding is not used as the primary V0.1 ASR path because V0.1 needs stable timestamped transcript segments.
- NVIDIA uses the OpenAI-compatible NIM/API Catalog endpoint at `https://integrate.api.nvidia.com/v1/chat/completions`.

API keys are no longer written to browser `localStorage`. In the Tauri desktop shell they are stored through the operating system secure credential store via the Rust `keyring` crate. Older V0.1 `api-keys.local.json` files are read for migration into secure storage.

Real provider calls still go through the frontend provider facade, but the facade now prefers the Tauri HTTP plugin in the desktop shell and falls back to browser `fetch` for web-only Mock/dev paths. The HTTP permission scope is limited to the configured provider domains.

## Project Context

Read `AGENTS.md` and `PRD-V0.1-IELTS-Speaking-Copilot.md` before implementation work.
