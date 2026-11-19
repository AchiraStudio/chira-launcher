#!/usr/bin/env node
/**
 * Machine-checkable enforcement of HARD_RULES.md. Run via `pnpm check:rules`
 * (also part of `pnpm verify` and CI). Rules that need judgement stay "review".
 *
 * Exported `checkProject(root)` returns a list of violations so the checks themselves are testable.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set([
  'node_modules',
  'target',
  'dist',
  '.git',
  'gen',
  '.chira-dev-data',
  'bindings',
]);

/** Files that legitimately talk *about* banned things. */
const SKIP_FILES = new Set([
  'HARD_RULES.md',
  'plan.md',
  'CLAUDE.md',
  'check-hard-rules.mjs',
  'check-hard-rules.test.mjs',
]);

// HR-W1, HR-W2, HR-W3, HR-W4, HR-W7, HR-W8: Win32 / OS APIs that are banned outright.
const BANNED_NATIVE = [
  [
    'HR-W1',
    /\b(WriteProcessMemory|ReadProcessMemory|CreateRemoteThread|VirtualAllocEx|SetWindowsHookEx[AW]?)\b/,
    'process injection/hooking API',
  ],
  ['HR-W2', /\bSetParent\b/, 'SetParent reparenting (apps are never embedded in the webview)'],
  [
    'HR-W3',
    /\b(HWND_TOPMOST|WS_EX_TOPMOST)\b|["']alwaysOnTop["']|always_on_top/,
    'constant topmost',
  ],
  [
    'HR-W4',
    /\b(RegSetValue\w*|RegCreateKey\w*|RegDeleteKey\w*|RegDeleteValue\w*)\b/,
    'registry write (shell/startup changes need the supervisor + approval)',
  ],
  ['HR-W4', /taskkill|["']explorer(\.exe)?["']/i, 'killing or replacing Explorer'],
  ['HR-W7', /\brunas\b|requireAdministrator|ShellExecute\w*\s*\([^)]*["']runas["']/i, 'elevation'],
];

const TODO_WITHOUT_MILESTONE = /\bTODO\b(?!\(M0\d\))/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
    } else if (!SKIP_FILES.has(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

/** Removes comments and string contents so rules match code, not prose. Line count is preserved. */
function stripRustComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

/** Like stripRustComments, and also blanks string contents (for structural rules like `unsafe`). */
function stripRust(src) {
  return stripRustComments(src).replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

function stripTs(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

export function checkProject(root) {
  const violations = [];
  const add = (rule, file, line, message) =>
    violations.push({ rule, file: relative(root, file).split(sep).join('/'), line, message });
  const rel = (file) => relative(root, file).split(sep).join('/');

  const lines = (text) => text.split('\n');
  const eachMatch = (file, text, regex, cb) =>
    lines(text).forEach((l, i) => regex.test(l) && cb(i + 1, l));

  // Mandatory files exist.
  for (const required of ['HARD_RULES.md', 'plan.md', 'CLAUDE.md']) {
    if (!existsSync(join(root, required)))
      add('HR-P1', join(root, required), 0, 'required file is missing');
  }

  for (const file of walk(root)) {
    const path = rel(file);
    const isRust = file.endsWith('.rs');
    const isTs = /\.(ts|tsx)$/.test(file);
    const raw = isRust || isTs ? readFileSync(file, 'utf8') : null;

    // HR-P8: secrets / machine-specific files must not exist in the tree.
    const base = file.split(sep).pop() ?? '';
    if (/^\.env(\..+)?$/.test(base) && base !== '.env.example')
      add('HR-P8', file, 0, 'environment file must not be committed');
    if (/\.(pem|pfx|p12|key)$/.test(base))
      add('HR-P8', file, 0, 'key/certificate material must not be committed');

    if (isRust) {
      const code = stripRust(raw);

      // HR-A2: unsafe only in platform-windows.
      if (!path.startsWith('crates/platform-windows/')) {
        eachMatch(file, code, /\bunsafe\b|allow\s*\(\s*unsafe_code/, (n) =>
          add('HR-A2', file, n, '`unsafe` is only allowed in crates/platform-windows'),
        );
      } else {
        // Every unsafe block carries a SAFETY comment on one of the three preceding lines.
        const rawLines = lines(raw);
        lines(code).forEach((l, i) => {
          if (/\bunsafe\s*(\{|extern|fn|impl)/.test(l) && !/unsafe_op_in_unsafe_fn/.test(l)) {
            const context = rawLines.slice(Math.max(0, i - 3), i + 1).join('\n');
            if (!/SAFETY(\s*\([^)]*\))?:/.test(context))
              add('HR-A2', file, i + 1, 'unsafe without a `// SAFETY:` justification');
          }
        });
      }

      // Banned names are matched against code *with* string contents, so "taskkill" is caught too.
      const codeWithStrings = stripRustComments(raw);
      for (const [rule, regex, what] of BANNED_NATIVE)
        eachMatch(file, codeWithStrings, regex, (n) => add(rule, file, n, `banned: ${what}`));

      // HR-A6: no process spawning outside the (future) process-manager crate.
      if (!path.startsWith('crates/process-manager/'))
        eachMatch(file, code, /\b(std::process::)?Command::new\b/, (n) =>
          add(
            'HR-A6',
            file,
            n,
            'process spawning belongs in crates/process-manager (typed, validated launches only)',
          ),
        );

      eachMatch(file, raw, TODO_WITHOUT_MILESTONE, (n) =>
        add('HR-P7', file, n, 'TODO must name its milestone, e.g. TODO(M01)'),
      );
    }

    if (isTs && path.startsWith('apps/')) {
      const code = stripTs(raw);
      const isTest = /\.test\.(ts|tsx)$/.test(file) || path.includes('/src/test/');
      const inServices = path.includes('/src/services/');

      // HR-A1: only services/ talks to the host.
      if (!inServices && !isTest)
        eachMatch(file, code, /@tauri-apps\/|\binvoke\s*\(|__TAURI/, (n) =>
          add('HR-A1', file, n, 'only src/services may use the Tauri API'),
        );

      // HR-S3: no dynamic code / raw HTML injection.
      eachMatch(
        file,
        code,
        /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|new\s+Function\s*\(/,
        (n) => add('HR-S3', file, n, 'dynamic code or raw HTML injection is banned'),
      );

      // HR-S3/S4: no remote URLs in shipped code (XML namespaces excepted).
      if (!isTest)
        eachMatch(file, code, /https?:\/\/(?!www\.w3\.org\/)/, (n) =>
          add('HR-S4', file, n, 'remote URL in shipped UI code (no remote content, no network)'),
        );

      // HR-Q1: no empty catch.
      eachMatch(file, code, /catch\s*(\([^)]*\))?\s*\{\s*\}/, (n) =>
        add('HR-Q1', file, n, 'empty catch swallows errors'),
      );

      eachMatch(file, raw, TODO_WITHOUT_MILESTONE, (n) =>
        add('HR-P7', file, n, 'TODO must name its milestone, e.g. TODO(M01)'),
      );
    }
  }

  // HR-A4: engine crates must not depend on tauri.
  const cratesDir = join(root, 'crates');
  if (existsSync(cratesDir)) {
    for (const name of readdirSync(cratesDir)) {
      const manifest = join(cratesDir, name, 'Cargo.toml');
      if (!existsSync(manifest) || !statSync(manifest).isFile()) continue;
      const text = readFileSync(manifest, 'utf8');
      if (/^\s*tauri[\w-]*\s*[=.]/m.test(text.replace(/^\[package\][\s\S]*?(?=^\[)/m, '')))
        add('HR-A4', manifest, 0, 'engine crates must not depend on tauri');
    }
  }

  // HR-S1 / HR-S2 / HR-Q6: Tauri configuration.
  const confPath = join(root, 'src-tauri', 'tauri.conf.json');
  if (existsSync(confPath)) {
    const conf = JSON.parse(readFileSync(confPath, 'utf8'));
    const csp = conf?.app?.security?.csp;
    if (typeof csp !== 'string' || csp.trim() === '')
      add('HR-S1', confPath, 0, 'csp must be a non-empty policy');
    else {
      if (/unsafe-eval/.test(csp)) add('HR-S1', confPath, 0, 'csp must not allow unsafe-eval');
      const remote = csp.match(/https?:\/\/(?!ipc\.localhost)[^\s;]+/g);
      if (remote)
        add(
          'HR-S1',
          confPath,
          0,
          `production csp must not allow remote origins: ${remote.join(', ')}`,
        );
    }
    if (conf.productName !== 'Chira Launcher' || conf.identifier !== 'com.chira.launcher')
      add(
        'HR-Q6',
        confPath,
        0,
        'productName/identifier must stay "Chira Launcher" / "com.chira.launcher"',
      );
    for (const w of conf?.app?.windows ?? [])
      if (w.alwaysOnTop) add('HR-W3', confPath, 0, 'window must not be alwaysOnTop');
  }

  const capsDir = join(root, 'src-tauri', 'capabilities');
  if (existsSync(capsDir)) {
    for (const name of readdirSync(capsDir).filter((f) => f.endsWith('.json'))) {
      const file = join(capsDir, name);
      const cap = JSON.parse(readFileSync(file, 'utf8'));
      for (const perm of cap.permissions ?? []) {
        const id = typeof perm === 'string' ? perm : perm.identifier;
        if (
          /^(shell|fs|http|process|dialog|opener|os|updater|global-shortcut):/.test(id) ||
          /\*/.test(id)
        )
          add(
            'HR-S2',
            file,
            0,
            `capability \`${id}\` needs an owner-approved change to HARD_RULES.md`,
          );
      }
    }
  }

  return violations;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const violations = checkProject(root);
  if (violations.length === 0) {
    console.log('✔ hard rules: no violations');
    return;
  }
  console.error(`✖ hard rules: ${violations.length} violation(s)\n`);
  for (const v of violations)
    console.error(`  [${v.rule}] ${v.file}${v.line ? `:${v.line}` : ''}  ${v.message}`);
  console.error(
    '\nSee HARD_RULES.md. If a rule genuinely must change, change the rule explicitly — never bypass the check.',
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
