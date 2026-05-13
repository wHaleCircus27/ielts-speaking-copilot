# Development Notes

## Current Implementation State

The V0.2 project folder contains:

- PRD and agent context documents.
- Next.js + React + Tailwind source files.
- A Tauri v2 shell with a minimal Rust command.
- A desktop workspace UI for local media import, playback, timestamped transcript interaction, editable transcript segments, IELTS scorecard display, generated feedback editing, local text-only history, and copy output.
- A provider facade for Mock/OpenAI/Groq/NVIDIA ASR and Mock/OpenAI/Groq/Gemini/NVIDIA/DeepSeek LLM.

Mock flows still use local deterministic demo data in `src/lib/mock-ai.ts`. Real provider calls go through `src/lib/providers.ts`, so UI code should not call OpenAI, Groq, Gemini, NVIDIA, or DeepSeek directly.

## V0.2 Development Sync

Completed:

- Replaced the planned browser-extension V0.2 direction with local desktop workflow enhancements.
- Added local text-only review history through Tauri commands: `list_reviews`, `load_review`, `save_review`, and `delete_review`.
- Review history stores metadata, transcript text, scorecard, final feedback, and provider/model snapshots. It does not store API keys or copy original media files.
- Added editable transcript segments. Edited segments are marked and used for regenerated feedback.
- Added structured IELTS scorecard parsing and display with 0.1 band precision from 0 to 9.
- Updated feedback prompting to request a JSON payload containing `scorecard` and `feedbackMarkdown`.
- Added history search by file name, date/status metadata, transcript preview, and feedback preview.
- Added a V0.2 development plan in `V0.2-DEVELOPMENT-PLAN.md`.
- Added DeepSeek as an LLM-only provider. DeepSeek is intentionally not added to ASR because the V0.2 app requires audio transcription and the DeepSeek integration path is OpenAI-compatible chat completions.

Validation:

- `npm.cmd run test` passed with 9 test files and 44 tests after adding DeepSeek and NVIDIA ASR response-shape coverage.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build` passed with Next.js static export.
- `cargo check` passed for the Tauri shell.
- DeepSeek live smoke with the local key returned HTTP 200 for `deepseek-v4-flash`; streaming feedback returned parseable `scorecard` and `feedbackMarkdown`. The key value was not printed or written to docs/logs.
- Tauri desktop verification started successfully through `npm.cmd run tauri:dev`; the desktop shell loaded the app from `http://127.0.0.1:3000` with HTTP 200.
- User desktop walkthrough passed for the Mock-ASR-to-feedback path after switching away from NVIDIA ASR: feedback generation, editing/copy continuation, history save, history search, and history delete all worked.
- DeepSeek feedback parse failure after NVIDIA ASR was reproduced as output truncation: `max_tokens: 900` returned `finish_reason: length` and an unclosed JSON object for the local NVIDIA transcript. DeepSeek feedback now uses the documented DeepSeek V4 maximum output budget, `max_tokens: 384000`; a minimal live request with that budget returned HTTP 200 and valid JSON.
- NVIDIA LLM feedback now uses `max_tokens: 16384`, matching the documented `deepseek-ai/deepseek-v4-flash` NVIDIA endpoint range/default.

Remaining manual checks:

- Confirm history reopen specifically after the latest DeepSeek changes if it was not part of the walkthrough.
- Real provider feedback quality check for strict JSON scorecard output beyond the DeepSeek smoke path.
- Re-run V0.1 real provider/keyring checks before release.

Known provider notes:

- NVIDIA ASR investigation found that the OpenAI-compatible endpoint can return the transcript in `message.reasoning_content` with `message.content: null`; the adapter now sends `/no_think`, sets `reasoning_budget: -1`, falls back to `reasoning_content`/`reasoning`, and strips common NVIDIA ASR reasoning preambles.

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

