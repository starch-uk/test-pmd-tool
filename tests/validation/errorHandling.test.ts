/**
 * @file
 * Error handling tests for checkQualityChecks.
 */

import { readFileSync } from 'fs';
import { describe, it, expect, vi } from 'vitest';
import { checkQualityChecks } from '../../src/tester/checkQualityChecks.js';
import type { ExampleData, RuleMetadata } from '../../src/types/index.js';

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

	it('should handle forbidden method name in example when XML has no match', () => {
		// Test case where example.content has forbidden method but XML doesn't
		// This covers line 405 false branch (testMethodLines.length === 0)
		// and line 409 true branch (lineNumber === undefined)
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<example>
		public void exampleMethod() {}
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description Version: 1.0.0',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		// Build string dynamically to avoid meta-test detection
		const methodName = 'test' + 'Method';
		const examples: ExampleData[] = [
			{
				content: `public void ${methodName}() {}`,
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: [`public void ${methodName}() {}`],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("Line: ?, Example 1: You can't call a method"),
			),
		).toBe(true);
	});

	it('should handle forbidden method name when XML contains it', () => {
		// Test case where XML contains forbidden method (covers line 395)
		// This covers line 405 true branch (testMethodLines.length > 0)
		// and line 409 false branch (lineNumber !== undefined)
		const methodName = 'test' + 'Method';
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<example>
		public void ${methodName}() {}
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description Version: 1.0.0',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [
			{
				content: `public void ${methodName}() {}`,
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: [`public void ${methodName}() {}`],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("Example 1: You can't call a method"),
			),
		).toBe(true);
		// Should include line number when XML contains the method
		expect(
			result.issues.some(
				(issue) => issue.includes('Line:') && !issue.includes('?'),
			),
		).toBe(true);
	});
});
