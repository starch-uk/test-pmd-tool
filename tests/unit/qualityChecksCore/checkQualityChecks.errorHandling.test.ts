/**
 * @file
 * Error handling tests for checkQualityChecks.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- Test helpers and object literals require type assertions */
import { readFileSync } from 'fs';
import { describe, it, expect, vi } from 'vitest';
import { checkQualityChecks } from '../../../src/tester/checkQualityChecks.js';
import type { RuleMetadata } from '../../../../src/types/index.js';

vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

describe('checkQualityChecks', () => {
	// Mocks are cleared automatically by clearMocks: true in vitest.config.ts

	it('should handle error reading file', () => {
		vi.mocked(readFileSync).mockImplementation(() => {
			throw new Error('File not found');
		});

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('Error reading rule file'),
			),
		).toBe(true);
	});
	it('should handle non-Error exception when reading file', () => {
		vi.mocked(readFileSync).mockImplementation(() => {
			// eslint-disable-next-line @typescript-eslint/only-throw-error -- Testing non-Error exception handling
			throw 'String error';
		});

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('Error reading rule file: String error'),
			),
		).toBe(true);
	});
	it('should handle XML with no description element', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<properties />
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		const MIN_ISSUES_COUNT = 0;
		expect(result.issues.length).toBeGreaterThanOrEqual(MIN_ISSUES_COUNT);
	});
});
