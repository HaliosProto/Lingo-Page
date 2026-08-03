import { describe, expect, it } from 'vitest';
import { DEFAULT_TRANSLATION_POLICY, type GlossaryEntry } from '@translation/shared-types';
import {
  createCacheKey,
  createTranslationPolicyFingerprint,
  filterRelevantGlossary,
  protectTokens,
  resolveTranslationPolicy,
  restoreTokens,
  runDeterministicQualityChecks,
  segmentsRequiringReview,
  stableSerialize,
  updateTerminologyMemory,
} from './index';

const glossary = (overrides: Partial<GlossaryEntry> = {}): GlossaryEntry => ({
  id: 'term_1',
  sourceTerm: 'regulator',
  preferredTranslation: 'تنظیم‌کننده',
  preserve: false,
  caseSensitive: false,
  wholeWord: true,
  enabled: true,
  ...overrides,
});

describe('structured translation intelligence', () => {
  it('resolves automatic, site, glossary, and session policy layers deterministically', () => {
    const policy = resolveTranslationPolicy({
      automatic: { style: { tone: 'neutral' } },
      site: { style: { tone: 'formal', audience: 'expert' } },
      glossary: { terminology: { entries: [glossary()] } },
      session: { style: { tone: 'casual' }, customInstructions: 'Keep headings concise.' },
    });

    expect(policy.style).toMatchObject({ tone: 'casual', audience: 'expert' });
    expect(policy.terminology.entries).toHaveLength(1);
    expect(policy.customInstructions).toBe('Keep headings concise.');
    expect(createTranslationPolicyFingerprint(policy)).toBe(
      createTranslationPolicyFingerprint(JSON.parse(stableSerialize(policy))),
    );
  });

  it('filters glossary entries by text, language, and site without leaking unrelated terms', () => {
    const entries = [
      glossary({ id: 'relevant', scope: 'site', siteOrigin: 'https://example.com' }),
      glossary({ id: 'wrong-site', scope: 'site', siteOrigin: 'https://other.example' }),
      glossary({ id: 'absent', sourceTerm: 'turbine' }),
    ];
    expect(
      filterRelevantGlossary(
        entries,
        [{ id: 'segment-1', text: 'Install the regulator.' }],
        'en',
        'fa',
        'https://example.com',
      ).map((entry) => entry.id),
    ).toEqual(['relevant']);
  });

  it('protects and strictly restores identifiers, numbers, URLs, codes, formulas, and placeholders', () => {
    const source = 'Use Fisher Y692 at https://example.com: pressure=10bar for {{deviceId}}.';
    const protectedValue = protectTokens(source, ['Fisher']);
    expect(protectedValue.text).not.toContain('Y692');
    expect(protectedValue.text).not.toContain('10bar');
    expect(restoreTokens(protectedValue.text, protectedValue.tokens)).toBe(source);

    const firstToken = [...protectedValue.tokens.keys()][0]!;
    expect(() =>
      restoreTokens(protectedValue.text.replace(firstToken, ''), protectedValue.tokens),
    ).toThrow('Missing protected token');
    expect(() =>
      restoreTokens(`${protectedValue.text} ${firstToken}`, protectedValue.tokens),
    ).toThrow('Duplicated protected token');
  });

  it('detects deterministic integrity and terminology findings and nominates only suspicious IDs', () => {
    const policy = {
      ...DEFAULT_TRANSLATION_POLICY,
      sourceLanguage: 'en',
      targetLanguage: 'fa',
      terminology: { ...DEFAULT_TRANSLATION_POLICY.terminology, entries: [glossary()] },
    };
    const findings = runDeterministicQualityChecks({
      segment: { id: 'segment-1', text: 'Install 2 regulator units.' },
      translatedText: 'Install 3 units.',
      targetLanguage: 'fa',
      glossary: policy.terminology.entries,
    });
    expect(findings.map((finding) => finding.reason)).toEqual(
      expect.arrayContaining(['number-mismatch', 'glossary-mismatch']),
    );
    expect(segmentsRequiringReview(findings, policy)).toEqual(['segment-1']);
    expect(
      segmentsRequiringReview(findings, {
        ...policy,
        quality: { ...policy.quality, selectiveReview: 'off' },
      }),
    ).toEqual([]);
  });

  it('uses semantic policy and context versions in cache identity but ignores unrelated UI state', () => {
    const policy = createTranslationPolicyFingerprint(DEFAULT_TRANSLATION_POLICY);
    const base = {
      sourceLanguage: 'en',
      targetLanguage: 'fa',
      text: 'Hello',
      provider: 'mock:mock-deterministic',
      policyFingerprint: policy,
      contextFingerprint: 'fp_context',
      promptTemplateVersion: 1,
      outputContractVersion: 1,
    };
    expect(createCacheKey(base)).toBe(createCacheKey({ ...base }));
    expect(createCacheKey(base)).not.toBe(
      createCacheKey({ ...base, policyFingerprint: 'policy_changed' }),
    );
    expect(createCacheKey(base)).not.toBe(
      createCacheKey({ ...base, contextFingerprint: 'fp_other' }),
    );
  });

  it('keeps cross-batch terminology memory bounded and lets the latest validated value win', () => {
    const additions = Array.from({ length: 205 }, (_, index) => ({
      sourceTerm: `term-${index}`,
      translatedTerm: `value-${index}`,
      source: 'validated-translation' as const,
    }));
    const memory = updateTerminologyMemory([], additions);
    expect(memory).toHaveLength(200);
    expect(
      updateTerminologyMemory(memory, [{ ...additions.at(-1)!, translatedTerm: 'latest' }]).at(-1),
    ).toMatchObject({ translatedTerm: 'latest' });
  });

  it('records bounded glossary, fingerprint, terminology, and quality-check baselines', () => {
    const entries = Array.from({ length: 500 }, (_, index) =>
      glossary({ id: `term_${index}`, sourceTerm: `term-${index}` }),
    );
    const segments = Array.from({ length: 50 }, (_, index) => ({
      id: `segment-${index}`,
      text: `Use term-${index} with product AB-${index} at ${index} units.`,
    }));
    const glossaryStarted = performance.now();
    const relevant = filterRelevantGlossary(entries, segments, 'en', 'fa');
    const glossaryMs = performance.now() - glossaryStarted;
    const fingerprintStarted = performance.now();
    for (let index = 0; index < 1_000; index += 1)
      createTranslationPolicyFingerprint(DEFAULT_TRANSLATION_POLICY);
    const fingerprintMs = performance.now() - fingerprintStarted;
    const qualityStarted = performance.now();
    for (const segment of segments)
      runDeterministicQualityChecks({
        segment,
        translatedText: `[fa] ${segment.text}`,
        targetLanguage: 'fa',
        glossary: relevant,
      });
    const qualityMs = performance.now() - qualityStarted;
    const memory = updateTerminologyMemory(
      [],
      entries.map((entry) => ({
        sourceTerm: entry.sourceTerm,
        translatedTerm: entry.preferredTranslation,
        source: 'glossary' as const,
      })),
    );
    const terminologyBytes = new TextEncoder().encode(JSON.stringify(memory)).length;

    expect(relevant).toHaveLength(50);
    expect(glossaryMs).toBeLessThan(1_000);
    expect(fingerprintMs).toBeLessThan(1_000);
    expect(qualityMs).toBeLessThan(1_000);
    expect(memory).toHaveLength(200);
    console.log(
      `LINGO_CORE_INTELLIGENCE_BASELINE=${JSON.stringify({ segments: segments.length, glossaryEntries: entries.length, relevantEntries: relevant.length, glossaryMs: Math.round(glossaryMs * 100) / 100, fingerprintIterations: 1_000, fingerprintMs: Math.round(fingerprintMs * 100) / 100, qualityMs: Math.round(qualityMs * 100) / 100, terminologyEntries: memory.length, terminologyBytes })}`,
    );
  });
});
