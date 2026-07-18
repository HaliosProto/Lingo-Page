import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { globSync } from 'node:fs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const markdownFiles = globSync('**/*.md', {
  cwd: repositoryRoot,
  exclude: ['node_modules/**', '.git/**', 'artifacts/**', '.local/**'],
});
const failures = [];

const inlineLinkPattern = /!?\[[^\]]*\]\((?<target><[^>]+>|[^\s)]+)(?:\s+['"][^'"]*['"])?\)/gu;
const referenceLinkPattern = /^\[[^\]]+\]:\s*(?<target><[^>]+>|\S+)/gmu;

for (const file of markdownFiles) {
  const absoluteFile = resolve(repositoryRoot, file);
  const source = readFileSync(absoluteFile, 'utf8');
  for (const pattern of [inlineLinkPattern, referenceLinkPattern]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const rawTarget = match.groups?.target?.replace(/^<|>$/gu, '');
      if (!rawTarget || /^(?:https?:|mailto:|tel:|#)/iu.test(rawTarget)) continue;

      const pathOnly = decodeURIComponent(rawTarget.split(/[?#]/u, 1)[0] ?? '');
      if (!pathOnly) continue;
      const target = pathOnly.startsWith('/')
        ? resolve(repositoryRoot, `.${pathOnly}`)
        : resolve(dirname(absoluteFile), pathOnly);
      if (!existsSync(target)) {
        const line = source.slice(0, match.index).split(/\r?\n/u).length;
        failures.push(`${file}:${line} -> ${rawTarget}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Broken local Markdown links:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Validated local Markdown links in ${markdownFiles.length} files.`);
}

console.log(`Repository: ${relative(process.cwd(), repositoryRoot) || '.'}`);
