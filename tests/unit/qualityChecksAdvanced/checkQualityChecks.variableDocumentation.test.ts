/**
 * @file
 * Variable documentation validation tests for checkQualityChecks.
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

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

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

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

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

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

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
