# V0.1 Manual Verification

Date: 2026-05-12

## Scope

This record tracks the V0.1 desktop MVP acceptance pass. It intentionally covers the local desktop workflow only: local media import, playback, ASR, timestamped transcript interaction, LLM feedback generation, editing, copying, settings, and failure states.

Out of scope remains unchanged: Chrome extension, browser media sniffing, browser auto-fill, RAG, batch import, multi-user accounts, cloud sync, signing, notarization, and auto-update.

## Automated Checks

Result for this pass: passed.

- `npm.cmd run test`: passed, 7 test files and 29 tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed, Next.js static export completed.
- `cargo check`: passed for the Tauri shell.
- Local resource sanity check: `speakTest-nvidia-asr.wav` is 5,539,932 bytes and under the 25 MB default limit; `speakTest.mp4` is 28,140,993 bytes and over the 25 MB default limit; saved DeepSeek V4 Flash feedback contains all six required Markdown headings.

## Web Mock Walkthrough

Use `npm.cmd run dev` for this pass. Web development mode is expected to validate the UI and Mock provider flow, not secure API key storage.

Result for this pass: passed by manual UI walkthrough.

- `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` started successfully.
- `http://127.0.0.1:3000` returned HTTP 200.
- The user completed the interactive UI walkthrough against the running app.

- Passed: app loaded at the local Next.js URL.
- Passed: workspace opens with the three-zone layout: media console, transcript list, feedback editor.
- Passed: ASR and LLM providers can remain set to Mock for the local UI flow.
- Passed: short local audio/video import works.
- Passed: native media player loads and can play, pause, and seek.
- Passed: Mock transcription starts and deterministic timestamped segments render.
- Passed: clicking a transcript segment seeks the player to the segment start and plays.
- Passed: feedback generation streams content into the right-side editor.
- Passed: edited feedback can be copied, and copy uses the edited final text.
- Passed: expected user-facing error states were checked during the walkthrough.

## Desktop Shell Walkthrough

Use `npm.cmd run tauri:dev` for this pass. Desktop mode is required for OS secure credential storage and Tauri HTTP provider requests.

Result for this pass: passed by manual UI walkthrough for the Mock desktop workflow.

- `npm.cmd run tauri:dev` started the Tauri dev flow successfully.
- Next.js dev server became ready on `http://127.0.0.1:3000`.
- Cargo finished the dev build and launched `target\debug\ielts-speaking-copilot.exe`.
- The desktop shell requested `GET /` and received HTTP 200.
- Passed: the Tauri window opened at the same three-zone workspace.
- Passed: local audio/video import and playback worked in the desktop shell.
- Passed: copy-to-clipboard copied the current edited feedback exactly.
- Not executed in this pass: non-Mock API key persistence through OS secure credential storage.
- Not executed in this pass: real provider requests through the Tauri HTTP path.

## Real Provider Verification

Real provider checks require valid API keys and a short non-sensitive spoken audio sample. Do not commit keys, paste them into logs, or store them in documentation.

Result for this pass: partially executed with the NVIDIA API key and speaking sample from `D:\CodexProject\testResource`.

