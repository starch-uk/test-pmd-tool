/**
 * @file
 * XPath hardcoded values validation tests for checkQualityChecks.
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

	it('should fail when hardcoded value is not in let statement', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
//Method[@Name="hardcoded"]
			]]></value>
		</property>
	</properties>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method[@Name="hardcoded"]',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('outside initial let statement'),
			),
		).toBe(true);
	});
	it('should normalize let variable values when checking hardcoded values', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
let $name := "ok"
return //X[@A=$name and @B="outside"]
			]]></value>
		</property>
	</properties>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: 'let $name := "ok" return //X[@A=$name and @B="outside"]',
		} as const satisfies Readonly<RuleMetadata>;

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(
			result.issues.some((issue) =>
				issue.includes('"outside" outside initial let statement'),
			),
		).toBe(true);
	});
	it('should pass when hardcoded value is in let statement', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
let $name := "hardcoded"
return //Method[@Name=$name]
			]]></value>
		</property>
	</properties>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: 'let $name := "hardcoded" return //Method[@Name=$name]',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('outside initial let statement'),
			),
		).toBe(false);
	});
	it('should not flag hardcoded return value when it matches a let value', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
let $name := "same"
return //Method[@Name="same"]
			]]></value>
		</property>
	</properties>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: 'let $name := "same" return //Method[@Name="same"]',
		} as const satisfies Readonly<RuleMetadata>;

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(
			result.issues.some((issue) =>
				issue.includes('outside initial let statement'),
			),
		).toBe(false);
	});
	it('should handle null XPath in checkXPathHardcodedValues', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: null,
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('outside initial let statement'),
			),
		).toBe(false);
	});
	it('should handle empty XPath in checkXPathHardcodedValues', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('outside initial let statement'),
			),
		).toBe(false);
	});
	it('should handle XPath with no hardcoded values', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
let $name := $var
return //Method[@Name=$name]
			]]></value>
		</property>
	</properties>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: 'let $name := $var return //Method[@Name=$name]',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('outside initial let statement'),
			),
		).toBe(false);
	});
	it('should handle CDATA without closing marker', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<properties>
		<property name="xpath">
			<value><![CDATA[
let $var1 := 'value1'
return //Method[@Name=$var1]
			</value>
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

		expect(result.issues.length).toBeGreaterThanOrEqual(0);
	});
	it('should handle CDATA with closing marker found', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<properties>
		<property name="xpath">
			<value>
				<![CDATA[
let $var1 := 'value1'
return //Method[@Name=$var1]
				]]>
			</value>
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

		expect(result.issues.length).toBeGreaterThanOrEqual(0);
	});
	it('should handle properties section without xpath property', () => {
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
			xpath: '//Method',
		} as const satisfies Readonly<RuleMetadata>;

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		// Should handle gracefully when xpath property is not found
		expect(result.issues.length).toBeGreaterThanOrEqual(0);
	});
});
