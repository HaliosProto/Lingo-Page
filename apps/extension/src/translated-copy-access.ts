export const TRANSLATED_COPY_ACCESS_EXPLANATION =
  'Lingo Page needs access to this site to open an automatically translated copy.';

export const TRANSLATED_COPY_ACCESS_DENIED =
  'Site access was not granted. You can duplicate this tab and invoke Lingo Page manually there.';

type OriginPermissions = {
  origins: string[];
};

export type SitePermissionApi = {
  contains(permissions: OriginPermissions): Promise<boolean>;
  request(permissions: OriginPermissions): Promise<boolean>;
};

export type TranslatedCopySiteAccess = {
  originPattern: string;
  alreadyGranted: boolean;
  granted: boolean;
};

export type TranslatedCopySiteAccessRequest =
  | { status: 'unsupported' }
  | { status: 'previously-denied'; originPattern: string }
  | { status: 'pending'; request: Promise<TranslatedCopySiteAccess> };

export function translatedCopyOriginPattern(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return `${url.origin}/*`;
  } catch {
    return undefined;
  }
}

export function requestTranslatedCopySiteAccess(
  rawUrl: string,
  permissions: SitePermissionApi,
): Promise<TranslatedCopySiteAccess> {
  const originPattern = translatedCopyOriginPattern(rawUrl);
  if (!originPattern) {
    return Promise.resolve({ originPattern: '', alreadyGranted: false, granted: false });
  }

  const requestedPermissions = { origins: [originPattern] };
  const alreadyGranted = permissions.contains(requestedPermissions);
  const granted = permissions.request(requestedPermissions);
  return Promise.all([alreadyGranted, granted]).then(([hadAccess, hasAccess]) => ({
    originPattern,
    alreadyGranted: hadAccess,
    granted: hasAccess,
  }));
}

export function beginTranslatedCopySiteAccessRequest(
  rawUrl: string,
  permissions: SitePermissionApi,
  deniedOrigins: Set<string>,
): TranslatedCopySiteAccessRequest {
  const originPattern = translatedCopyOriginPattern(rawUrl);
  if (!originPattern) return { status: 'unsupported' };
  if (deniedOrigins.has(originPattern)) return { status: 'previously-denied', originPattern };
  const request = requestTranslatedCopySiteAccess(rawUrl, permissions).then((result) => {
    if (!result.granted) deniedOrigins.add(result.originPattern);
    return result;
  });
  return { status: 'pending', request };
}

export async function hasTranslatedCopySiteAccess(
  rawUrl: string,
  permissions: Pick<SitePermissionApi, 'contains'>,
): Promise<boolean> {
  const originPattern = translatedCopyOriginPattern(rawUrl);
  return originPattern ? await permissions.contains({ origins: [originPattern] }) : false;
}
