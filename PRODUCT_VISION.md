# Lingo product vision

## Purpose

Lingo helps people understand, communicate, and localize across languages while retaining control over meaning, tone, terminology, privacy, and quality. Lingo Page is the first client: a privacy-first browser product that translates eligible page text in place without rebuilding the host page.

## Product principles

- Preserve user agency: activation, recipient, persistence, and sending are explicit.
- Preserve structure: translation must not damage documents, pages, controls, or source meaning.
- Explain state: progress, partial success, failure, retry, and recovery are visible.
- Treat multilingual correctness as a system property, including BiDi, terminology, context, and accessibility.
- Keep credentials, routing policy, and cost controls behind an application boundary.
- Reuse domain contracts across clients without forcing browser assumptions onto other platforms.
- Prefer measured quality and honest limitations over unsupported accuracy claims.

## Product family

| Product            | Intended outcome                                                             | Earliest dependency                                   |
| ------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| Lingo Page         | Multilingual reading, page comparison, and webpage understanding             | Durable browser sessions                              |
| Lingo Compose      | Previewable translation of completed drafts before the user sends them       | Safe editable-content and consent model               |
| Lingo Vision       | OCR, image, screenshot, region, and camera translation                       | Capture permissions and OCR evaluation                |
| Lingo Meet         | Transcription, captions, translation, summaries, and action items            | Speech pipeline and meeting consent model             |
| Lingo Studio       | CAT/TMS workflows for translators, agencies, and localization teams          | Accounts, durable projects, and file-format pipelines |
| Lingo Intelligence | Context, tone, terminology, routing, evaluation, steering, and explanation   | Research and evaluation platform                      |
| Lingo Analytics    | Useful personal, quality, cost, and operational insight                      | Privacy-preserving event model                        |
| Lingo Platform     | Shared identity, storage, APIs, SDKs, billing, organizations, and operations | Production identity and data lifecycle                |

## Near-term product thesis

The strongest early release is a calm, trustworthy browser translator that behaves well on real long pages: it preserves originals, resumes safely, makes partial outcomes understandable, handles LTR/RTL content deliberately, and avoids unnecessary provider calls. Platform expansion follows only after this browser foundation is durable and measured.

## Non-goals for the current program gate

Milestone 0 does not add accounts, billing, analytics collection, deployment, publication, new platform implementations, automatic provider routing, remote memory, or full translation-session persistence. Those areas remain planned and require their own approved specifications.