| Capability | Mock | OpenAI | Groq | Gemini | NVIDIA | DeepSeek |
| --- | --- | --- | --- | --- | --- | --- |
| ASR transcription | Yes | Yes | Yes | Not enabled in V0.1 | Yes | No |
| Timestamped segments | Demo data | Via transcription response | Via transcription response | Not enabled in V0.1 | Single full-length segment fallback | No ASR path |
| LLM feedback | Demo data | Chat Completions streaming | Chat Completions streaming | `streamGenerateContent` SSE | OpenAI-compatible streaming | OpenAI-compatible streaming |
| API key required | No | Yes | Yes | Yes | Yes | Yes |

NVIDIA is also supported for LLM feedback through the OpenAI-compatible endpoint `https://integrate.api.nvidia.com/v1/chat/completions`; the default/recommended model is `deepseek-ai/deepseek-v4-flash`.

DeepSeek is supported for LLM feedback through the OpenAI-compatible endpoint `https://api.deepseek.com/chat/completions`; the default model is `deepseek-v4-flash`, with `deepseek-v4-pro` available as an optional model. DeepSeek requests use JSON object mode for the IELTS scorecard payload and the documented DeepSeek V4 maximum output budget.

An NVIDIA smoke test with the provided API key returned the expected `provider-ok` response. Do not commit API keys or paste them into logs.

API keys are no longer saved in browser localStorage. In the Tauri desktop shell they are persisted through the operating system secure credential store via the Rust `keyring` crate. Older V0.1 `api-keys.local.json` files are read for migration into secure storage.

Provider requests still use the frontend facade, but real HTTP calls now prefer `@tauri-apps/plugin-http` in the desktop shell. Web-only development can still use Mock provider without API keys or network. The Tauri HTTP permission scope is limited to OpenAI, Groq, Gemini, NVIDIA, and DeepSeek endpoints.

ASR and LLM model selection are provider-specific and rendered as dropdowns. ASR supports Mock, OpenAI, Groq, and NVIDIA options. NVIDIA ASR uses the hosted OpenAI-compatible chat completions endpoint with `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` and audio input. Because that hosted path returns plain transcript text rather than native timestamped ASR segments, V0.1 converts it into one full-length `TranscriptSegment` so the media, transcript, and feedback workflow remains usable. LLM supports Mock, OpenAI, Groq, Gemini, NVIDIA, and DeepSeek options. NVIDIA LLM options are curated from the NVIDIA API Catalog `/v1/models`; `deepseek-ai/deepseek-v4-flash` is listed first because it passed the Simplified Chinese feedback smoke test. Older stored NVIDIA choices known to produce bad Chinese output or unstable latency (`meta/llama-3.3-70b-instruct` and `deepseek-ai/deepseek-v4-pro`) are migrated back to the recommended Flash model.

Configuration readiness is split by capability. Transcription checks ASR provider/model/API key before starting, and feedback generation checks LLM provider/model/API key before streaming. OpenAI, Groq, and NVIDIA API keys are shared by ASR and LLM requests for the same provider; DeepSeek keys are used only for LLM feedback.

Desktop API keys are stored through the OS secure credential store. On macOS, first use may show a Keychain access prompt for `com.ieltsspeaking.copilot.api-key`. On Windows, the `keyring` crate uses the Windows-native credential backend. Web-only development does not have Tauri command access, so real provider key persistence is only intended for the desktop shell; Mock mode remains usable without keys or network.

## 2026-05-12 Development Sync

Completed:

