/**
 * @file
 * Unit tests for checkXPathCoverage function - conditional and operator line numbers.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkXPathCoverage } from '../../src/xpath/checkCoverage.js';
import type { ExampleData } from '../../src/types/index.js';

// Mock analyzeXPath
vi.mock('../../../src/xpath/analyzeXPath.js', () => ({
	analyzeXPath: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

// Import mocked modules after all vi.mock() declarations
// Per VITEST.md, vi.mock() is hoisted, so imports get the mocked version
import * as analyzeXPathModule from '../../src/xpath/analyzeXPath.js';

const mockedReadFileSync = vi.mocked(readFileSync);
// Use vi.spyOn per VITEST.md "Spy on Export" pattern to get typed mock access

const mockedAnalyzeXPath = vi.spyOn(analyzeXPathModule, 'analyzeXPath');

describe('checkXPathCoverage - conditional line numbers', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
		mockedAnalyzeXPath.mockClear();
	});
	it('should include line numbers for missing nested conditional with CDATA and ruleFilePath', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression:
						'$isEmptyString(./LiteralExpression)\n\t\t\t\t\t\tor $isEmptyString(./NewListLiteralExpression/following-sibling::LiteralExpression)',
					position: 0,
					type: 'and',
				},
				{
					expression:
						'$isEmptyString(./NewListLiteralExpression/following-sibling::LiteralExpression)',
					position: 0,
					type: 'or',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// Minimal XML that mirrors the real CDATA structure used in sca-extra rules
		const mockXmlContent = `<?xml version="1.0" ?>
<ruleset>
  <rule name="PreferConcatenationOverStringJoinWithEmpty">
    <properties>
      <property name="xpath">
        <value>
          <![CDATA[
          let $joinMethod := 'join',
            $stringJoinFullName := 'String.join',
            $isEmptyString := function($expr) {
              $expr/@String = true()
                and ($expr/@Image = "''" or $expr/@Image = '""' or string-length($expr/@Image) = 0)
            }
          return //MethodCallExpression[
            @MethodName = $joinMethod
            and @FullMethodName = $stringJoinFullName
            and .//NewListLiteralExpression
            and (
              $isEmptyString(./LiteralExpression)
              or $isEmptyString(./NewListLiteralExpression/following-sibling::LiteralExpression)
            )
          ]
          ]]>
        </value>
      </property>
    </properties>
  </rule>
</ruleset>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some content without the second conditional',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const xpath = `
let $joinMethod := 'join',
	$stringJoinFullName := 'String.join',
	$isEmptyString := function($expr) {
		$expr/@String = true()
			and ($expr/@Image = "''" or $expr/@Image = '""' or string-length($expr/@Image) = 0)
	}
return //MethodCallExpression[
	@MethodName = $joinMethod
	and @FullMethodName = $stringJoinFullName
	and .//NewListLiteralExpression
	and (
		$isEmptyString(./LiteralExpression)
		or $isEmptyString(./NewListLiteralExpression/following-sibling::LiteralExpression)
	)
]`;

		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		// We should report a line number for the missing "or" conditional, but
		// tests must not assert the concrete line value.
		expect(description).toContain('Missing:');
		expect(description).toContain('or:');
		expect(description).toContain('Line ');
	});

	it('should use direct XPath section search for conditional line numbers', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Name = "test"',
					position: 0,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Flag = true() and @Name = "test"]</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some unrelated content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Flag = true() and @Name = "test"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('@Name = "test"');
		expect(description).toContain('Line ');
	});

	it('should use fallback line calculation for conditionals when xpath content is on next line', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Name = "test"',
					position: 5,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>
        //Method[@Name = "test"]
      </value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some unrelated content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name = "test"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('@Name = "test"');
		expect(description).toContain('Line ');
	});

	it('should use fallback line calculation when xpath content is on same line as value', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Other = "x"',
					position: 5,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Other = "x"]</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some unrelated content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Other = "x"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('@Other = "x"');
		expect(description).toContain('Line ');
	});

	it('should return null from conditional line finder when no xpath content line is detected', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Name = "test"',
					// Simulate unknown position so fallback condition is skipped
					position: -1,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <!-- no <value> element here -->
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some unrelated content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name = "test"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		// No line information when finder returns null
		expect(description).not.toContain('Line ');
	});

	it('should handle readFileSync errors gracefully in findConditionalLineNumber', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Name = "test"',
					position: 0,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// Force readFileSync to throw when conditional line lookup runs
		mockedReadFileSync.mockImplementationOnce(() => {
			throw new Error('File read error');
		});

		const examples: ExampleData[] = [
			{
				content: 'some unrelated content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name = "test"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('@Name = "test"');
		// When readFileSync fails, no line number should be included
		expect(description).not.toContain('Line ');
	});
});
