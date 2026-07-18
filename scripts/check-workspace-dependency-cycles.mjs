import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const manifestPaths = [
  ...globSync('apps/*/package.json', { cwd: repositoryRoot }),
  ...globSync('packages/*/package.json', { cwd: repositoryRoot }),
].sort();
const packages = new Map();

for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, manifestPath), 'utf8'));
  if (!manifest.name) throw new Error(`${manifestPath} has no package name.`);
  if (packages.has(manifest.name)) throw new Error(`Duplicate workspace package: ${manifest.name}`);
  packages.set(manifest.name, { manifestPath, manifest });
}

const graph = new Map();
for (const [name, { manifest }] of packages) {
  const declared = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
  };
  graph.set(
    name,
    Object.keys(declared).filter((dependency) => packages.has(dependency)),
  );
}

const visited = new Set();
const active = new Set();
const path = [];
const cycles = [];

function visit(name) {
  if (active.has(name)) {
    const cycleStart = path.indexOf(name);
    cycles.push([...path.slice(cycleStart), name]);
    return;
  }
  if (visited.has(name)) return;

  visited.add(name);
  active.add(name);
  path.push(name);
  for (const dependency of graph.get(name) ?? []) visit(dependency);
  path.pop();
  active.delete(name);
}

for (const name of graph.keys()) visit(name);

if (cycles.length > 0) {
  console.error('Workspace dependency cycles:');
  for (const cycle of cycles) console.error(`- ${cycle.join(' -> ')}`);
  process.exitCode = 1;
} else {
  console.log(`No dependency cycles across ${packages.size} workspace packages.`);
}
