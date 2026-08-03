import type {
  GlossaryEntry,
  TerminologyMemoryEntry,
  TranslationPolicy,
  TranslationQualityFinding,
  TranslationRequest,
  TranslationResponse,
  TranslationSegment,
} from '@translation/shared-types';
import { DEFAULT_TRANSLATION_POLICY } from '@translation/shared-types';

const urlPattern = /https?:\/\/\S+|www\.\S+/giu;
const emailPattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu;
const placeholderPattern = /\{\{[^{}]+\}\}|\{[^{}]+\}|%[a-z]|\$\{[^{}]+\}/giu;
const reservedTokenPattern = /__LINGO_TOKEN_\d+__/gu;
const htmlPattern = /<\/?[a-z][^>]*>/iu;
const numberPattern =
  /(?<![\p{L}\p{N}_])[-+]?\d+(?:[.,:/-]\d+)*(?:\s?%|\s?[A-Za-z]{1,4})?(?![\p{L}\p{N}_])/gu;
const productCodePattern =
  /\b(?=[A-Z0-9._/-]{3,32}\b)(?=[A-Z0-9._/-]*[A-Z])(?=[A-Z0-9._/-]*\d)[A-Z0-9]+(?:[._/-][A-Z0-9]+)*\b/gu;
const formulaPattern = /\b[A-Za-z][A-Za-z0-9_]{0,30}\s*=\s*[^\s,;]{1,80}/gu;
const identifierPattern = /\b(?:[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+|[a-z]+[A-Z][A-Za-z0-9]*)\b/gu;

export function normalizeText(text: string): {
  normalized: string;
  leadingWhitespace: string;
  trailingWhitespace: string;
} {
  const leadingWhitespace = text.match(/^\s*/u)?.[0] ?? '';
  const trailingWhitespace = text.match(/\s*$/u)?.[0] ?? '';
  const middleEnd = Math.max(leadingWhitespace.length, text.length - trailingWhitespace.length);
  const normalized = text.slice(leadingWhitespace.length, middleEnd).replace(/\s+/gu, ' ').trim();
  return { normalized, leadingWhitespace, trailingWhitespace };
}

export function isLikelyTranslatableText(text: string): boolean {
  const { normalized } = normalizeText(text);
  if (normalized.length < 2 || normalized.length > 2_000) return false;
  if (urlPattern.test(normalized) && normalized.replace(urlPattern, '').trim().length === 0) {
    urlPattern.lastIndex = 0;
    return false;
  }
  urlPattern.lastIndex = 0;
  if (emailPattern.test(normalized) && normalized.replace(emailPattern, '').trim().length === 0) {
    emailPattern.lastIndex = 0;
    return false;
  }
  emailPattern.lastIndex = 0;
  if (/^[\d\s.,:/+\-()%#]+$/u.test(normalized)) return false;
  if (/^[A-Z0-9_\-.]{2,64}$/u.test(normalized)) return false;
  return /[\p{L}\p{Script=Han}]/u.test(normalized);
}

export function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function createTextFingerprint(value: string): string {
  return `fp_${fnv1a(value.normalize('NFKC').replace(/\s+/gu, ' ').trim())}`;
}

export function createSegmentId(text: string, ordinal: number, context = ''): string {
  return `seg_${ordinal}_${fnv1a(`${text}\u0000${context}`)}`;
}

export function createCacheKey(input: {
  sourceLanguage?: string;
  targetLanguage: string;
  text: string;
  context?: string;
  provider: string;
  glossaryVersion?: string;
  tone?: string;
  formality?: string;
  policyFingerprint?: string;
  contextFingerprint?: string;
  promptTemplateVersion?: number;
  outputContractVersion?: number;
}): string {
  return `cache_${fnv1a(JSON.stringify(input))}`;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function createTranslationPolicyFingerprint(policy: TranslationPolicy): string {
  return `policy_${fnv1a(stableSerialize(policy))}`;
}

type PolicyLayer = Partial<
  Omit<TranslationPolicy, 'behavior' | 'style' | 'preserve' | 'terminology' | 'context' | 'quality'>
> & {
  behavior?: Partial<TranslationPolicy['behavior']>;
  style?: Partial<TranslationPolicy['style']>;
  preserve?: Partial<TranslationPolicy['preserve']>;
  terminology?: Partial<Omit<TranslationPolicy['terminology'], 'entries'>> & {
    entries?: GlossaryEntry[];
  };
  context?: Partial<TranslationPolicy['context']>;
  quality?: Partial<TranslationPolicy['quality']>;
};

function mergeGlossary(layers: PolicyLayer[]): GlossaryEntry[] {
  const entries = new Map<string, GlossaryEntry>();
  for (const layer of layers) {
    for (const entry of layer.terminology?.entries ?? []) {
      const key = [
        entry.sourceLanguage ?? '*',
        entry.targetLanguage ?? '*',
        entry.scope ?? 'global',
        entry.siteOrigin ?? '*',
        entry.sourceTerm.normalize('NFKC').toLocaleLowerCase(),
      ].join('\u0000');
      entries.set(key, entry);
    }
  }
  return [...entries.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function resolveTranslationPolicy(input: {
  defaults?: TranslationPolicy;
  automatic?: PolicyLayer;
  site?: PolicyLayer;
  glossary?: PolicyLayer;
  session?: PolicyLayer;
}): TranslationPolicy {
  const defaults = input.defaults ?? DEFAULT_TRANSLATION_POLICY;
  const layers: PolicyLayer[] = [
    defaults,
    input.automatic ?? {},
    input.site ?? {},
    input.glossary ?? {},
    input.session ?? {},
  ];
  const latest = <K extends keyof TranslationPolicy>(key: K): TranslationPolicy[K] => {
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const value = layers[index]![key];
      if (value !== undefined) return value as TranslationPolicy[K];
    }
    return defaults[key];
  };
  return {
    schemaVersion: defaults.schemaVersion,
    sourceLanguage: latest('sourceLanguage'),
    targetLanguage: latest('targetLanguage'),
    behavior: Object.assign({}, ...layers.map((layer) => layer.behavior)),
    style: Object.assign({}, ...layers.map((layer) => layer.style)),
    preserve: Object.assign({}, ...layers.map((layer) => layer.preserve)),
    terminology: {
      ...Object.assign({}, ...layers.map((layer) => layer.terminology)),
      entries: mergeGlossary(layers),
    },
    context: Object.assign({}, ...layers.map((layer) => layer.context)),
    quality: Object.assign({}, ...layers.map((layer) => layer.quality)),
    customInstructions: latest('customInstructions'),
  } as TranslationPolicy;
}

export function filterRelevantGlossary(
  entries: GlossaryEntry[],
  segments: TranslationSegment[],
  sourceLanguage?: string,
  targetLanguage?: string,
  siteOrigin?: string,
  maximum = 200,
): GlossaryEntry[] {
  const text = segments.map((segment) => segment.text).join('\n');
  return entries
    .filter((entry) => {
      if (!entry.enabled || !entry.sourceTerm.trim()) return false;
      if (entry.sourceLanguage && sourceLanguage && entry.sourceLanguage !== sourceLanguage)
        return false;
      if (entry.targetLanguage && targetLanguage && entry.targetLanguage !== targetLanguage)
        return false;
      if (entry.scope === 'site' && entry.siteOrigin !== siteOrigin) return false;
      const haystack = entry.caseSensitive ? text : text.toLocaleLowerCase();
      const needle = entry.caseSensitive ? entry.sourceTerm : entry.sourceTerm.toLocaleLowerCase();
      return haystack.includes(needle);
    })
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, maximum);
}

export function updateTerminologyMemory(
  current: TerminologyMemoryEntry[],
  additions: TerminologyMemoryEntry[],
  maximum = 200,
): TerminologyMemoryEntry[] {
  const memory = new Map<string, TerminologyMemoryEntry>();
  for (const entry of [...current, ...additions]) {
    memory.set(entry.sourceTerm.normalize('NFKC').toLocaleLowerCase(), {
      ...entry,
      sourceTerm: entry.sourceTerm.slice(0, 64),
      translatedTerm: entry.translatedTerm.slice(0, 128),
    });
  }
  return [...memory.values()].slice(-maximum);
}

export function deduplicateSegments(segments: TranslationSegment[]): {
  unique: TranslationSegment[];
  duplicates: Map<string, string[]>;
} {
  const byText = new Map<string, TranslationSegment>();
  const duplicates = new Map<string, string[]>();
  for (const segment of segments) {
    const key = `${segment.text}\u0000${segment.context ?? ''}`;
    const existing = byText.get(key);
    if (existing) {
      duplicates.set(existing.id, [...(duplicates.get(existing.id) ?? []), segment.id]);
    } else {
      byText.set(key, segment);
    }
  }
  return { unique: [...byText.values()], duplicates };
}

export function batchSegments(
  segments: TranslationSegment[],
  limits: { maxSegments: number; maxCharacters: number },
): TranslationSegment[][] {
  const batches: TranslationSegment[][] = [];
  let current: TranslationSegment[] = [];
  let characters = 0;
  for (const segment of segments) {
    const wouldOverflow =
      current.length >= limits.maxSegments ||
      characters + segment.text.length > limits.maxCharacters;
    if (current.length > 0 && wouldOverflow) {
      batches.push(current);
      current = [];
      characters = 0;
    }
    current.push(segment);
    characters += segment.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function protectTokens(
  text: string,
  explicitTokens: string[] = [],
): { text: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  const spans: Array<{ start: number; end: number; value: string }> = [];
  const patterns = [
    reservedTokenPattern,
    urlPattern,
    emailPattern,
    placeholderPattern,
    formulaPattern,
    productCodePattern,
    identifierPattern,
    numberPattern,
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined || !match[0]) continue;
      spans.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  for (const value of explicitTokens.filter(Boolean)) {
    let start = text.indexOf(value);
    while (start >= 0) {
      spans.push({ start, end: start + value.length, value });
      start = text.indexOf(value, start + value.length);
    }
  }
  const selected: typeof spans = [];
  for (const span of spans.sort(
    (left, right) => left.start - right.start || right.end - left.end,
  )) {
    if (!selected.some((item) => span.start < item.end && span.end > item.start))
      selected.push(span);
  }
  let output = '';
  let cursor = 0;
  selected.forEach((span, ordinal) => {
    output += text.slice(cursor, span.start);
    let token = `__LINGO_TOKEN_${ordinal}__`;
    while (text.includes(token) || tokens.has(token))
      token = `__LINGO_TOKEN_${ordinal + 1}_${tokens.size}__`;
    tokens.set(token, span.value);
    output += token;
    cursor = span.end;
  });
  output += text.slice(cursor);
  return { text: output, tokens };
}

export function restoreTokens(text: string, tokens: Map<string, string>): string {
  let restored = text;
  reservedTokenPattern.lastIndex = 0;
  for (const match of restored.matchAll(reservedTokenPattern)) {
    if (!tokens.has(match[0])) {
      reservedTokenPattern.lastIndex = 0;
      throw new Error('Foreign protected token in translation.');
    }
  }
  reservedTokenPattern.lastIndex = 0;
  for (const [token, value] of tokens) {
    const count = restored.split(token).length - 1;
    if (count === 0) {
      throw new Error(`Missing protected token: ${token}`);
    }
    if (count !== 1) throw new Error(`Duplicated protected token: ${token}`);
    restored = restored.replaceAll(token, value);
  }
  return restored;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function applyGlossary(
  text: string,
  entries: GlossaryEntry[],
  sourceLanguage?: string,
  targetLanguage?: string,
): string {
  let output = text;
  for (const entry of entries) {
    if (!entry.enabled) continue;
    if (entry.sourceLanguage && sourceLanguage && entry.sourceLanguage !== sourceLanguage) continue;
    if (entry.targetLanguage && targetLanguage && entry.targetLanguage !== targetLanguage) continue;
    const replacement = entry.preserve ? entry.sourceTerm : entry.preferredTranslation;
    const boundary = entry.wholeWord ? '\\b' : '';
    const expression = new RegExp(
      `${boundary}${escapeRegExp(entry.sourceTerm)}${boundary}`,
      entry.caseSensitive ? 'gu' : 'giu',
    );
    output = output.replace(expression, replacement);
  }
  return output;
}

export function validateTranslationResponse(
  request: TranslationRequest,
  response: TranslationResponse,
): TranslationResponse {
  if (request.requestId !== response.requestId || request.sessionId !== response.sessionId) {
    throw new Error('Translation response does not match the active request and session.');
  }
  const expected = new Map(request.segments.map((segment) => [segment.id, segment]));
  const seen = new Set<string>();
  for (const translation of response.translations) {
    if (!expected.has(translation.id))
      throw new Error(`Unexpected translation ID: ${translation.id}`);
    if (seen.has(translation.id)) throw new Error(`Duplicate translation ID: ${translation.id}`);
    seen.add(translation.id);
    const original = expected.get(translation.id)!;
    if (!translation.translatedText.trim()) throw new Error(`Empty translation: ${translation.id}`);
    if (translation.translatedText.length > Math.max(1_000, original.text.length * 12)) {
      throw new Error(`Excessively expanded translation: ${translation.id}`);
    }
    if (!htmlPattern.test(original.text) && htmlPattern.test(translation.translatedText)) {
      throw new Error(`Unexpected markup in translation: ${translation.id}`);
    }
  }
  if (!response.partial && seen.size !== expected.size) {
    throw new Error('Translation response is missing segment IDs.');
  }
  return response;
}

function matches(pattern: RegExp, value: string): string[] {
  pattern.lastIndex = 0;
  const values = [...value.matchAll(pattern)].map((match) => match[0].normalize('NFKC')).sort();
  pattern.lastIndex = 0;
  return values;
}

function sameValues(pattern: RegExp, source: string, translated: string): boolean {
  return (
    stableSerialize(matches(pattern, source)) === stableSerialize(matches(pattern, translated))
  );
}

export function runDeterministicQualityChecks(input: {
  segment: TranslationSegment;
  translatedText: string;
  targetLanguage: string;
  glossary?: GlossaryEntry[];
}): TranslationQualityFinding[] {
  const findings: TranslationQualityFinding[] = [];
  const add = (reason: TranslationQualityFinding['reason'], severity: 'warning' | 'error') =>
    findings.push({ segmentId: input.segment.id, reason, severity });
  const source = input.segment.text;
  const translated = input.translatedText;
  if (!sameValues(urlPattern, source, translated)) add('url-mismatch', 'error');
  if (!sameValues(emailPattern, source, translated)) add('email-mismatch', 'error');
  if (!sameValues(numberPattern, source, translated)) add('number-mismatch', 'error');
  if (!sameValues(productCodePattern, source, translated)) add('product-code-mismatch', 'error');
  if (!sameValues(formulaPattern, source, translated)) add('formula-mismatch', 'error');
  if (!sameValues(identifierPattern, source, translated)) add('identifier-mismatch', 'error');
  if (!htmlPattern.test(source) && htmlPattern.test(translated)) add('unexpected-markup', 'error');
  if (/[^\t\n\r\u0020-\uFFFF]/u.test(translated)) add('unexpected-control-character', 'error');
  for (const entry of input.glossary ?? []) {
    if (
      !entry.enabled ||
      !source.toLocaleLowerCase().includes(entry.sourceTerm.toLocaleLowerCase())
    )
      continue;
    const expected = entry.preserve ? entry.sourceTerm : entry.preferredTranslation;
    const haystack = entry.caseSensitive ? translated : translated.toLocaleLowerCase();
    const needle = entry.caseSensitive ? expected : expected.toLocaleLowerCase();
    if (needle && !haystack.includes(needle)) add('glossary-mismatch', 'error');
  }
  const normalizedSource = normalizeText(source).normalized;
  const normalizedTranslation = normalizeText(translated).normalized;
  if (
    normalizedSource.length > 3 &&
    normalizedSource.localeCompare(normalizedTranslation, undefined, { sensitivity: 'accent' }) ===
      0
  )
    add('suspicious-identical-output', 'warning');
  if (normalizedSource.length >= 40 && normalizedTranslation.length < normalizedSource.length * 0.2)
    add('possible-truncation', 'warning');
  if (normalizedTranslation.length > Math.max(1_000, normalizedSource.length * 8))
    add('extreme-expansion', 'warning');
  const sourceWords = new Set(normalizedSource.toLocaleLowerCase().match(/\p{L}{3,}/gu) ?? []);
  const translatedWords = new Set(
    normalizedTranslation.toLocaleLowerCase().match(/\p{L}{3,}/gu) ?? [],
  );
  if (sourceWords.size >= 6) {
    const overlap = [...sourceWords].filter((word) => translatedWords.has(word)).length;
    if (overlap / sourceWords.size >= 0.8) add('source-language-carryover', 'warning');
  }
  return findings;
}

export function segmentsRequiringReview(
  findings: TranslationQualityFinding[],
  policy: TranslationPolicy,
): string[] {
  if (policy.quality.selectiveReview !== 'automatic') return [];
  return [...new Set(findings.map((finding) => finding.segmentId))].slice(0, 50);
}

export function decideLayoutAdjustment(input: {
  horizontalOverflow: number;
  verticalOverflow: number;
  currentFontSize: number;
}): 'none' | 'wrap' | 'reduce-font' | 'review' {
  if (input.horizontalOverflow <= 0 && input.verticalOverflow <= 0) return 'none';
  if (input.horizontalOverflow <= 24 && input.verticalOverflow <= 24) return 'wrap';
  if (input.currentFontSize > 12 && input.horizontalOverflow <= 120) return 'reduce-font';
  return 'review';
}
