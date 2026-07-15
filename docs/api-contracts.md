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

Provider-originated errors may add only the safe `details` fields `source`, `providerId`, `httpStatus`, and `retryAfterSeconds`. Keys, headers, upstream bodies, page text, stacks, and URLs are not part of the response schema.

Messages are validated with shared runtime schemas. The API accepts only stable provider IDs and backend-allowlisted model IDs. It never accepts arbitrary provider URLs, prompts, headers, or upstream parameters from the client.

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
  providerId?: ProviderId;
  modelId?: string;
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
  providerId: ProviderId;
  modelId: string;
  detectedSourceLanguage?: string;
  translations: Array<{ id: string; translatedText: string }>;
  usage?: {
    inputCharacters?: number;
    outputCharacters?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  partial?: boolean;
};
```

## Routes

### `POST /v1/translate`

Mock mode is unauthenticated only in local development/test. Non-mock and production use requires backend authentication. The route accepts `TranslationRequest`; returns `TranslationResponse` or a normalized error. Defaults: at most 500 segments, 2,000 characters per segment, 20,000 input characters, 60,000 output characters, and a 256 KB JSON body.

### `GET /v1/providers`

Returns safe registry metadata, configuration/enabled state, allowlisted models, capabilities, active default, data recipient, and privacy notice. It excludes keys, base URLs, headers, raw environment values, and upstream errors.

### `GET /v1/providers/:providerId/models`

Returns only the backend-configured model allowlist. Optional `?refresh=true` performs bounded cached discovery when the profile supports it and filters the result against the same allowlist.

### `POST /v1/providers/:providerId/test`

Uses one fixed tiny backend-controlled translation. The endpoint accepts no caller text, URL, header, model, or provider parameter beyond the validated path ID and returns normalized status/model/latency only.

### `POST /v1/detect-language`

Accepts one bounded text sample; returns a validated language code, confidence category, and request ID. The local implementation is a deterministic script heuristic.

### `GET /v1/languages`

Returns the product allowlist of source/target language codes and capabilities. The extension must not infer provider capabilities from arbitrary user input.

### `GET /v1/usage`

Returns aggregate usage/quota state for the authenticated user. It must not return raw page text or request contents.

### `GET /v1/health`

Unauthenticated liveness/readiness response with version and provider availability category only; no secrets or detailed upstream errors.

## Extension message contracts

Implemented message types include settings/health/provider/status operations plus `GET_PROVIDERS`, `TEST_PROVIDER`, `START_PAGE_TRANSLATION`, `CONTINUE_PAGE_TRANSLATION`, `TRANSLATE_SEGMENTS`, `GET_TRANSLATION_PROGRESS`, `REPORT_TRANSLATION_PROGRESS`, `CANCEL_PAGE_TRANSLATION`, `RESTORE_PAGE`, `TRANSLATE_SELECTION`, and `SHOW_SELECTION_RESULT`. Every message carries contract version and request ID; translation work is bound to a session ID and tab. Continuation keeps the session and can request smaller batches, but it selects only untranslated connected records.

## Error categories

`UNSUPPORTED_PAGE`, `AUTH_REQUIRED`, `INVALID_REQUEST`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_TIMEOUT`, `INVALID_PROVIDER_RESPONSE`, `CANCELLED`, `STALE_SESSION`, `PARTIAL_FAILURE`, and `INTERNAL_ERROR`.

The extension normalizes stop state to `LOCAL_RATE_LIMIT`, `UPSTREAM_RATE_LIMIT`, `UPSTREAM_QUOTA_EXHAUSTED`, `AUTHENTICATION_FAILED`, `PROVIDER_TIMEOUT`, `PROVIDER_UNAVAILABLE`, `INVALID_PROVIDER_RESPONSE`, `BACKEND_UNAVAILABLE`, `CANCELLED`, `NAVIGATION_CHANGED`, `UNSUPPORTED_CONTENT`, `PRIVACY_EXCLUSION`, `RETRY_EXHAUSTED`, or `UNKNOWN`. Progress carries translated, queued, waiting, retrying, and failed counts plus privacy-safe metadata needed for exact explanations.
