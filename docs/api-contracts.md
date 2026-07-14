# API contracts

Status: contract design; implementation begins in Milestone 1/3.

## Envelope conventions

All JSON responses include `requestId` when a request exists. Errors use:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The translation request is invalid.",
    "retryable": false,
    "requestId": "req_..."
  }
}
```

Messages are validated with shared runtime schemas. Unknown fields are rejected or stripped by policy; the API never accepts arbitrary provider URLs, models, prompts, or parameters from the client.

## Domain types

```ts
type TranslationMode = "page" | "selection" | "composer";

type TranslationSegment = {
  id: string;                 // opaque, bounded, unique per request
  text: string;               // plain text, bounded
  context?: string;           // bounded, privacy-minimized
  elementRole?: string;       // allowlisted semantic role
  preserveTokens?: string[];  // bounded opaque placeholders
};

type TranslationRequest = {
  requestId: string;
  sourceLanguage?: string;
  targetLanguage: string;
  mode: TranslationMode;
  segments: TranslationSegment[];
  glossaryVersion?: string;
  tone?: "neutral" | "formal" | "informal";
  formality?: "default" | "more" | "less";
};

type TranslationResponse = {
  requestId: string;
  detectedSourceLanguage?: string;
  translations: Array<{ id: string; translatedText: string }>;
  usage?: { inputCharacters?: number; outputCharacters?: number };
  partial?: boolean;
};
```

## Routes

### `POST /v1/translate`

Requires authenticated application session in production, development token only in local mode. Accepts `TranslationRequest`; returns `TranslationResponse` or normalized error. Initial defaults: at most 500 segments, 2,000 characters per segment, 20,000 input characters, 60,000 output characters, and a bounded JSON body. Values are configuration, not client-controlled.

### `POST /v1/detect-language`

Accepts a bounded list of text samples or a bounded combined sample; returns a validated language code, confidence category, and request ID. Do not send an entire page only for detection.

### `GET /v1/languages`

Returns the product allowlist of source/target language codes and capabilities. The extension must not infer provider capabilities from arbitrary user input.

### `GET /v1/usage`

Returns aggregate usage/quota state for the authenticated user. It must not return raw page text or request contents.

### `GET /v1/health`

Unauthenticated liveness/readiness response with version and provider availability category only; no secrets or detailed upstream errors.

## Extension message contracts

Message types include `GET_TAB_STATE`, `START_TRANSLATION`, `CANCEL_TRANSLATION`, `RESTORE_ORIGINAL`, `CONTENT_READY`, `DISCOVER_SEGMENTS`, `APPLY_TRANSLATIONS`, `PROGRESS`, `TRANSLATION_COMPLETE`, and `TRANSLATION_ERROR`. Each message carries a version, request/session ID where relevant, tab/frame identity, and a discriminated payload. Sender checks are as important as schema checks.

## Error categories

`UNSUPPORTED_PAGE`, `AUTH_REQUIRED`, `INVALID_REQUEST`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_TIMEOUT`, `INVALID_PROVIDER_RESPONSE`, `CANCELLED`, `STALE_SESSION`, `PARTIAL_FAILURE`, and `INTERNAL_ERROR`.
