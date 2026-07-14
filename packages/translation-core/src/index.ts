import type {
  GlossaryEntry,
  TranslationRequest,
  TranslationResponse,
  TranslationSegment,
} from '@translation/shared-types';

const urlPattern = /https?:\/\/\S+|www\.\S+/giu;
const emailPattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu;
const placeholderPattern = /\{\{[^{}]+\}\}|\{[^{}]+\}|%[a-z]|\$\{[^{}]+\}/giu;
const htmlPattern = /<\/?[a-z][^>]*>/iu;

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

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
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
}): string {
  return `cache_${fnv1a(JSON.stringify(input))}`;
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

export function protectTokens(text: string): { text: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  let ordinal = 0;
  const replace = (value: string) => {
    const token = `__LINGO_TOKEN_${ordinal}__`;
    ordinal += 1;
    tokens.set(token, value);
    return token;
  };
  const protectedText = text
    .replace(urlPattern, replace)
    .replace(emailPattern, replace)
    .replace(placeholderPattern, replace);
  return { text: protectedText, tokens };
}

export function restoreTokens(text: string, tokens: Map<string, string>): string {
  let restored = text;
  for (const [token, value] of tokens) {
    if (!restored.includes(token)) {
      throw new Error(`Missing protected token: ${token}`);
    }
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
