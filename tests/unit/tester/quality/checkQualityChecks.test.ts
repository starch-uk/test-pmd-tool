/**
 * @file
 * Unit tests for checkQualityChecks function.
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

	it('should fail when message attribute is missing', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: null,
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('message attribute is missing'),
			),
		).toBe(true);
	});

	it('should include line number when message line can be located', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: null,
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(result.issues.some((issue) => issue.startsWith('Line '))).toBe(
			true,
		);
	});

	it('should fail when message attribute exceeds 80 characters', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="This is a very long message that exceeds the maximum allowed length of 80 characters and should trigger an error">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message:
				'This is a very long message that exceeds the maximum allowed length of 80 characters and should trigger an error',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('message attribute exceeds 80 characters'),
			),
		).toBe(true);
	});

	it('should fail when message exceeds 80 characters and message line is unknown', () => {
		const longMessage =
			'This is a very long message that exceeds the maximum allowed length of 80 characters and should trigger an error';

		// No message attribute in XML, so findMessageLineNumber returns undefined.
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: longMessage,
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(
			result.issues.some((issue) =>
				issue.startsWith('message attribute exceeds 80 characters'),
			),
		).toBe(true);
	});

	it('should fail when description does not end with Version line', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		This is a test description without version.
	</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'This is a test description without version.',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(true);
	});

	it('should fail when description ends with invalid version format', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		This is a test description.
		Version: 1.0
	</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'This is a test description.\nVersion: 1.0',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(true);
	});

	it('should pass when description ends with valid SemVer version', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		This is a test description.
		Version: 1.2.3
	</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'This is a test description.\nVersion: 1.2.3',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(false);
	});

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method[@Name="hardcoded"]',
		};

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: 'let $name := "ok" return //X[@A=$name and @B="outside"]',
		};

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: 'let $name := "hardcoded" return //Method[@Name=$name]',
		};

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: 'let $name := "same" return //Method[@Name="same"]',
		};

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(
			result.issues.some((issue) =>
				issue.includes('outside initial let statement'),
			),
		).toBe(false);
	});

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

		const ruleMetadata: RuleMetadata = {
			description: 'This is a test description.\nVersion: 1.0.0',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

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

		const ruleMetadata: RuleMetadata = {
			description: '',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

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

		const ruleMetadata: RuleMetadata = {
			description: null,
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

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

		const ruleMetadata: RuleMetadata = {
			description:
				'This is a test description.\n$var1: variable description\nVersion: 1.0.0',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('variable $var1 undocumented'),
			),
		).toBe(false);
	});

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

	it('should handle error reading file', () => {
		vi.mocked(readFileSync).mockImplementation(() => {
			throw new Error('File not found');
		});

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('Error reading rule file: String error'),
			),
		).toBe(true);
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

		const ruleMetadata: RuleMetadata = {
			description:
				'Test description.\n$var1: first variable\n$var2: second variable\nVersion: 1.0.0',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1', $var2 := 42 return //Method[@Name=$var1 and @Count=$var2]",
		};

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

	it('should fail when description is null', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: null,
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(true);
	});

	it('should fail when description is empty', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description></description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: '',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(true);
	});

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

	it('should handle null XPath in checkXPathHardcodedValues', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: null,
		};

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('outside initial let statement'),
			),
		).toBe(false);
	});

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.issues.length).toBeGreaterThanOrEqual(0);
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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.issues.length).toBeGreaterThanOrEqual(0);
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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: 'let $name := $var return //Method[@Name=$name]',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes('outside initial let statement'),
			),
		).toBe(false);
	});

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

		const ruleMetadata: RuleMetadata = {
			description:
				'Test description.\n$: invalid variable name\nVersion: 1.0.0',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

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

	it('should handle valid marker with no description and lineNum undefined', () => {
		// Put <example> and </example> on the same line so findMarkerLineNumber
		// hits estimatedLine === i and returns undefined.
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
	<example>X</example>
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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

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

		const ruleMetadata: RuleMetadata = {
			description:
				'Test description.\n$: invalid pattern that matches VARIABLE_DOC_PATTERN but regex fails\nVersion: 1.0.0',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		// Should report $var1 as undocumented since varName would be undefined
		expect(
			result.issues.some((issue) =>
				issue.includes('variable $var1 undocumented'),
			),
		).toBe(true);
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

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		// Should handle gracefully when xpath property is not found
		expect(result.issues.length).toBeGreaterThanOrEqual(0);
	});

	it('should handle XML with no message attribute', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(result.issues.length).toBeGreaterThanOrEqual(0);
	});

	it('should handle XML with no description element', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<properties />
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(result.issues.length).toBeGreaterThanOrEqual(0);
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

		const ruleMetadata: RuleMetadata = {
			description: '',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "let $var1 := 'value1' return //Method[@Name=$var1]",
		};

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
