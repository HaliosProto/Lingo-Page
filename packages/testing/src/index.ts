export function createTestRequestId(suffix = 'fixture'): string {
  return `req_test_${suffix}`;
}

export function createJsonRequest(path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
