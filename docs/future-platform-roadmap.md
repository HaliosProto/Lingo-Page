# Future platform roadmap

This document records boundaries, not implementation commitments for the Chrome MVP.

## Firefox and Safari

Reuse shared types, validation, translation-core, provider interfaces, and UI tokens. Add browser adapters, manifest variants, permission review, and browser-specific E2E suites.

## Desktop

Package shared core with a desktop shell. Add screen capture, OCR, system-wide overlays, accessibility APIs, offline model management, and platform permission UX. Never reuse browser page permissions as a substitute for OS consent.

## Mobile

Use share sheets, Android accessibility integration, iOS extension limitations, keyboard/input-method APIs, and offline translation where viable. Composer translation must be opt-in, previewable, undoable, and never auto-send.

## Documents and images

Add format-aware pipelines: DOCX runs/styles/tables/relationships; PPTX shapes/themes/notes/position; XLSX formulas/styles/merged cells/charts; EPUB chapters/navigation; PDF text-layer/OCR/layout reconstruction; image OCR/region overlays; subtitles with timestamps and reading-speed constraints. Never extract all text and blindly reinsert it.

## Accounts, glossaries, memory, and enterprise

Add short-lived sessions, revocation, quotas, deletion, team glossaries, versioned translation memory, regional processing, retention controls, SSO/SCIM, audit logs, customer-managed keys, and enterprise isolation only after the core translation system is stable.

## Composer translation

Explicit activation only: write → activate → translate → preview → edit → user sends. No covert global keylogging, password-field reads, continuous capture, or automatic sending.
