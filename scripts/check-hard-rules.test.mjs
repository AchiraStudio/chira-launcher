import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { checkProject } from './check-hard-rules.mjs';

/** Builds a minimal clean project, applies `files`, and returns the rule IDs that fired. */
function violationsFor(files) {
  const root = mkdtempSync(join(tmpdir(), 'chira-rules-'));
  const base = {
    'HARD_RULES.md': '# rules',
    'plan.md': '# plan',
    'CLAUDE.md': '# claude',
    'src-tauri/tauri.conf.json': JSON.stringify({
      productName: 'Chira Launcher',
      identifier: 'com.chira.launcher',
      app: {
        security: { csp: "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost" },
        windows: [{}],
      },
    }),
    'src-tauri/capabilities/default.json': JSON.stringify({
      permissions: ['core:event:allow-listen'],
    }),
  };
  for (const [path, content] of Object.entries({ ...base, ...files })) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return checkProject(root).map((v) => v.rule);
}

test('a clean project passes', () => {
  assert.deepEqual(violationsFor({}), []);
});

test('the real repository passes its own rules', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  assert.deepEqual(checkProject(root), []);
});

test('HR-A2: unsafe outside platform-windows is rejected; documented unsafe inside is allowed', () => {
  assert.deepEqual(violationsFor({ 'crates/foo/src/lib.rs': 'fn f() { unsafe { x() } }' }), [
    'HR-A2',
  ]);
  assert.deepEqual(
    violationsFor({
      'crates/platform-windows/src/lib.rs': '// SAFETY: ok\nfn f() { unsafe { x() } }',
    }),
    [],
  );
  assert.deepEqual(
    violationsFor({ 'crates/platform-windows/src/lib.rs': 'fn f() { unsafe { x() } }' }),
    ['HR-A2'],
  );
});

test('HR-W1/W2/W3/W4/W7: banned Win32 APIs are rejected, but prose mentioning them is not', () => {
  for (const [code, rule] of [
    ['WriteProcessMemory(h, p);', 'HR-W1'],
    ['SetWindowsHookExW(a, b);', 'HR-W1'],
    ['SetParent(child, parent);', 'HR-W2'],
    ['let f = WS_EX_TOPMOST;', 'HR-W3'],
    ['RegSetValueExW(k);', 'HR-W4'],
    ['let c = "taskkill";', 'HR-W4'],
  ]) {
    assert.deepEqual(violationsFor({ 'crates/x/src/lib.rs': `fn f() { ${code} }` }), [rule], code);
  }
  assert.deepEqual(
    violationsFor({ 'crates/x/src/lib.rs': '// we never call SetParent here\nfn f() {}' }),
    [],
  );
});

test('HR-A6: process spawning outside process-manager is rejected', () => {
  assert.deepEqual(violationsFor({ 'crates/x/src/lib.rs': 'fn f() { Command::new("a"); }' }), [
    'HR-A6',
  ]);
  assert.deepEqual(
    violationsFor({ 'crates/process-manager/src/lib.rs': 'fn f() { Command::new("a"); }' }),
    [],
  );
});

test('HR-P7: a TODO must name its milestone', () => {
  assert.deepEqual(violationsFor({ 'crates/x/src/lib.rs': '// TODO fix later\n' }), ['HR-P7']);
  assert.deepEqual(violationsFor({ 'crates/x/src/lib.rs': '// TODO(M01): window lab\n' }), []);
});

test('HR-A4: engine crates may not depend on tauri', () => {
  assert.deepEqual(
    violationsFor({ 'crates/x/Cargo.toml': '[package]\nname="x"\n[dependencies]\ntauri = "2"\n' }),
    ['HR-A4'],
  );
  assert.deepEqual(
    violationsFor({ 'crates/x/Cargo.toml': '[package]\nname="x"\n[dependencies]\nserde = "1"\n' }),
    [],
  );
});

