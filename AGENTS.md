# AGENTS.md

## Project

- Name: IELTS Speaking Copilot
- Stage: V0.1 MVP
- Primary goal: build a local desktop workflow for IELTS speaking teachers to review local audio/video homework, get timestamped transcription, generate AI feedback, edit it, and copy the final result.

## Required Reading

Before making changes, read this file and `PRD-V0.1-IELTS-Speaking-Copilot.md` in the same directory.

## Default Stack

- Desktop shell: Tauri
- Frontend: Next.js, React, Tailwind
- Target platform: macOS first
- Local storage: choose a simple local-first approach suitable for Tauri; do not introduce cloud sync in V0.1
- AI providers: keep ASR and LLM provider access behind small adapter interfaces

## V0.1 Scope

Implement only the desktop MVP:

- Local drag-and-drop import for audio/video files.
- HTML5 audio/video playback.
- ASR transcription with timestamped segments.
- Interactive transcript list with click-to-seek playback.
- LLM-generated IELTS speaking feedback.
- Streaming feedback display where supported.
- Editable final feedback area.
- Copy final feedback to clipboard.
- Settings for API Key, ASR provider/model, and LLM provider/model.
- Clear loading, failure, retry, and missing-configuration states.

## Out Of Scope For V0.1

Do not implement these unless a newer PRD explicitly changes the scope:

- Chrome extension.
- Browser media sniffing.
- Browser auto-fill or one-click return to webpage.
- RAG habit database.
- Batch import of historical feedback.
- Embedding generation or vector search.
- Reverse learning from current feedback.
- Multi-user accounts.
- Cloud sync.
- Production signing, notarization, or auto-update.

## Core User Flow

1. User opens the desktop app.
2. User configures API Key and model settings.
3. User drags a local audio/video file into the workspace.
4. App loads the media and shows a player.
5. User starts ASR transcription.
6. App displays timestamped transcript segments.
7. User clicks transcript segments to seek and play the media.
8. User generates IELTS feedback from the transcript.
9. App streams feedback into the right-side editor.
10. User edits the final feedback.
11. User copies the final feedback to clipboard.

## UI Contract

Use a three-zone workspace:

- Top-left: media import and player.
- Bottom-left: timestamped transcript.
- Right side: AI feedback generation, editable feedback, and copy action.

Prefer a quiet, utilitarian interface suitable for repeated teacher workflows. Do not build a marketing landing page for V0.1.

## Data And Security

- API Keys must be stored locally.
- Prefer OS secure storage when practical.
- User audio/text should only leave the machine when calling the user-configured AI provider.
- Do not add telemetry or upload browsing/history data.
- If a temporary less-secure storage approach is used during early development, mark it clearly in code and docs.

## Acceptance Criteria

A V0.1 implementation is acceptable only when:

- Local audio/video files can be imported by drag-and-drop.
- The media player can play, pause, and seek.
- ASR returns timestamped transcript segments.
- Clicking a transcript segment seeks the player to that segment start time and plays.
- AI feedback can be generated from the transcript.
- Feedback can be edited after generation.
- Copy action copies the current edited text exactly.
- Missing API Key/model settings show clear user-facing errors.
- ASR and LLM failures do not crash the app and allow retry.

## Engineering Constraints

- Keep changes focused on V0.1.
- Avoid implementing V0.2/V0.3 features prematurely.
- Prefer small, testable increments.
- Keep provider-specific code isolated from UI components.
- Preserve user changes in the working tree; never revert unrelated edits.
- Use existing project conventions once a codebase exists.
- Add tests in proportion to risk, especially around provider adapters, transcript segment conversion, and click-to-seek behavior.

## Suggested Implementation Order

1. Scaffold Tauri + Next.js + Tailwind.
2. Build static three-zone workspace UI.
3. Add drag-and-drop media import and player refs.
4. Add settings storage and missing-config states.
5. Add ASR adapter and transcript segment rendering.
6. Add click-to-seek playback behavior.
7. Add LLM adapter and streaming feedback display.
8. Add editable final feedback and clipboard copy.
9. Add focused tests and manual verification notes.