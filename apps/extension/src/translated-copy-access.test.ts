import { describe, expect, it } from 'vitest';
import {
  beginTranslatedCopySiteAccessRequest,
  hasTranslatedCopySiteAccess,
  requestTranslatedCopySiteAccess,
  translatedCopyOriginPattern,
  type SitePermissionApi,
} from './translated-copy-access';

function permissionHarness(initialOrigins: string[] = []) {
  const grantedOrigins = new Set(initialOrigins);
  const requested: string[][] = [];
  let allowRequests = true;
  const api: SitePermissionApi = {
    contains: async ({ origins }) => origins.every((origin) => grantedOrigins.has(origin)),
    request: async ({ origins }) => {
      requested.push([...origins]);
      if (allowRequests) origins.forEach((origin) => grantedOrigins.add(origin));
      return allowRequests;
    },
  };
  return {
    api,
    grantedOrigins,
    requested,
    denyRequests: () => {
      allowRequests = false;
    },
  };
}

describe('translated-copy site access', () => {
  it('creates exact HTTP and HTTPS origin patterns without paths, queries, or fragments', () => {
    expect(translatedCopyOriginPattern('https://en.wikipedia.org/wiki/Tehran?x=1#History')).toBe(
      'https://en.wikipedia.org/*',
    );
    expect(translatedCopyOriginPattern('http://127.0.0.1:4173/fixture.html')).toBe(
      'http://127.0.0.1:4173/*',
    );
    expect(translatedCopyOriginPattern('chrome://extensions')).toBeUndefined();
  });

  it('requests only the current origin and reports a newly granted permission', async () => {
    const harness = permissionHarness();
    await expect(
      requestTranslatedCopySiteAccess('https://en.wikipedia.org/wiki/Tehran', harness.api),
    ).resolves.toEqual({
      originPattern: 'https://en.wikipedia.org/*',
      alreadyGranted: false,
      granted: true,
    });
    expect(harness.requested).toEqual([['https://en.wikipedia.org/*']]);
    expect(harness.grantedOrigins).not.toContain('https://*/*');
  });

  it('reports denial after exactly one request', async () => {
    const harness = permissionHarness();
    harness.denyRequests();
    await expect(
      requestTranslatedCopySiteAccess('https://example.com/article', harness.api),
    ).resolves.toMatchObject({ alreadyGranted: false, granted: false });
    expect(harness.requested).toEqual([['https://example.com/*']]);
  });

  it('does not request the same denied origin again in the current view', async () => {
    const harness = permissionHarness();
    const deniedOrigins = new Set<string>();
    harness.denyRequests();
    const first = beginTranslatedCopySiteAccessRequest(
      'https://example.com/article',
      harness.api,
      deniedOrigins,
    );
    expect(first.status).toBe('pending');
    if (first.status === 'pending') await first.request;
    expect(
      beginTranslatedCopySiteAccessRequest(
        'https://example.com/another-article',
        harness.api,
        deniedOrigins,
      ),
    ).toEqual({ status: 'previously-denied', originPattern: 'https://example.com/*' });
    expect(harness.requested).toEqual([['https://example.com/*']]);
  });

  it('recognizes an already-granted origin without broadening it', async () => {
    const harness = permissionHarness(['https://example.com/*']);
    await expect(
      requestTranslatedCopySiteAccess('https://example.com/another-page', harness.api),
    ).resolves.toEqual({
      originPattern: 'https://example.com/*',
      alreadyGranted: true,
      granted: true,
    });
    expect(harness.requested).toEqual([['https://example.com/*']]);
    expect(harness.grantedOrigins).toEqual(new Set(['https://example.com/*']));
  });

  it('rejects an ungranted redirect origin', async () => {
    const harness = permissionHarness(['https://example.com/*']);
    await expect(
      hasTranslatedCopySiteAccess('https://example.com/redirected', harness.api),
    ).resolves.toBe(true);
    await expect(
      hasTranslatedCopySiteAccess('https://other.example/redirected', harness.api),
    ).resolves.toBe(false);
  });

  it('detects revocation and does not restore access when the next request is denied', async () => {
    const harness = permissionHarness();
    await requestTranslatedCopySiteAccess('http://example.com/page', harness.api);
    harness.grantedOrigins.delete('http://example.com/*');
    harness.denyRequests();
    await expect(hasTranslatedCopySiteAccess('http://example.com/page', harness.api)).resolves.toBe(
      false,
    );
    await expect(
      requestTranslatedCopySiteAccess('http://example.com/page', harness.api),
    ).resolves.toMatchObject({ alreadyGranted: false, granted: false });
    expect(harness.requested).toEqual([['http://example.com/*'], ['http://example.com/*']]);
  });
});
