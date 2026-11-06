/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Every file under a directory, as forward-slash paths relative to it. */
function walk(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, root) : [relative(root, full).replaceAll(sep, '/')];
  });
}

/**
 * Writes dist/sw.js from sw/sw.js, filling in the list of built files to precache and a version
 * derived from their contents, so each deploy gets a fresh cache and old ones are removed.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'solo-jam-room-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = walk(outDir).filter((f) => f !== 'sw.js');
      const hash = createHash('sha256');
      for (const f of files.sort()) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 10);
      const template = readFileSync('sw/sw.js', 'utf8');
      const precache = ['./', ...files];
      const output = template
        .replaceAll('__VERSION__', version)
        .replaceAll('__PRECACHE__', JSON.stringify(precache));
      if (/__[A-Z]+__/.test(output)) throw new Error('sw.js still has an unfilled placeholder');
      writeFileSync(join(outDir, 'sw.js'), output);
    },
  };
}

export default defineConfig({
  base: '/solo-jam-room/',
  plugins: [react(), serviceWorker()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['src/theory/**', 'src/random/**'] },
  },
});
