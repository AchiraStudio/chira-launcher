#!/usr/bin/env node
/**
 * Guards HR-A8: the generated TypeScript bindings must match the Rust protocol types.
 * Regenerates them (ts-rs runs as part of `cargo test -p desktop-protocol`) and fails if any file
 * changed, appeared or disappeared. Independent of Git state, so it works on a dirty tree.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'apps', 'shell-ui', 'src', 'services', 'bindings');

function snapshot() {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    out.set(
      name,
      createHash('sha256')
        .update(readFileSync(join(dir, name)))
        .digest('hex'),
    );
  }
  return out;
}

const before = snapshot();
const run = spawnSync('cargo', ['test', '-p', 'desktop-protocol', '--quiet'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (run.status !== 0) {
  console.error('✖ bindings: cargo test -p desktop-protocol failed');
  process.exit(run.status ?? 1);
}
const after = snapshot();

const problems = [];
for (const [name, hash] of after) {
  if (!before.has(name)) problems.push(`new: ${name}`);
  else if (before.get(name) !== hash) problems.push(`changed: ${name}`);
}
for (const name of before.keys()) if (!after.has(name)) problems.push(`removed: ${name}`);

if (problems.length > 0) {
  console.error(
    '✖ bindings were out of date and have been regenerated:\n  ' + problems.join('\n  '),
  );
  console.error(
    '\nReview and commit the regenerated files (HR-A8: bump PROTOCOL_VERSION for breaking changes).',
  );
  process.exit(1);
}
console.log(`✔ bindings: ${after.size} generated files match the Rust protocol`);
