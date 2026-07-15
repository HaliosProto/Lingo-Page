import type { ProviderDefinition, ProviderId } from '@translation/shared-types';
import { ProviderError, type ProviderRuntimeConfig } from './runtime';

export function isProviderConfigured(config: ProviderRuntimeConfig): boolean {
  if (config.id === 'mock') return true;
  if (config.id === 'deepl') return Boolean(config.apiKey?.trim());
  return Boolean(
    config.apiKey?.trim() &&
    config.defaultModel &&
    config.allowedModels.includes(config.defaultModel),
  );
}

export function toProviderDefinition(config: ProviderRuntimeConfig): ProviderDefinition {
  const configured = isProviderConfigured(config);
  const enabled = config.enabled && configured;
  return {
    id: config.id,
    displayName: config.displayName,
    protocol: config.protocol,
    configured,
    enabled,
    ...(config.defaultModel ? { defaultModel: config.defaultModel } : {}),
    availableModels: config.allowedModels.map((id) => ({
      id,
      displayName: id,
      enabled,
      suitableForTranslation: true,
      supportsStructuredOutput: config.capabilities.structuredOutput,
    })),
    capabilities: config.capabilities,
    status: !configured ? 'unconfigured' : enabled ? 'ready' : 'disabled',
    dataRecipient: config.dataRecipient,
    privacyNotice: config.privacyNotice,
  };
}

export function selectProviderConfig(
  configs: readonly ProviderRuntimeConfig[],
  providerId: ProviderId,
  requestedModel?: string,
): ProviderRuntimeConfig {
  const config = configs.find((candidate) => candidate.id === providerId);
  if (!config || !config.enabled) {
    throw new ProviderError('unavailable', 'The selected provider is disabled.', false);
  }
  if (!isProviderConfigured(config)) {
    throw new ProviderError('authentication', 'The selected provider is not configured.', false);
  }
  const model = requestedModel ?? config.defaultModel;
  if (!model || !config.allowedModels.includes(model)) {
    throw new ProviderError('unavailable', 'The selected model is not allowed.', false);
  }
  return { ...config, defaultModel: model };
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value > 255)) return true;
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second! >= 16 && second! <= 31) ||
    (first === 192 && second === 168) ||
    first! >= 224
  );
}

export function validateCustomProviderBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new ProviderError('unavailable', 'Custom provider URL is invalid.', false, error);
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
    url.username ||
    url.password
  ) {
    throw new ProviderError('unavailable', 'Custom provider URL is not permitted.', false);
  }
  if (!loopback && (isPrivateIpv4(url.hostname) || url.hostname.endsWith('.local'))) {
    throw new ProviderError(
      'unavailable',
      'Custom provider URL cannot target a private network.',
      false,
    );
  }
  if (url.search || url.hash) {
    throw new ProviderError(
      'unavailable',
      'Custom provider URL must not include query or fragment data.',
      false,
    );
  }
  return url.toString().replace(/\/$/u, '');
}
