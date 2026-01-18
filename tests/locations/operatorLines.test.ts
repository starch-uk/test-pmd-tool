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

describe('checkXPathCoverage - operator line numbers', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
		mockedAnalyzeXPath.mockClear();
	});
	it('should include line numbers for missing operators when xpath and value are on same line', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['and'],
			patterns: [],
		});

		const mockXmlContent = `<?xml version="1.0" ?>
<rule name="TestRule">
  <properties>
    <property name="xpath" value="//Method[@Flag and @OtherFlag]"></property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'if (flag) { }', // no textual "and" so operator is missing
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Flag and @OtherFlag]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('and');
		expect(description).toContain('Line ');
	});

	it('should include line numbers for missing operators when ruleFilePath is provided', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['and', 'or'],
			patterns: [],
		});

		const mockXmlContent = `<?xml version="1.0" ?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Flag and @OtherFlag or @ThirdFlag]</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'if (flag && otherFlag) { }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Flag and @OtherFlag or @ThirdFlag]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		// At least one missing operator should carry a line number
		expect(description).toContain('Missing:');
		expect(description).toContain('or');
		expect(description).toContain('Line ');
	});

	it('should use fallback line calculation for operators when xpath and XML differ', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['+'],
			patterns: [],
		});

		// XML does not contain '+', so findOperatorLineNumber must use the fallback
		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="other">
      <value>//SomethingWithoutPlus</value>
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

		const xpath = '//Method[@Flag + @Other]';
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('+');
		expect(description).toContain('Line ');
	});

	it('should return null from operator line finder when operator not in xpath', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['+'],
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

		// XPath does not contain the '+' operator, so xpathIndex will be NOT_FOUND_INDEX
		const xpath = '//Method[@Flag]';
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).not.toContain('Line ');
	});

	it('should handle readFileSync errors gracefully in findOperatorLineNumber', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['and'],
			patterns: [],
		});

		mockedReadFileSync.mockImplementationOnce(() => {
			throw new Error('File read error');
		});

		const examples: ExampleData[] = [
			{
				content: 'if (flag && otherFlag) { }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Flag and @OtherFlag]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('and');
		expect(description).not.toContain('Line ');
	});
});
