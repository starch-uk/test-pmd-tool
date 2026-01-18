/**
 * @file
 * Unit tests for checkXPathCoverage function - line number finding for attributes.
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

describe('checkXPathCoverage - attribute line numbers', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
		mockedAnalyzeXPath.mockClear();
	});

	it('should include line numbers for missing attributes when ruleFilePath is provided', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['BeginLine', 'Nested'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// Mock XML file content with XPath containing the attribute on same line as xpath and value
		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath" value="//Method[@BeginLine > 10 and @Nested]"></property>
  </properties>
</rule>`;
		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some content without any matching attributes',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@BeginLine > 10 and @Nested]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Line');
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'BeginLine',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Nested',
		);
		expect(mockedReadFileSync).toHaveBeenCalledWith(
			'/path/to/rule.xml',
			'utf-8',
		);
	});

	it('should handle findAttributeLineNumber when attribute is in XPath section (not on same line)', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Image'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// Mock XML with attribute in XPath section but not on same line as xpath/value
		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>
        //Method[@Image = 'test']
      </value>
    </property>
  </properties>
</rule>`;
		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			"//Method[@Image = 'test']",
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Line');
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Image');
	});

	it('should handle findAttributeLineNumber fallback with newline counting for attributes', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Nested'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// Mock XML where attribute is NOT found in first two paths
		// This triggers the fallback path that uses XPath string position
		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method
//SomeOtherNode
[@Name='test']</value>
    </property>
  </properties>
</rule>`;
		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		// XPath with newlines before the attribute - triggers fallback
		const xpath = `//Method
//SomeOtherNode
[@Nested='test']`;
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Line');
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Nested',
		);
	});

	it('should handle findAttributeLineNumber when attribute not found in XPath', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['NonExistent'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Name='test']</value>
    </property>
  </properties>
</rule>`;
		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		// XPath that doesn't contain the attribute - tests return null path
		const xpath = "//Method[@Name='test']";
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'NonExistent',
		);
		// Should not contain "Line" since attribute not found in XPath
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Line',
		);
	});

	it('should handle findAttributeLineNumber error gracefully', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['SomeAttr'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// Mock readFileSync to throw an error
		mockedReadFileSync.mockImplementation(() => {
			throw new Error('File read error');
		});

		const examples: ExampleData[] = [
			{
				content: 'some content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@SomeAttr]',
			examples,
			'/path/to/rule.xml',
		);

		// Should still work, just without line numbers
		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'SomeAttr',
		);
		// Should not contain "Line" since error occurred
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Line',
		);
	});

	it('should handle findAttributeLineNumber when property closes before attribute found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['MissingAttr'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// Mock XML where property closes before attribute is found in XPath section
		// This tests the inXPathSection = false path (line 68)
		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Name='test']</value>
    </property>
    <property name="other">
      <value>@MissingAttr</value>
    </property>
  </properties>
</rule>`;
		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		// XPath contains MissingAttr, but it's not in the xpath property section
		// This will trigger the fallback path
		const xpath = '//Method[@MissingAttr]';
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'MissingAttr',
		);
	});

	it('should handle String attribute coverage', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['String'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: "String name = 'test';",
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			"//LiteralExpression[@String='true']",
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.success).toBe(true);
	});

	it('should handle Null attribute coverage', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Null'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'Object obj = null;',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			"//LiteralExpression[@Null='true']",
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.success).toBe(true);
	});

	it('should handle LiteralType attribute coverage', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['LiteralType'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'Integer x = 42;',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//LiteralExpression[@LiteralType]',
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.success).toBe(true);
	});

	it('should handle Static attribute coverage', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Static'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'public static void method() {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage("//Method[@Static='true']", examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.success).toBe(true);
	});

	it('should handle Final attribute coverage', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Final'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'public final class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage("//Class[@Final='true']", examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.success).toBe(true);
	});
});
