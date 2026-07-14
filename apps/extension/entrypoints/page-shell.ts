import { browser } from 'wxt/browser';
import { CONTRACT_VERSION } from '@translation/shared-types';
import { contentRequestSchema } from '@translation/shared-validation';

export default defineUnlistedScript(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const parsed = contentRequestSchema.safeParse(message);
    if (!parsed.success) {
      return Promise.resolve({
        version: CONTRACT_VERSION,
        requestId: 'req_content_invalid',
        type: 'MESSAGE_ERROR',
        payload: {
          code: 'INVALID_MESSAGE',
          message: 'The content-script message was invalid.',
          retryable: false,
        },
      });
    }

    return Promise.resolve({
      version: CONTRACT_VERSION,
      requestId: parsed.data.requestId,
      type: 'CONTENT_PONG',
      payload: {
        ready: true,
        extensionVersion: browser.runtime.getManifest().version,
      },
    });
  });
});
