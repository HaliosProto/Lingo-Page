import { Hono } from 'hono';
import {
  DEFAULT_MAX_BODY_BYTES,
  developmentLanguages,
  isAllowedExtensionOrigin,
  parseApiEnvironment,
  type ApiEnvironment,
} from '@translation/shared-config';
import type { HealthResponse, LanguagesResponse } from '@translation/shared-types';
import {
  errorResponseSchema,
  healthResponseSchema,
  languagesResponseSchema,
} from '@translation/shared-validation';

export type EnvironmentBindings = Record<string, string | undefined>;

type AppVariables = {
  requestId: string;
  environment: ApiEnvironment;
};

const app = new Hono<{
  Bindings: EnvironmentBindings;
  Variables: AppVariables;
}>();

function createRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll('-', '')}`;
}

function createError(
  code: 'INVALID_REQUEST' | 'NOT_IMPLEMENTED' | 'INTERNAL_ERROR',
  message: string,
  requestId: string,
  retryable = false,
) {
  return errorResponseSchema.parse({
    error: { code, message, requestId, retryable },
  });
}

app.use('*', async (context, next) => {
  const requestId = createRequestId();
  const environment = parseApiEnvironment(context.env ?? {});
  context.set('requestId', requestId);
  context.set('environment', environment);
  context.header('X-Content-Type-Options', 'nosniff');
  context.header('X-Frame-Options', 'DENY');
  context.header('Referrer-Policy', 'no-referrer');
  context.header('Cache-Control', 'no-store');
  context.header('X-Request-ID', requestId);

  const origin = context.req.header('origin');
  if (origin && isAllowedExtensionOrigin(origin, environment)) {
    context.header('Access-Control-Allow-Origin', origin);
    context.header('Vary', 'Origin');
    context.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    context.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    context.header('Access-Control-Max-Age', '600');
  }

  if (context.req.method === 'OPTIONS') {
    return context.body(null, 204);
  }

  const contentLength = Number(context.req.header('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > DEFAULT_MAX_BODY_BYTES) {
    return context.json(
      createError('INVALID_REQUEST', 'Request body exceeds the development limit.', requestId),
      413,
    );
  }

  await next();
  return context.res;
});

app.get('/v1/health', (context) => {
  const environment = context.get('environment');
  const response: HealthResponse = healthResponseSchema.parse({
    version: 1,
    service: 'translation-api',
    status: 'ok',
    environment: environment.ENVIRONMENT,
    appVersion: environment.APP_VERSION,
    translationEnabled: environment.TRANSLATION_ENABLED,
    provider: { configured: false, name: 'none' },
    requestId: context.get('requestId'),
  });
  return context.json(response);
});

app.get('/v1/languages', (context) => {
  const response: LanguagesResponse = languagesResponseSchema.parse({
    version: 1,
    languages: developmentLanguages,
    requestId: context.get('requestId'),
  });
  return context.json(response);
});

app.post('/v1/translate', (context) => {
  return context.json(
    createError(
      'NOT_IMPLEMENTED',
      'Translation is intentionally unavailable until Milestone 3.',
      context.get('requestId'),
    ),
    501,
  );
});

app.post('/v1/detect-language', (context) => {
  return context.json(
    createError(
      'NOT_IMPLEMENTED',
      'Language detection is intentionally unavailable until a later milestone.',
      context.get('requestId'),
    ),
    501,
  );
});

app.get('/v1/usage', (context) => {
  return context.json(
    createError(
      'NOT_IMPLEMENTED',
      'Usage reporting is intentionally unavailable until account infrastructure exists.',
      context.get('requestId'),
    ),
    501,
  );
});

app.notFound((context) => {
  return context.json(
    createError(
      'INVALID_REQUEST',
      'The requested API route does not exist.',
      context.get('requestId'),
    ),
    404,
  );
});

app.onError((error, context) => {
  // Operational logging intentionally excludes request bodies and page content.
  console.error('api_request_failed', {
    requestId: context.get('requestId'),
    error: error instanceof Error ? error.name : 'unknown',
  });
  return context.json(
    createError(
      'INTERNAL_ERROR',
      'The API could not complete the request.',
      context.get('requestId'),
      true,
    ),
    500,
  );
});

export { app };

export default {
  fetch: app.fetch,
};
