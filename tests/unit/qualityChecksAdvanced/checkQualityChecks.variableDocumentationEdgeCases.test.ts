/**
 * @file
 * Variable documentation edge case tests for checkQualityChecks.
 */
import { readFileSync } from 'fs';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- Test helpers and object literals require type assertions */
import { describe, it, expect, vi } from 'vitest';
import { checkQualityChecks } from '../../../src/tester/checkQualityChecks.js';
import type { RuleMetadata, ExampleData } from '../../../../src/types/index.js';

vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

describe('checkQualityChecks', () => {
	// Mocks are cleared automatically by clearMocks: true in vitest.config.ts

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

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

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

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

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

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

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
