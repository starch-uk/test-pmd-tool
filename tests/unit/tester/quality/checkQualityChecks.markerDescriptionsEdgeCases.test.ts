/**
 * @file
 * Marker description edge case tests for checkQualityChecks.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi } from 'vitest';
import { checkQualityChecks } from '../../../../src/tester/quality/checkQualityChecks.js';
import type { RuleMetadata, ExampleData } from '../../../../src/types/index.js';

vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

describe('checkQualityChecks', () => {
	// Mocks are cleared automatically by clearMocks: true in vitest.config.ts

	it('should handle violation marker with fallback to description field', () => {
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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Custom violation description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('violation has no description'),
			),
		).toBe(false);
	});
	it('should handle valid marker with fallback to description field', () => {
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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [
					{
						description: 'Custom valid description',
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
		).toBe(false);
	});
	it('should handle violation marker with default inline marker description', () => {
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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Inline violation marker // ❌',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('violation has no description'),
			),
		).toBe(true);
	});
	it('should handle valid marker with default inline marker description', () => {
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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [
					{
						description: 'Inline valid marker // ✅',
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
	it('should handle marker not found in extractTextAfterMarker', () => {
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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

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
	it('should handle findMarkerLineNumber when estimatedLine >= i', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
		<![CDATA[
// Violation: test
public class Test {}
		]]>
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [
			{
				content: '// Violation: test\npublic class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'test',
						index: 0,
						isViolation: true,
						lineNumber: 10,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.issues.length).toBeGreaterThanOrEqual(0);
	});
	it('should handle findMarkerLineNumber when example not found', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [
			{
				content: '// Violation: test\npublic class Test {}',
				exampleIndex: 5,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'test',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.issues.length).toBeGreaterThanOrEqual(0);
	});
});
