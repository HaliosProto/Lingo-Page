# ADR 0009: Clone translated-copy sessions and use single-use comparison handoff

- Status: Accepted.
- Date: 2026-07-18

## Context

Translated copies and comparison need existing page translations without another provider call, while page text must not enter URLs, webpage JavaScript, permanent history, or a broadly readable store.

## Decision

The source page shell exports a runtime-validated bundle capped at 2,500 segments and 2 MB. A translated copy opens the exact source URL and receives a new independent session identity after navigation and content matching. A comparison page receives only a random token in its fragment; the service worker temporarily places the bundle in `chrome.storage.session`, binds the token to the new extension tab, and deletes it after the first successful retrieval or tab cleanup.

## Consequences

Matched copy content and comparison creation make no provider call. Ending one page session cannot clear another. A service-worker failure during the short copy handoff or a reloaded comparison before retrieval fails honestly; durable restart recovery is deferred. Comparison renders text only and never imports source HTML, scripts, inputs, or event handlers.
