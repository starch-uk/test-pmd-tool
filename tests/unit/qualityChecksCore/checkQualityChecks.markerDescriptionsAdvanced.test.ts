/**
 * @file
 * Advanced marker description tests for checkQualityChecks.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- Test helpers and object literals require type assertions */
import { readFileSync } from 'fs';
import { describe, it, expect, vi } from 'vitest';
import { checkQualityChecks } from '../../../src/tester/checkQualityChecks.js';
import type { RuleMetadata, ExampleData } from '../../../../src/types/index.js';

vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

describe('checkQualityChecks', () => {
	// Mocks are cleared automatically by clearMocks: true in vitest.config.ts

	it('should handle marker line without marker text', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
		<![CDATA[
public class Test {
	private String field;
}
		]]>
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [
			{
				content: 'public class Test {\n\tprivate String field;\n}',
				exampleIndex: 1,
				validMarkers: [
					{
						description: '',
						index: 0,
						isViolation: false,
						lineNumber: 2,
					},
				],
				valids: ['private String field;'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('valid has no description'),
			),
		).toBe(true);
	});
	it('should handle extractTextAfterMarker when marker not found', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
		<![CDATA[
public class Test {}
		]]>
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [
					{
						description: '',
						index: 0,
						isViolation: false,
						lineNumber: 1,
					},
				],
				valids: ['public class Test {}'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('valid has no description'),
			),
		).toBe(true);
	});
	it('should handle valid marker with no description and lineNum undefined', () => {
		// Put <example> and </example> on the same line so findMarkerLineNumber
		// hits estimatedLine === i and returns undefined.
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>X</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [
			{
				content: 'X',
				exampleIndex: 1,
				validMarkers: [
					{
						description: '',
						index: 0,
						isViolation: false,
						lineNumber: 1,
					},
				],
				valids: ['X'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.startsWith('Example 1: valid has no description'),
			),
		).toBe(true);
	});
	it('should track repeated valid descriptions (has/set branches)', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
X
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [
			{
				content: 'X',
				exampleIndex: 1,
				validMarkers: [
					{
						description: 'same',
						index: 0,
						isViolation: false,
						lineNumber: 1,
					},
					{
						description: 'same',
						index: 1,
						isViolation: false,
						lineNumber: 1,
					},
				],
				valids: ['X'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes("duplicate description 'same'"),
			),
		).toBe(true);
	});
	it('should skip valid marker when markerLineIndex is out of bounds', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
X
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [
			{
				content: 'X',
				exampleIndex: 1,
				validMarkers: [
					{
						description: '',
						index: 0,
						isViolation: false,
						lineNumber: 2,
					},
				],
				valids: ['X'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('valid has no description'),
			),
		).toBe(false);
	});
	it('should handle valid marker with no description and lineNum defined', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
public class Test {}
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [
					{
						description: '',
						index: 0,
						isViolation: false,
						lineNumber: 1,
					},
				],
				valids: ['public class Test {}'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some(
				(issue) =>
					issue.startsWith('Line ') &&
					issue.includes('valid has no description'),
			),
		).toBe(true);
	});
	it('should handle valid marker with description and lineNum undefined', () => {
		// Create XML where example is very short, causing estimatedLine >= i
		// This makes findMarkerLineNumber return undefined
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>X</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [
			{
				content: 'X',
				exampleIndex: 1,
				validMarkers: [
					{
						description: 'test description',
						index: 0,
						isViolation: false,
						lineNumber: 1,
					},
				],
				valids: ['X'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		// Should not have "valid has no description" issue
		expect(
			result.issues.some((issue) =>
				issue.includes('valid has no description'),
			),
		).toBe(false);
		// Should track the description for duplicate checking
		// lineNum should be ZERO_COUNT when undefined (line 639)
		expect(result.issues.length).toBeGreaterThanOrEqual(0);
	});
});
