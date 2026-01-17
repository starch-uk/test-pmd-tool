/**
 * @file
 * Marker description validation tests for checkQualityChecks.
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

	it('should fail when violation marker has no description', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
		<![CDATA[
// Violation:
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
				content: '// Violation:\npublic class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: '',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('violation has no description'),
			),
		).toBe(true);
	});
	it('should fail when valid marker has no description', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
		<![CDATA[
// Valid:
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
				content: '// Valid:\npublic class Test {}',
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

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('valid has no description'),
			),
		).toBe(true);
	});
	it('should fall back to Example output when marker line number cannot be resolved', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example></example>
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
				content: 'public class Test {}\n// Violation:',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: '',
						index: 0,
						isViolation: true,
						lineNumber: 2,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) => issue.startsWith('Example 1:')),
		).toBe(true);
	});
	it('should fail when duplicate marker descriptions are found', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
		<![CDATA[
// Violation: duplicate description
public class Test1 {}
		]]>
	</example>
	<example>
		<![CDATA[
// Violation: duplicate description
public class Test2 {}
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
				content:
					'// Violation: duplicate description\npublic class Test1 {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'duplicate description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test1 {}'],
			},
			{
				content:
					'// Violation: duplicate description\npublic class Test2 {}',
				exampleIndex: 2,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'duplicate description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test2 {}'],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('duplicate description'),
			),
		).toBe(true);
	});
	it('should fail when no violation markers exist', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
		<![CDATA[
// Valid: valid code
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
				content: '// Valid: valid code\npublic class Test {}',
				exampleIndex: 1,
				validMarkers: [
					{
						description: 'valid code',
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

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('at least one violation marker'),
			),
		).toBe(true);
	});
	it('should handle inline violation markers with // ❌', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
		<![CDATA[
public class Test {
	private String field; // ❌ inline violation
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
				content:
					'public class Test {\n\tprivate String field; // ❌ inline violation\n}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'inline violation',
						index: 0,
						isViolation: true,
						lineNumber: 2,
					},
				],
				violations: ['private String field;'],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('violation has no description'),
			),
		).toBe(false);
	});
	it('should handle inline valid markers with // ✅', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>
		<![CDATA[
public class Test {
	private String field; // ✅ inline valid
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
				content:
					'public class Test {\n\tprivate String field; // ✅ inline valid\n}',
				exampleIndex: 1,
				validMarkers: [
					{
						description: 'inline valid',
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
		).toBe(false);
	});
});