test('HR-A1/S3/S4/Q1: frontend rules', () => {
  const ui = (name, code) => ({ [`apps/shell-ui/src/${name}`]: code });
  assert.deepEqual(
    violationsFor(ui('features/a.ts', "import { invoke } from '@tauri-apps/api/core';")),
    ['HR-A1'],
  );
  assert.deepEqual(
    violationsFor(ui('services/a.ts', "import { invoke } from '@tauri-apps/api/core';")),
    [],
  );
  assert.deepEqual(
    violationsFor(ui('a.tsx', 'const x = <div dangerouslySetInnerHTML={{__html: s}} />;')),
    ['HR-S3'],
  );
  assert.deepEqual(violationsFor(ui('a.ts', "fetch('https://cdn.example.com/x.js');")), ['HR-S4']);
  assert.deepEqual(violationsFor(ui('a.ts', 'try { f(); } catch (e) {}')), ['HR-Q1']);
  assert.deepEqual(violationsFor(ui('a.ts', "const ns = 'http://www.w3.org/2000/svg';")), []);
});

test('HR-S1/S2/Q6/W3: Tauri configuration', () => {
  const conf = (patch) =>
    JSON.stringify({
      productName: 'Chira Launcher',
      identifier: 'com.chira.launcher',
      app: { windows: [{}], security: { csp: "default-src 'self'" }, ...patch },
    });
  assert.deepEqual(
    violationsFor({ 'src-tauri/tauri.conf.json': conf({ security: { csp: null } }) }),
    ['HR-S1'],
  );
  assert.deepEqual(
    violationsFor({
      'src-tauri/tauri.conf.json': conf({ security: { csp: "script-src 'unsafe-eval'" } }),
    }),
    ['HR-S1'],
  );
  assert.deepEqual(
    violationsFor({
      'src-tauri/tauri.conf.json': conf({ security: { csp: 'img-src https://evil.example' } }),
    }),
    ['HR-S1'],
  );
  assert.deepEqual(
    violationsFor({ 'src-tauri/tauri.conf.json': conf({ windows: [{ alwaysOnTop: true }] }) }),
    ['HR-W3'],
  );
  assert.deepEqual(
    violationsFor({
      'src-tauri/tauri.conf.json': JSON.stringify({
        productName: 'Other',
        identifier: 'x.y',
        app: { security: { csp: "default-src 'self'" } },
      }),
    }),
    ['HR-Q6'],
  );
  assert.deepEqual(
    violationsFor({
      'src-tauri/capabilities/default.json': JSON.stringify({
        permissions: ['shell:allow-execute'],
      }),
    }),
    ['HR-S2'],
  );
  assert.deepEqual(
    violationsFor({
      'src-tauri/capabilities/default.json': JSON.stringify({ permissions: ['fs:default'] }),
    }),
    ['HR-S2'],
  );
});

test('HR-P8: env files and key material are rejected', () => {
  assert.deepEqual(violationsFor({ '.env': 'SECRET=1' }), ['HR-P8']);
  assert.deepEqual(violationsFor({ 'signing/cert.pfx': 'x' }), ['HR-P8']);
  assert.deepEqual(violationsFor({ '.env.example': 'SECRET=' }), []);
});

test('HR-S6: workflow hygiene', () => {
  const wf = (name, body) => ({ [`.github/workflows/${name}`]: body });
  const ok =
    'permissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: dtolnay/rust-toolchain@stable\n';
  const write = ok.replace('contents: read', 'contents: write');
  assert.deepEqual(violationsFor(wf('ci.yml', ok)), []);
  assert.deepEqual(
    violationsFor(wf('ci.yml', 'jobs: {}\n')),
    ['HR-S6'],
    'permissions are required',
  );
  assert.deepEqual(violationsFor(wf('ci.yml', ok + 'on:\n  pull_request_target:\n')), ['HR-S6']);
  assert.deepEqual(violationsFor(wf('ci.yml', write)), ['HR-S6'], 'write only in release.yml');
  assert.deepEqual(violationsFor(wf('release.yml', write)), []);
  assert.deepEqual(
    violationsFor(wf('ci.yml', ok + '      - uses: softprops/action-gh-release@v2\n')),
    ['HR-S6'],
    'unlisted third-party action',
  );
});
