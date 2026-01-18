/**
 * @file
 * Variable documentation validation tests for checkQualityChecks.
 */
import { readFileSync } from 'fs';

import { describe, it, expect, vi } from 'vitest';
import { checkQualityChecks } from '../../src/tester/checkQualityChecks.js';
import type { RuleMetadata, ExampleData } from '../../src/types/index.js';

vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

describe('checkQualityChecks', () => {
	// Mocks are cleared automatically by clearMocks: true in vitest.config.ts

	describe('variable documentation', () => {
		it('should fail when variable is undocumented in description', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		This is a test description.
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
</rule>`;

			vi.mocked(readFileSync).mockReturnValue(xmlContent);

			const ruleMetadata = {
				description: 'This is a test description.\nVersion: 1.0.0',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
			} as const satisfies Readonly<RuleMetadata>;

			const examples: ExampleData[] = [];

			const result = checkQualityChecks(
				'test.xml',
				ruleMetadata,
				examples,
			);

			expect(result.passed).toBe(false);
			expect(
				result.issues.some((issue) =>
					issue.includes('variable $var1 undocumented'),
				),
			).toBe(true);
		});

		it('should handle undocumented variables when variable position is not found in XML XPath', () => {
			// Metadata contains $var1, but XML xpath does not -> findVariablePositionInXPath returns NOT_FOUND_INDEX
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description></description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
return //Method[@Name="other"]
			]]></value>
		</property>
	</properties>
</rule>`;

			vi.mocked(readFileSync).mockReturnValue(xmlContent);

			const ruleMetadata = {
				description: '',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
			} as const satisfies Readonly<RuleMetadata>;

			const result = checkQualityChecks('test.xml', ruleMetadata, []);

			expect(
				result.issues.some(
					(issue) => issue === 'variable $var1 undocumented',
				),
			).toBe(true);
		});

		it('should report undocumented variables without line when XPath location missing', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
</rule>`;

			vi.mocked(readFileSync).mockReturnValue(xmlContent);

			const ruleMetadata = {
				description: null,
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
			} as const satisfies Readonly<RuleMetadata>;

			const result = checkQualityChecks('test.xml', ruleMetadata, []);

			expect(
				result.issues.some((issue) =>
					issue.includes('variable $var1 undocumented'),
				),
			).toBe(true);
		});

		it('should pass when variable is documented in description', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		This is a test description.
		$var1: variable description
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
</rule>`;

			vi.mocked(readFileSync).mockReturnValue(xmlContent);

			const ruleMetadata = {
				description:
					'This is a test description.\n$var1: variable description\nVersion: 1.0.0',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
			} as const satisfies Readonly<RuleMetadata>;

			const examples: ExampleData[] = [];

			const result = checkQualityChecks(
				'test.xml',
				ruleMetadata,
				examples,
			);

			expect(
				result.issues.some((issue) =>
					issue.includes('variable $var1 undocumented'),
				),
			).toBe(false);
		});

		it('should handle XPath with multiple variables', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		Test description.
		$var1: first variable
		$var2: second variable
		Version: 1.0.0
	</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
let $var1 := 'value1',
	$var2 := 42
return //Method[@Name=$var1 and @Count=$var2]
			]]></value>
		</property>
	</properties>
</rule>`;

			vi.mocked(readFileSync).mockReturnValue(xmlContent);

			const ruleMetadata = {
				description:
					'Test description.\n$var1: first variable\n$var2: second variable\nVersion: 1.0.0',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "let $var1 := 'value1', $var2 := 42 return //Method[@Name=$var1 and @Count=$var2]",
			} as const satisfies Readonly<RuleMetadata>;

			const examples: ExampleData[] = [];

			const result = checkQualityChecks(
				'test.xml',
				ruleMetadata,
				examples,
			);

			expect(
				result.issues.some((issue) =>
					issue.includes('variable $var1 undocumented'),
				),
			).toBe(false);
			expect(
				result.issues.some((issue) =>
					issue.includes('variable $var2 undocumented'),
				),
			).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('should handle variable documentation with malformed pattern match', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		Test description.
		$: invalid variable name
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
</rule>`;

			vi.mocked(readFileSync).mockReturnValue(xmlContent);

			const ruleMetadata = {
				description:
					'Test description.\n$: invalid variable name\nVersion: 1.0.0',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
			} as const satisfies Readonly<RuleMetadata>;

			const examples: ExampleData[] = [];

			const result = checkQualityChecks(
				'test.xml',
				ruleMetadata,
				examples,
			);

			expect(
				result.issues.some((issue) =>
					issue.includes('variable $var1 undocumented'),
				),
			).toBe(true);
		});

		it('should handle XPath location undefined in variable documentation', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<properties>
		<property name="other">
			<value>test</value>
		</property>
	</properties>
</rule>`;

			vi.mocked(readFileSync).mockReturnValue(xmlContent);

			const ruleMetadata = {
				description: 'Test description',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
			} as const satisfies Readonly<RuleMetadata>;

			const examples: ExampleData[] = [];

			const result = checkQualityChecks(
				'test.xml',
				ruleMetadata,
				examples,
			);

			const varIssues = result.issues.filter((issue) =>
				issue.includes('variable $var1 undocumented'),
			);
			expect(varIssues.length).toBeGreaterThan(0);
			// When xpathLocation is undefined, varLine should be undefined, so no "Line X:" prefix
			expect(varIssues.every((issue) => !issue.startsWith('Line '))).toBe(
				true,
			);
		});

		it('should handle variable documentation with undefined varName from regex', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		Test description.
		$: invalid pattern that matches VARIABLE_DOC_PATTERN but regex fails
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
</rule>`;

			vi.mocked(readFileSync).mockReturnValue(xmlContent);

			const ruleMetadata = {
				description:
					'Test description.\n$: invalid pattern that matches VARIABLE_DOC_PATTERN but regex fails\nVersion: 1.0.0',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
			} as const satisfies Readonly<RuleMetadata>;

			const examples: ExampleData[] = [];

			const result = checkQualityChecks(
				'test.xml',
				ruleMetadata,
				examples,
			);

			// Should report $var1 as undocumented since varName would be undefined
			expect(
				result.issues.some((issue) =>
					issue.includes('variable $var1 undocumented'),
				),
			).toBe(true);
		});

		it('should include line number for undocumented variables when description is missing and xpath location is found', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description></description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
let $var1 := 'value1'
return //Method[@Name=$var1]
			]]></value>
		</property>
	</properties>
</rule>`;

			vi.mocked(readFileSync).mockReturnValue(xmlContent);

			const ruleMetadata = {
				description: '',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
			} as const satisfies Readonly<RuleMetadata>;

			const result = checkQualityChecks('test.xml', ruleMetadata, []);

			expect(
				result.issues.some(
					(issue) =>
						issue.startsWith('Line ') &&
						issue.includes('variable $var1 undocumented'),
				),
			).toBe(true);
		});
	});
});
