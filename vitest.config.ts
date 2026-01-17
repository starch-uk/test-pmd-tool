import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: false,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		sequence: {
			concurrent: true,
		},
		// Ensure mocks are always fresh for every test
		// clearMocks: vi.clearAllMocks() before each test (clears call history, keeps implementations)
		clearMocks: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json'],
			exclude: [
				'**/__mocks__/**',
				'**/*.mock.ts',
				'tests/**/helpers/**',
			],
			thresholds: {
				lines: 100,
				functions: 100,
				branches: 100,
				statements: 100,
			},
		},
	},
});
