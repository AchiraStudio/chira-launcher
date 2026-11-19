#!/usr/bin/env node
/**
 * Release gate and changelog extraction, used by .github/workflows/release.yml.
 *
 *   node scripts/release-notes.mjs v0.2.0 release-notes.md      # for a pushed tag
 *   node scripts/release-notes.mjs --current release-notes.md   # for the version in the repo
 *
 * Fails (exit 1) unless:
 *  - the tag looks like vMAJOR.MINOR.PATCH[-prerelease],
 *  - it matches the version in Cargo.toml and both package.json files, and
 *  - CHANGELOG.md has a non-empty `## [version]` section for it.
 * On success writes the release notes (that section plus an install footer) to the output file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

/** `version = "x"` inside the `[workspace.package]` table of the root Cargo.toml. */
export function cargoVersion(cargoToml) {
  const table = cargoToml.match(/^\[workspace\.package\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1];
  return table?.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null;
}

/** Body of the `## [version]` section, without its heading, or `null` if absent/empty. */
export function extractNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && /^## \[/.test(l));
  if (end === -1) end = lines.findIndex((l, i) => i > start && /^\[[^\]]+\]:\s/.test(l)); // link refs
  if (end === -1) end = lines.length;
  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
  return /\S/.test(body.replace(/^###.*$/gm, '')) ? body : null;
}

export function checkRelease(root, tagOrCurrent) {
  const problems = [];
  const read = (p) => readFileSync(join(root, p), 'utf8');
  const versions = {
    'Cargo.toml': cargoVersion(read('Cargo.toml')),
    'package.json': JSON.parse(read('package.json')).version,
    'apps/shell-ui/package.json': JSON.parse(read('apps/shell-ui/package.json')).version,
  };

  let version;
  if (tagOrCurrent === '--current') {
    version = versions['Cargo.toml'];
  } else {
    const match = TAG.exec(tagOrCurrent ?? '');
    if (!match) problems.push(`tag "${tagOrCurrent}" must look like v1.2.3 or v1.2.3-beta.1`);
    version = match?.[1] ?? null;
  }

  if (version) {
    for (const [file, found] of Object.entries(versions)) {
      if (found !== version)
        problems.push(`${file} has version ${found ?? 'none'}, expected ${version}`);
    }
  }

  let notes = null;
  if (version) {
    notes = extractNotes(read('CHANGELOG.md'), version);
    if (!notes) problems.push(`CHANGELOG.md has no non-empty "## [${version}]" section`);
  }
  return { version, notes, problems };
}

export function renderNotes(version, notes) {
  return `${notes}

---

**Install:** download \`Chira-Launcher_${version}_x64-setup.exe\` and run it (per-user install, no administrator
rights needed). Windows 11 recommended.

**Verify:** compare the file's SHA-256 with \`SHA256SUMS.txt\`
(\`Get-FileHash .\\Chira-Launcher_${version}_x64-setup.exe\`).

> The installer is not code-signed yet, so Windows SmartScreen may show a warning ("More info" → "Run anyway").
`;
}

function main() {
  const [arg, out] = process.argv.slice(2);
  if (!arg || !out) {
    console.error('usage: release-notes.mjs <vX.Y.Z | --current> <output-file>');
    process.exit(2);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { version, notes, problems } = checkRelease(root, arg);
  if (problems.length > 0) {
    console.error(`✖ release check failed:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  writeFileSync(out, renderNotes(version, notes));
  console.log(`✔ release ${version}: notes written to ${out}`);
  // For the workflow: expose the version to later steps.
  console.log(`version=${version}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
