import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { URL } from 'node:url';

const root = resolve('tests/fixtures');
const contentTypes = { '.html': 'text/html; charset=utf-8' };

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/fixture.html', 'http://127.0.0.1').pathname;
  if (pathname === '/redirect-copy') {
    response.writeHead(302, { location: '/fixture.html' });
    response.end();
    return;
  }
  const requestedPath = pathname === '/' ? '/fixture.html' : pathname;
  const filePath = resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'text/plain' });
  createReadStream(filePath).pipe(response);
});

server.listen(4173, '127.0.0.1', () => {
  console.log('fixture server listening on http://127.0.0.1:4173');
});
