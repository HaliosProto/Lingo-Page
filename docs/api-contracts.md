# API contracts

Status: version 1 implemented and runtime-validated.

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
type TranslationMode = 'page' | 'selection';

type TranslationSegment = {
  id: string; // opaque, bounded, unique per request
  text: string; // plain text, bounded
  context?: string; // bounded, privacy-minimized
  elementRole?: string; // allowlisted semantic role
  preserveTokens?: string[]; // bounded opaque placeholders
};

type TranslationRequest = {
  requestId: string;
  sessionId: string;
  sourceLanguage?: string;
  targetLanguage: string;
  mode: TranslationMode;
  segments: TranslationSegment[];
  glossaryVersion?: string;
  tone?: 'neutral' | 'formal' | 'informal';
  formality?: 'default' | 'more' | 'less';
};

type TranslationResponse = {
  requestId: string;
  sessionId: string;
  detectedSourceLanguage?: string;
  translations: Array<{ id: string; translatedText: string }>;
  usage?: { inputCharacters?: number; outputCharacters?: number };
  partial?: boolean;
};
```

## Routes

### `POST /v1/translate`

Mock mode is unauthenticated only in local development/test. Non-mock and production use requires backend authentication. The route accepts `TranslationRequest`; returns `TranslationResponse` or a normalized error. Defaults: at most 500 segments, 2,000 characters per segment, 20,000 input characters, 60,000 output characters, and a 256 KB JSON body.

### `POST /v1/detect-language`

Accepts one bounded text sample; returns a validated language code, confidence category, and request ID. The local implementation is a deterministic script heuristic.

### `GET /v1/languages`

Returns the product allowlist of source/target language codes and capabilities. The extension must not infer provider capabilities from arbitrary user input.

### `GET /v1/usage`

Returns aggregate usage/quota state for the authenticated user. It must not return raw page text or request contents.

### `GET /v1/health`

Unauthenticated liveness/readiness response with version and provider availability category only; no secrets or detailed upstream errors.

## Extension message contracts

Implemented message types include settings/health/status operations plus `START_PAGE_TRANSLATION`, `TRANSLATE_SEGMENTS`, `GET_TRANSLATION_PROGRESS`, `CANCEL_PAGE_TRANSLATION`, `RESTORE_PAGE`, `TRANSLATE_SELECTION`, and `SHOW_SELECTION_RESULT`. Every message carries contract version and request ID; translation work is bound to a session ID and tab.

## Error categories

`UNSUPPORTED_PAGE`, `AUTH_REQUIRED`, `INVALID_REQUEST`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_TIMEOUT`, `INVALID_PROVIDER_RESPONSE`, `CANCELLED`, `STALE_SESSION`, `PARTIAL_FAILURE`, and `INTERNAL_ERROR`.
