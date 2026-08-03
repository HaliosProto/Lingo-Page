import { describe, expect, it } from 'vitest';
import { DEFAULT_TRANSLATION_POLICY } from '@translation/shared-types';
import {
  appSettingsSchema,
  translationPolicySchema,
  translationRequestSchema,
  translationResponseSchema,
} from './index';

describe('translation policy validation', () => {
  it('migrates missing stored policy to safe defaults and normalizes language tags', () => {
    const settings = appSettingsSchema.parse({});
    expect(settings.translationPolicy).toEqual(DEFAULT_TRANSLATION_POLICY);
    expect(
      translationPolicySchema.parse({
        ...DEFAULT_TRANSLATION_POLICY,
        sourceLanguage: 'EN-us',
        targetLanguage: 'FA-ir',
      }),
    ).toMatchObject({ sourceLanguage: 'en-US', targetLanguage: 'fa-IR' });
  });

  it('rejects unknown versions, oversized briefs, and executable-shaped extra fields', () => {
    expect(
      translationPolicySchema.safeParse({ ...DEFAULT_TRANSLATION_POLICY, schemaVersion: 2 })
        .success,
    ).toBe(false);
    expect(
      translationPolicySchema.safeParse({
        ...DEFAULT_TRANSLATION_POLICY,
        customInstructions: 'x'.repeat(2_001),
      }).success,
    ).toBe(false);
    expect(
      translationPolicySchema.safeParse({ ...DEFAULT_TRANSLATION_POLICY, providerModel: 'secret' })
        .success,
    ).toBe(false);
  });

  it('enforces site glossary scope and reports conflicting policy entries', () => {
    const entry = {
      id: 'term_1',
      sourceTerm: 'Lingo',
      preferredTranslation: 'لینگو',
      preserve: false,
      caseSensitive: false,
      wholeWord: true,
      enabled: true,
      scope: 'site' as const,
    };
    expect(
      translationPolicySchema.safeParse({
        ...DEFAULT_TRANSLATION_POLICY,
        terminology: { ...DEFAULT_TRANSLATION_POLICY.terminology, entries: [entry] },
      }).success,
    ).toBe(false);
    expect(
      translationPolicySchema.safeParse({
        ...DEFAULT_TRANSLATION_POLICY,
        terminology: {
          ...DEFAULT_TRANSLATION_POLICY.terminology,
          entries: [
            { ...entry, siteOrigin: 'https://example.com' },
            { ...entry, id: 'term_2', siteOrigin: 'https://example.com' },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it('bounds context, terminology, review, and requires current response versions for current requests', () => {
    const request = {
      schemaVersion: 1 as const,
      requestId: 'req_policy_contract_12345',
      sessionId: 'session_policy_contract_12345',
      targetLanguage: 'fa',
      mode: 'page' as const,
      segments: [{ id: 'segment-1', text: 'Hello' }],
      sectionContext: {
        headingPath: Array.from({ length: 9 }, () => 'Heading'),
        precedingContext: [],
        followingContext: [],
      },
    };
    expect(translationRequestSchema.safeParse(request).success).toBe(false);
    expect(
      translationResponseSchema.safeParse({
        schemaVersion: 2,
        requestId: request.requestId,
        sessionId: request.sessionId,
        providerId: 'mock',
        modelId: 'mock-deterministic',
        translations: [],
      }).success,
    ).toBe(false);
  });

  it('records bounded policy-validation and storage baselines', () => {
    const started = performance.now();
    for (let index = 0; index < 1_000; index += 1)
      translationPolicySchema.parse(DEFAULT_TRANSLATION_POLICY);
    const validationMs = performance.now() - started;
    const policyBytes = new TextEncoder().encode(JSON.stringify(DEFAULT_TRANSLATION_POLICY)).length;

    expect(validationMs).toBeLessThan(1_000);
    expect(policyBytes).toBeLessThan(10_000);
    console.log(
      `LINGO_POLICY_BASELINE=${JSON.stringify({ validationIterations: 1_000, validationMs: Math.round(validationMs * 100) / 100, policyBytes })}`,
    );
  });
});