- OpenAI ASR: verify a short audio file returns non-empty timestamped segments.
- Groq ASR: verify a short audio file returns non-empty timestamped segments.
- NVIDIA ASR: passed. The original `speakTest.mp4` was 28,140,993 bytes and exceeded the NVIDIA chat completions payload limit, so the audio track was extracted to `speakTest-nvidia-asr.wav` at 5,539,932 bytes. NVIDIA ASR returned 1,985 transcript characters, about 384 words, suitable for the V0.1 single full-length segment fallback.
- OpenAI LLM: verify streaming feedback from a transcript.
- Groq LLM: verify streaming feedback from a transcript.
- Gemini LLM: verify SSE feedback generation from a transcript.
- NVIDIA LLM legacy default: failed quality. OpenAI-compatible streaming with `meta/llama-3.3-70b-instruct` returned HTTP 200, 1,009 SSE chunks, and a `[DONE]` event from the NVIDIA endpoint. However, the generated Chinese feedback content was garbled as question marks and did not pass the required Markdown heading check.
- NVIDIA LLM DeepSeek V4 Flash: passed for a controlled streaming smoke test. `deepseek-ai/deepseek-v4-flash` returned HTTP 200, 45 SSE chunks, a `[DONE]` event, 978 feedback characters, valid Simplified Chinese content, and all required Markdown headings when tested with a shortened transcript and 450 max output tokens.
- NVIDIA LLM DeepSeek V4 Pro: not suitable in this pass. A full streaming attempt returned garbled question-mark output, and a controlled short streaming attempt did not complete before a 120 second abort.
- NVIDIA LLM app default strategy: updated after this pass. The app now recommends and defaults to `deepseek-ai/deepseek-v4-flash`, migrates stored NVIDIA `meta/llama-3.3-70b-instruct` and `deepseek-ai/deepseek-v4-pro` selections to Flash, and sends NVIDIA feedback requests with `max_tokens: 900` and `temperature: 0.3`.
- Current live NVIDIA connection retry: not passed in this run. A minimal `deepseek-ai/deepseek-v4-flash` chat completion request using the local key timed out after 64 seconds, so this pass relies on the saved NVIDIA ASR/Flash outputs plus automated request-shape tests; re-run provider smoke before release if network latency changes.

## Failure Scenarios

- Missing ASR API key blocks transcription with a readable message.
- Missing LLM API key blocks feedback generation with a readable message.
- Unsupported media does not crash the app and asks for an audio/video file.
- Oversize or over-duration media shows the configured V0.1 limit and allows choosing another file.
- ASR request failure preserves the loaded media and allows retry.
- Empty ASR response shows a readable error and does not render a bogus transcript.
- LLM request failure preserves transcript and any edited feedback content.
- Copy failure shows a readable clipboard permission/error message.

## Current Status

- Automated checks: passed in this pass.
- Web Mock walkthrough: passed by manual UI walkthrough.
- Desktop shell walkthrough: passed for the Mock workflow by manual UI walkthrough.
- Real provider verification: NVIDIA ASR passed in the saved provider run; NVIDIA LLM DeepSeek V4 Flash passed a controlled saved streaming smoke test and is now the app default/recommended NVIDIA model, but a current minimal live retry timed out after 64 seconds; legacy NVIDIA `meta/llama-3.3-70b-instruct` and DeepSeek V4 Pro are not acceptable for Chinese feedback quality/stability in this pass; OpenAI/Groq/Gemini remain untested without valid API keys.

Available local verification resources:

- `D:\CodexProject\testResource\speakTest-nvidia-asr.wav`: preferred NVIDIA ASR desktop walkthrough sample.
- `D:\CodexProject\testResource\speakTest.mp4`: over the default 25 MB app limit and NVIDIA direct payload limit; use only for limit-state checks unless the app limit is raised.
- `D:\CodexProject\testResource\nvidia-asr-transcript.local.txt`: saved NVIDIA ASR transcript output.
- `D:\CodexProject\testResource\nvidia-deepseek-v4-flash-short-feedback.local.md`: saved passing NVIDIA Flash feedback output.
- A locally provided NVIDIA key can be used for manual desktop verification; do not print, commit, or copy it into logs/docs.

Known V0.1 limitation: NVIDIA ASR is a usable transcript fallback, not fine-grained timestamped ASR. It returns one full-length segment by design until a provider path with stable segment timestamps is selected.

Known provider risk: `speakTest.mp4` is above the default 25 MB app limit and above the NVIDIA chat completions payload limit when sent directly. UI testing with this file requires raising the app file-size limit, while provider-level NVIDIA ASR requires a smaller extracted audio asset or an Assets API integration.