- Added provider-specific LLM model dropdowns for Mock, OpenAI, Groq, Gemini, and NVIDIA.
- Added provider-specific ASR model dropdowns for Mock, OpenAI, Groq, and NVIDIA.
- Added NVIDIA ASR through `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` audio input, with a single full-length segment fallback for V0.1.
- Added separate ASR and LLM readiness checks before transcription and feedback generation.
- Added settings UI badges showing ASR-ready and LLM-ready states separately.
- Added visible API Key inputs for all currently selected non-Mock ASR/LLM providers, with shared-key copy for providers used by both capabilities.
- Added strict model normalization so older custom model strings are not kept as active dropdown values.
- Updated the NVIDIA LLM default/recommended model to `deepseek-ai/deepseek-v4-flash`; stored NVIDIA `meta/llama-3.3-70b-instruct` and `deepseek-ai/deepseek-v4-pro` selections now migrate to Flash.
- Added NVIDIA feedback generation settings. The current output budget is `max_tokens: 16384` with `temperature: 0.3`, matching the documented `deepseek-ai/deepseek-v4-flash` endpoint range/default.
- Updated NVIDIA connection testing to call the same OpenAI-compatible chat completions endpoint used by feedback generation, with the currently selected model.
- Verified the provided NVIDIA API key against `https://integrate.api.nvidia.com/v1/chat/completions` without logging or committing the key.
- Verified all curated NVIDIA dropdown models with a minimal non-streaming chat completion request.
- Verified NVIDIA streaming chat completion with `meta/llama-3.3-70b-instruct`, then replaced it as the default after Chinese feedback quality failed.

Passed:

- `npm.cmd run test`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `cargo check`
- NVIDIA live smoke test for `/v1/chat/completions` with the provided key and curated dropdown models.

Not yet completed:

- Full Tauri desktop manual walkthrough after the latest connection-test change.
- Real ASR provider validation with OpenAI/Groq keys.
- NVIDIA ASR validation with a non-empty spoken audio sample.
- Real OpenAI/Groq/Gemini LLM validation beyond unit-level endpoint selection.
- Manual verification of OS keyring prompts and clipboard behavior in the desktop shell after the ASR settings change.

## V0.1 Verification Handoff

Manual verification is tracked in `MANUAL-VERIFICATION-V0.1.md`.

2026-05-12 verification pass:

- `npm.cmd run test` passed with 7 test files and 29 tests after adding NVIDIA default/migration/request-body coverage.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build` passed with Next.js static export.
- `cargo check` passed for the Tauri shell.
- Local test resources were inspected without printing secrets: `speakTest-nvidia-asr.wav` is under the 25 MB default limit, `speakTest.mp4` is over the 25 MB default limit and suitable for limit-state checks, and the saved DeepSeek V4 Flash feedback contains all six required Markdown headings.
- `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` started successfully and returned HTTP 200.
- `npm.cmd run tauri:dev` compiled and launched `target\debug\ielts-speaking-copilot.exe`; the shell loaded `/` with HTTP 200.
- The user completed the Mock UI click walkthrough and confirmed the tested UI items passed.
- NVIDIA ASR was tested with the speaking sample from `D:\CodexProject\testResource`. Direct MP4 upload failed because the request exceeded the NVIDIA payload limit, but an extracted WAV audio asset succeeded and returned a non-empty transcript.
- NVIDIA LLM OpenAI-compatible streaming was tested with the NVIDIA API key. The stream returned chunks and `[DONE]`, but `meta/llama-3.3-70b-instruct` produced garbled Chinese feedback and failed the required heading/content quality check for this scenario.
- NVIDIA LLM `deepseek-ai/deepseek-v4-flash` passed a controlled streaming smoke test with shortened transcript input and 450 max output tokens, returning valid Simplified Chinese Markdown with all required headings.
- NVIDIA LLM `deepseek-ai/deepseek-v4-pro` is not suitable in this pass: one full streaming attempt returned garbled question-mark output, and one controlled short streaming attempt exceeded the 120 second request budget.

Remaining release-blocking checks:

1. Test real OpenAI/Groq ASR and OpenAI/Groq/Gemini LLM with valid API keys.
2. Verify non-Mock API key persistence through OS secure credential storage in the desktop shell.
3. Re-run the Tauri desktop walkthrough with a short non-sensitive spoken audio sample and a locally provided NVIDIA key without printing or committing the key.
4. Add packaging notes for macOS first-run credential prompts once the desktop credential walkthrough is complete.
