/**
 * @file
 * Integration tests for checkQualityChecks (happy path).
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkQualityChecks } from '../../../../src/tester/quality/checkQualityChecks.js';
import type { RuleMetadata, ExampleData } from '../../../../src/types/index.js';

vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

describe('checkQualityChecks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should pass when all quality checks pass', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Short message">
	<description>
		This is a test rule description.
		$var1: test variable
		Version: 1.0.0
	</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
let $var1 := 'value1'
return //Method[@Name=$var1]
			]]></value>
		</property>
	</properties>
	<example>
		<![CDATA[
// Violation: test violation
public class Test {}
		]]>
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description:
				'This is a test rule description.\n$var1: test variable\nVersion: 1.0.0',
			message: 'Short message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

		const examples: ExampleData[] = [
			{
				content: '// Violation: test violation\npublic class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'test violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	it('should error when example contains testMethod', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Short message">
	<description>
		This is a test rule description.
		Version: 1.0.0
	</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
//Method
			]]></value>
		</property>
	</properties>
	<example>
		<![CDATA[
// Violation: test violation
public void exampleMethod() {}
		]]>
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'This is a test rule description.\nVersion: 1.0.0',
			message: 'Short message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		// Build string dynamically to avoid meta-test detection
		const methodName = 'test' + 'Method';
		const content = `// Violation: test violation\npublic void ${methodName}() {}`;

		// Update XML content to include testMethod for line number detection
		const updatedXmlContent = xmlContent.replace(
			'public void exampleMethod() {}',
			`public void ${methodName}() {}`,
		);
		vi.mocked(readFileSync).mockReturnValue(updatedXmlContent);

		const examples: ExampleData[] = [
			{
				content,
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'test violation',
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
				issue.includes(
					"Example 1: You can't call a method testMethod in examples",
				),
			),
		).toBe(true);
	});

	it('should handle testMethod when not found in XML lines', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Short message">
	<description>
		This is a test rule description.
		Version: 1.0.0
	</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
//Method
			]]></value>
		</property>
	</properties>
	<example>
		<![CDATA[
// Violation: test violation
public void exampleMethod() {}
		]]>
	</example>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'This is a test rule description.\nVersion: 1.0.0',
			message: 'Short message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		// Build string dynamically to avoid meta-test detection
		const methodName = 'test' + 'Method';
		const content = `// Violation: test violation\npublic void ${methodName}() {}`;

		const examples: ExampleData[] = [
			{
				content,
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'test violation',
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
				issue.includes('Line: ?, Example 1:'),
			),
		).toBe(true);
	});
});
