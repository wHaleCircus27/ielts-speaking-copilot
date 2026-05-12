# IELTS Speaking Copilot

V0.2 desktop workspace for IELTS speaking feedback.

## Scope

This version focuses on local media import, timestamped transcription UI, click-to-seek playback, editable transcription, IELTS scorecards, local text-only review history, AI feedback editing, and copy output. Chrome extension, browser auto-fill, cloud sync, and RAG remain out of scope.

## V0.2 Additions

- Local review history stores file metadata, transcript text, IELTS scorecard, and final feedback. It does not copy or persist original audio/video files.
- Transcript segments can be edited before regenerating feedback.
- LLM feedback now requests a structured IELTS scorecard with overall, Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation bands at 0.1 precision.

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

- ASR: Mock, OpenAI, Groq, NVIDIA
- LLM: Mock, OpenAI, Groq, Gemini, NVIDIA
- Gemini audio understanding is not used as the primary V0.1 ASR path because V0.1 needs stable timestamped transcript segments.
- NVIDIA uses the OpenAI-compatible NIM/API Catalog endpoint at `https://integrate.api.nvidia.com/v1/chat/completions`.
- NVIDIA ASR uses the hosted audio-capable chat completions path and normalizes the returned transcript into one full-length `TranscriptSegment` in V0.1. This keeps the desktop workflow usable, but it is not a fine-grained timestamped ASR path.
- NVIDIA LLM defaults to `deepseek-ai/deepseek-v4-flash` for Simplified Chinese IELTS feedback. Older stored NVIDIA selections that failed quality/stability checks are migrated to that model.

API keys are no longer written to browser `localStorage`. In the Tauri desktop shell they are stored through the operating system secure credential store via the Rust `keyring` crate. Older V0.1 `api-keys.local.json` files are read for migration into secure storage.

Real provider calls still go through the frontend provider facade, but the facade now prefers the Tauri HTTP plugin in the desktop shell and falls back to browser `fetch` for web-only Mock/dev paths. Web development is intended mainly for the Mock provider flow; real API key persistence and provider calls should be verified in the Tauri desktop shell. The HTTP permission scope is limited to the configured provider domains.

## Project Context

Read `AGENTS.md` and `PRD-V0.1-IELTS-Speaking-Copilot.md` before implementation work.
