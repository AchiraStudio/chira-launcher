import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { cargoVersion, checkRelease, extractNotes, renderNotes } from './release-notes.mjs';

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- Nothing yet.

## [0.2.0] - 2026-12-01

### Added

- Window lab.

### Fixed

- A bug.

## [0.1.0] - 2026-11-19

### Added

- First build.

[Unreleased]: https://example.test/compare
[0.1.0]: https://example.test/tag
`;

function project({ cargo = '0.2.0', root = '0.2.0', ui = '0.2.0', changelog = CHANGELOG } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'chira-release-'));
  const files = {
    'Cargo.toml': `[workspace]\nmembers = []\n\n[workspace.package]\nversion = "${cargo}"\nedition = "2024"\n\n[workspace.dependencies]\nfoo = { version = "9.9.9" }\n`,
    'package.json': JSON.stringify({ version: root }),
    'apps/shell-ui/package.json': JSON.stringify({ version: ui }),
    'CHANGELOG.md': changelog,
  };
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  return dir;
}

test('reads the workspace version, not a dependency version', () => {
  assert.equal(cargoVersion(readCargo()), '0.2.0');
  function readCargo() {
    return `[workspace.package]\nversion = "0.2.0"\n\n[workspace.dependencies]\nx = { version = "1.0.0" }\nversion = "7.7.7"\n`;
  }
});

test('extracts exactly the requested section', () => {
  const notes = extractNotes(CHANGELOG, '0.2.0');
  assert.match(notes, /Window lab\./);
  assert.match(notes, /### Fixed/);
  assert.doesNotMatch(notes, /First build/);
  assert.doesNotMatch(notes, /example\.test/);
  const last = extractNotes(CHANGELOG, '0.1.0');
  assert.match(last, /First build\./);
  assert.doesNotMatch(
    last,
    /example\.test/,
    'link reference definitions are not part of the notes',
  );
});

test('a missing or empty section yields no notes', () => {
  assert.equal(extractNotes(CHANGELOG, '9.9.9'), null);
  assert.equal(extractNotes('## [1.0.0] - x\n\n### Added\n\n## [0.9.0]\n- y\n', '1.0.0'), null);
});

test('a consistent release passes', () => {
  const { version, notes, problems } = checkRelease(project(), 'v0.2.0');
  assert.deepEqual(problems, []);
  assert.equal(version, '0.2.0');
  assert.match(notes, /Window lab/);
});

test('--current uses the repository version', () => {
  assert.equal(checkRelease(project(), '--current').version, '0.2.0');
});

test('malformed tags are rejected', () => {
  for (const tag of ['0.2.0', 'v0.2', 'v1.2.3.4', 'release-1', '', undefined]) {
    assert.ok(checkRelease(project(), tag).problems.length > 0, String(tag));
  }
  assert.deepEqual(
    checkRelease(
      project({
        cargo: '0.3.0-beta.1',
        root: '0.3.0-beta.1',
        ui: '0.3.0-beta.1',
        changelog: '## [0.3.0-beta.1] - x\n\n- y\n',
      }),
      'v0.3.0-beta.1',
    ).problems,
    [],
  );
});

test('version mismatches in any manifest are reported', () => {
  const { problems } = checkRelease(project({ cargo: '0.1.9', ui: '0.0.1' }), 'v0.2.0');
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /Cargo\.toml has version 0\.1\.9/);
  assert.match(problems.join('\n'), /shell-ui\/package\.json has version 0\.0\.1/);
});

test('a tag without a changelog entry is rejected', () => {
  const { problems } = checkRelease(
    project({ cargo: '0.5.0', root: '0.5.0', ui: '0.5.0' }),
    'v0.5.0',
  );
  assert.match(problems.join('\n'), /no non-empty "## \[0\.5\.0\]" section/);
});

test('rendered notes carry the install footer with the real file name', () => {
  const text = renderNotes('0.2.0', '### Added\n\n- x');
  assert.match(text, /Chira-Launcher_0\.2\.0_x64-setup\.exe/);
  assert.match(text, /SHA256SUMS\.txt/);
  assert.match(text, /not code-signed/);
});

test('the real repository is releasable at its current version', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { problems, version } = checkRelease(root, '--current');
  assert.deepEqual(problems, [], `repo at ${version} is not releasable`);
});
