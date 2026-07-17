# Privacy engineering

The canonical data-flow and user-control model is `docs/privacy-model.md`; retention decisions are in `docs/data-retention.md`.

Current defaults are explicit activation, no browsing-history collection, no persistent raw page text, optional bounded translated-text cache off by default, privacy-mode cache disable, sensitive-page blocking, metadata-only diagnostics, and backend-only provider credentials. Remote providers receive eligible text only for an active request to the selected configured recipient.

Any new persistence, synchronization, analytics, identity, audio/image capture, editable-content access, provider recipient, or external integration requires an approved purpose, minimization, consent, retention/deletion, access model, threat review, failure behavior, tests, and accurate user disclosure before implementation.
