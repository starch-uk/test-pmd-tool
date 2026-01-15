import { build } from 'esbuild';

build({
	entryPoints: ['src/cli/main.ts'],
	bundle: true,
	platform: 'node',
	outfile: 'dist/test-pmd-rule.js',
	external: ['@xmldom/xmldom', 'tmp', 'stringify-tree'],
	banner: { js: '#!/usr/bin/env node' },
	format: 'esm',
	target: 'node25',
	sourcemap: true,
	minify: false,
}).catch(() => process.exit(1));
