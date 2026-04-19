// Runs Tailwind v4 JIT over the collected class tokens and returns the
// generated CSS.  We invoke the `@tailwindcss/cli` binary with:
//   - a synthesized input file containing every class once (so JIT picks them up)
//   - an ephemeral entry CSS that just imports tailwindcss
// Tailwind v4 has no tailwind.config.js; content discovery happens via
// `@source` directives in the entry CSS.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

export function compileTailwind({ classTokens, cwd }) {
  // The temp directory MUST live inside the project so Tailwind can resolve
  // `@import "tailwindcss"` via node_modules lookup (relative to the entry
  // file's location).  Putting it in OS tmpdir breaks resolution.
  const baseDir = join(cwd, 'node_modules', '.cache', 'iwo-figma-tw');
  mkdirSync(baseDir, { recursive: true });
  const dir = mkdtempSync(join(baseDir, 'run-'));
  try {
    // Each token on its own line — Tailwind's heuristic extractor handles
    // bracket-arbitrary values fine when tokens appear as whole words.
    const contentPath = join(dir, 'content.html');
    writeFileSync(
      contentPath,
      classTokens.map((t) => `<div class="${t.replace(/"/g, '&quot;')}"></div>`).join('\n'),
      'utf8',
    );

    const entryPath = join(dir, 'entry.css');
    writeFileSync(
      entryPath,
      `@import "tailwindcss";\n@source "${contentPath.replace(/\\/g, '/')}";\n`,
      'utf8',
    );

    const outPath = join(dir, 'out.css');

    // Use the locally installed @tailwindcss/cli binary.
    const bin = join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss');

    // On Windows, `.cmd` wrappers require a shell to execute. `shell: true`
    // is safe here: bin/entryPath/outPath are all internally-constructed paths
    // (OS tmpdir + local node_modules) containing no user input.
    execFileSync(bin, ['-i', entryPath, '-o', outPath, '--minify'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    return readFileSync(outPath, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
