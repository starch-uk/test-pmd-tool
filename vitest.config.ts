import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: false,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		sequence: {
			concurrent: true,
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json'],
			thresholds: {
				lines: 100,
				functions: 100,
				branches: 100,
				statements: 100,
			},
		},
	},
});
