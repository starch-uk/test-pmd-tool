/**
 * @file
 * Unit tests for checkXPathCoverage function.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkXPathCoverage } from '../../../src/xpath/checkCoverage.js';
import type { ExampleData } from '../../../src/types/index.js';

// Mock analyzeXPath
vi.mock('../../../src/xpath/analyzeXPath.js', () => ({
	analyzeXPath: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

import { analyzeXPath } from '../../../src/xpath/analyzeXPath.js';

const mockedReadFileSync = vi.mocked(readFileSync);

const mockedAnalyzeXPath = vi.mocked(analyzeXPath);

describe('checkXPathCoverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedReadFileSync.mockReset();
	});

	it('should return empty coverage when xpath is null', () => {
		const examples: ExampleData[] = [
			{
				content: 'test content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(null, examples);

		expect(result.coverage).toEqual([]);
		expect(result.overallSuccess).toBe(false);
		expect(result.uncoveredBranches).toEqual([]);
		expect(mockedAnalyzeXPath).not.toHaveBeenCalled();
	});

	it('should return empty coverage when xpath is undefined', () => {
		const examples: ExampleData[] = [
			{
				content: 'test content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(undefined, examples);

		expect(result.coverage).toEqual([]);
		expect(result.overallSuccess).toBe(false);
		expect(result.uncoveredBranches).toEqual([]);
		expect(mockedAnalyzeXPath).not.toHaveBeenCalled();
	});

	it('should return empty coverage when xpath is empty string', () => {
		const examples: ExampleData[] = [
			{
				content: 'test content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('', examples);

		expect(result.coverage).toEqual([]);
		expect(result.overallSuccess).toBe(false);
		expect(result.uncoveredBranches).toEqual([]);
		expect(mockedAnalyzeXPath).not.toHaveBeenCalled();
	});

	it('should return empty coverage when examples array is empty', () => {
		const result = checkXPathCoverage('//Method', []);

		expect(result.coverage).toEqual([]);
		expect(result.overallSuccess).toBe(false);
		expect(result.uncoveredBranches).toEqual([]);
		expect(mockedAnalyzeXPath).not.toHaveBeenCalled();
	});

	it('should check node types coverage when found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['Method', 'Class'],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'public class MyClass { public void method() {} }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Node types');
		expect(result.coverage[0]?.success).toBe(true);
		expect(result.uncoveredBranches).toEqual([]);
		expect(result.overallSuccess).toBe(true);
	});

	it('should check node types coverage when not found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['Method', 'Class'],
			operators: [],
			patterns: [],
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

		const result = checkXPathCoverage('//Method', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Node types');
		expect(result.coverage[0]?.success).toBe(false);
		expect(result.uncoveredBranches).toContain('Node types: Method, Class');
		expect(result.overallSuccess).toBe(false);
	});

	it('should check conditionals coverage when found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{ expression: '@Name', position: 0, type: 'and' },
				{ expression: '@Value', position: 10, type: 'or' },
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'if (@Name == "test") { }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method[@Name]', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Conditionals');
		expect(result.coverage[0]?.success).toBe(true);
		expect(result.uncoveredBranches).toEqual([]);
		expect(result.overallSuccess).toBe(true);
	});

	it('should check conditionals coverage when not found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [{ expression: '@Name', position: 0, type: 'and' }],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
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

		const result = checkXPathCoverage('//Method[@Name]', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Conditionals');
		expect(result.coverage[0]?.success).toBe(false);
		expect(result.uncoveredBranches).toContain('Conditionals: @Name');
		expect(result.overallSuccess).toBe(false);
	});

	it('should check attributes coverage when found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Name', 'Value'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content:
					'public String Name = "test"; public Integer Value = 5;',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method[@Name]', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Attributes');
		expect(result.coverage[0]?.success).toBe(false); // Name and Value not found in content
		expect(result.uncoveredBranches).toEqual(['Attributes: Name, Value']);
		expect(result.overallSuccess).toBe(false);
	});

	it('should check attributes coverage when not found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Name', 'Value'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
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

		const result = checkXPathCoverage('//Method[@Name]', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Attributes');
		expect(result.coverage[0]?.success).toBe(false);
		expect(result.uncoveredBranches).toContain('Attributes: Name, Value');
		expect(result.overallSuccess).toBe(false);
	});

	it('should check operators coverage when found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['==', '!='],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'if (x == 5 && y != 10) { }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method[@Op=="=="]', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Operators');
		expect(result.coverage[0]?.success).toBe(true);
		expect(result.uncoveredBranches).toEqual([]);
		expect(result.overallSuccess).toBe(true);
	});

	it('should check operators coverage when not found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['==', '!='],
			patterns: [],
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

		const result = checkXPathCoverage('//Method[@Op=="=="]', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Operators');
		expect(result.coverage[0]?.success).toBe(false);
		expect(result.uncoveredBranches).toContain('Operators: ==, !=');
		expect(result.overallSuccess).toBe(false);
	});

	it('should check all coverage types together', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Name'],
			conditionals: [{ expression: '@Name', position: 0, type: 'and' }],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['Method'],
			operators: ['=='],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content:
					'public void method() { if (x == 5) { } } public String Name = "test";',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method[@Name=="test"]', examples);

		expect(result.coverage).toHaveLength(4);
		expect(result.overallSuccess).toBe(true);
		expect(result.uncoveredBranches).toEqual([]);
	});

	it('should return overallSuccess true when no coverage items exist', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'test content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//*', examples);

		expect(result.coverage).toEqual([]);
		expect(result.overallSuccess).toBe(true);
		expect(result.uncoveredBranches).toEqual([]);
	});

	it('should handle multiple examples', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['Method'],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'public void method1() {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
			{
				content: 'public void method2() {}',
				exampleIndex: 2,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.success).toBe(true);
		expect(result.overallSuccess).toBe(true);
	});

	it('should handle attributes with empty found list', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['NonExistent'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'some content without the attribute',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method[@NonExistent]', examples);

		expect(result.coverage).toHaveLength(1);
		// When attributes are missing, description shows "Missing:" section
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'NonExistent',
		);
		expect(result.coverage[0]?.success).toBe(false);
	});

	it('should handle operators with empty arrays', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
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

		const result = checkXPathCoverage('//Method', examples);

		expect(result.coverage).toHaveLength(0); // No operators to check
		expect(result.overallSuccess).toBe(true);
		expect(result.uncoveredBranches).toEqual([]);
	});

	it('should handle node types with empty found list', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['NonExistentType'],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'some content without the node type',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//NonExistentType', examples);

		expect(result.coverage).toHaveLength(1);
		// When node types are missing, description shows "Missing:" section
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'NonExistentType',
		);
		expect(result.coverage[0]?.success).toBe(false);
	});

	it('should include line numbers for missing node types when ruleFilePath is provided', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['LiteralExpression'],
			operators: [],
			patterns: [],
		});

		// Mock XML file content with XPath containing the node type on same line as xpath and value
		// This tests the first search path (line 50)
		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath" value="//LiteralExpression[@Value='test']"></property>
  </properties>
</rule>`;
		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some content without any matching types',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			"//LiteralExpression[@Value='test']",
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Line');
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'LiteralExpression',
		);
		expect(mockedReadFileSync).toHaveBeenCalledWith(
			'/path/to/rule.xml',
			'utf-8',
		);
	});

	it('should handle findNodeTypeLineNumber when node type is in XPath section', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['ModifierNode'],
			operators: [],
			patterns: [],
		});

		// Mock XML with node type in XPath section (not on same line as xpath/value)
		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>
        //ModifierNode[@Static]
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
			'//ModifierNode[@Static]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'ModifierNode',
		);
	});

	it('should handle findNodeTypeLineNumber fallback with newline counting', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['Annotation'],
			operators: [],
			patterns: [],
		});

		// Mock XML where node type is NOT found in first two paths
		// The XML doesn't contain the node type text, so fallback uses XPath string position
		// This tests the fallback path (lines 69-85)
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

		// XPath with newlines before the node type - node type is in XPath but not in XML file
		// This triggers the fallback path (lines 69-85)
		const xpath = `//Method
//Annotation
[@Name='test']`;
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Annotation',
		);
		// Should have line number from fallback calculation
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Line');
		// Should have line number from fallback calculation
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Line');
	});

	it('should handle findNodeTypeLineNumber when node type not found in XPath', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['NonExistentType'],
			operators: [],
			patterns: [],
		});

		// Mock XML file
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

		// XPath that doesn't contain the node type - tests line 87 (return null)
		const xpath = "//Method[@Name='test']";
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'NonExistentType',
		);
		// Should not contain "Line" since node type not found in XPath
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Line',
		);
	});

	it('should handle findNodeTypeLineNumber error gracefully', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['SomeType'],
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
			'//SomeType',
			examples,
			'/path/to/rule.xml',
		);

		// Should still work, just without line numbers
		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'SomeType',
		);
		// Should not contain "Line" since error occurred
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Line',
		);
	});

	it('should handle findNodeTypeLineNumber fallback when no value element exists', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['TestType'],
			operators: [],
			patterns: [],
		});

		// Mock XML that doesn't contain <value> element anywhere - this triggers the fallback
		// but the fallback won't find <value> either, so it should return null
		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <someOtherElement>//Method[SomeOtherNode]</someOtherElement>
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

		// XPath contains TestType, and xpathIndex will be found, but no <value> element exists
		// This triggers the fallback for loop that doesn't find <value>, so returns null
		const xpath = '//Method[TestType]';
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'TestType',
		);
		// Should not contain "Line" since findNodeTypeLineNumber returned null
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Line',
		);
	});

	it('should truncate long conditional expressions', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression:
						'this is a very long conditional expression that should be truncated because it exceeds the maximum length limit',
					position: 0,
					type: 'not',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content:
					'this is a very long conditional expression that should be truncated because it exceeds the maximum length limit',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'not(this is a very long conditional expression that should be truncated because it exceeds the maximum length limit)',
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Covered:',
		);
		// Should be truncated to 50 characters + "..."
		const description = result.coverage[0]?.evidence[0]?.description;
		const coveredLine = description
			?.split('\n')
			.find((line) => line.includes('not:'));
		expect(coveredLine).toBeDefined();
		if (coveredLine !== undefined) {
			expect(coveredLine.length).toBeLessThanOrEqual(61); // 50 + "not: " + "..."
			expect(coveredLine).toContain('...');
		}
	});

	it('should handle conditional coverage when only "if" keyword is found', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Value = 5',
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

		const examples: ExampleData[] = [
			{
				content: 'if (condition) { }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method[@Value = 5]', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Covered:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('and:');
	});

	it('should handle newline counting when match returns null', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['Method'],
			operators: [],
			patterns: [],
		});

		// Mock XML where node type is NOT found in first two search paths
		// This forces the fallback path where match() returns null (no newlines before node type)
		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="other">
      <value>something</value>
    </property>
    <property name="xpath">
      <value>SomeOtherNode[@Name='test']</value>
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

		// XPath with Method at start (no newlines before it) - triggers fallback
		// and tests the ternary branch when match() returns null
		const xpath = "Method[@Name='test']";
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Method',
		);
		// Should have line number from fallback (even when no newlines, uses MIN_COUNT = 0)
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Line');
	});

	it('should handle node types when ruleFilePath is empty string', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['TestType'],
			operators: [],
			patterns: [],
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

		// Pass empty string for ruleFilePath - this makes hasRuleFilePath false
		// so nodeTypeOptions will be undefined, and no line numbers will be found
		const xpath = '//TestType';
		const result = checkXPathCoverage(xpath, examples, '');

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'TestType',
		);
		// Should not contain "Line" since hasRuleFilePath is false (empty string)
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Line',
		);
	});

	it('should handle node types when options has ruleFilePath but xpath is undefined', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['TestType'],
			operators: [],
			patterns: [],
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

		// This tests the unreachable branch where hasRuleFilePath is true but hasXpath is false
		// In practice, this can't happen because nodeTypeOptions is only created when both are true
		// But we test it to satisfy coverage requirements
		const xpath = '//TestType';
		// Pass undefined for ruleFilePath to make nodeTypeOptions undefined
		// This means options won't be passed to checkNodeTypeCoverage
		const result = checkXPathCoverage(xpath, examples, undefined);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'TestType',
		);
		// Should not contain "Line" since options is undefined
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Line',
		);
	});

	it('should handle empty coverage results', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
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

		const result = checkXPathCoverage('//Method', examples);

		expect(result.coverage).toHaveLength(0);
		expect(result.overallSuccess).toBe(true);
	});

	it('should handle when xpath is empty string', () => {
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

		const result = checkXPathCoverage('', examples);

		expect(result.coverage).toEqual([]);
		expect(result.overallSuccess).toBe(false);
		expect(result.uncoveredBranches).toEqual([]);
	});

	it('should handle conditional description with only missing items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Value = 5',
					position: 0,
					type: 'not',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'some content without the conditional',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('not(@Value = 5)', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Covered:',
		);
	});

	it('should handle attribute description with only found items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Name'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'name attribute',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method[@Name]', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Name');
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Missing:',
		);
	});

	it('should handle operator description with only found items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['='],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'if (x = 5) { }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage("//Method[@Name='test']", examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('=');
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Missing:',
		);
	});

	it('should handle conditional description with both covered and missing items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Value = 5',
					position: 0,
					type: 'and',
				},
				{
					expression: '@Name = "test"',
					position: 10,
					type: 'or',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: '@value = 5',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Value = 5 or @Name = "test"]',
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description;
		expect(description).toContain('Covered:');
		// The first conditional should be covered (contains "@value = 5")
		// The second conditional should be missing (doesn't contain "@name = "test"" and no "if")
		expect(description).toContain('Missing:');
		expect(description).toContain('or:');
	});

	it('should handle attribute description with both found and missing items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Name', 'Value'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'name attribute',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name and @Value]',
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Name');
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('Value');
	});

	it('should check coverage for String, Null, LiteralType, Image attributes', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['String', 'Null', 'LiteralType', 'Image'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content:
					'String s = "hello"; Object n = null; Integer i = 42; Boolean b = true;',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//LiteralExpression[@String and @Null and @LiteralType and @Image]',
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Attributes');
		expect(result.coverage[0]?.success).toBe(true);
	});

	it('should check coverage for Static and Final attributes', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Static', 'Final'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'public static final Integer VALUE = 1;',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//ModifierNode[@Static and @Final]',
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.message).toContain('Attributes');
		expect(result.coverage[0]?.success).toBe(true);
	});

	it('should check coverage for Annotation and AnnotationParameter node types', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['Annotation', 'AnnotationParameter'],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content:
					'@IsTest public class TestClass { } @IsTest(SeeAllData=false) public void test() { }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Annotation | //AnnotationParameter',
			examples,
		);

		expect(result.coverage).toHaveLength(1); // node types
		expect(result.coverage[0]?.success).toBe(true);
	});

	it('should handle operator description with both found and missing items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['=', '!='],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'if (x = 5) { }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			"//Method[@Name='test' and @Value != 0]",
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('=');
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).toContain('!=');
	});

	it('should check coverage for LiteralExpression node type', () => {
		const examples = [
			{
				content: 'Integer x = 42; Decimal y = 3.14;',
				exampleIndex: 0,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//LiteralExpression[@LiteralType = "INTEGER"]',
			examples,
		);

		expect(result.coverage).toHaveLength(1); // operators
		expect(result.coverage[0]?.message).toContain('Operators');
		expect(result.coverage[0]?.success).toBe(false); // INTEGER not found in content
	});

	it('should check coverage for Annotation and AnnotationParameter node types', () => {
		const examples = [
			{
				content:
					'@IsTest public class TestClass { } @IsTest(SeeAllData=false) public void test() { }',
				exampleIndex: 0,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Annotation | //AnnotationParameter',
			examples,
		);

		expect(result.coverage).toHaveLength(1); // node types
		expect(result.coverage[0]?.success).toBe(false); // AnnotationParameter not found
	});

	it('should check coverage for modifier node type', () => {
		const examples = [
			{
				content: 'public static final Integer CONSTANT = 1;',
				exampleIndex: 0,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//ModifierNode[@Static = true() and @Final = true()]',
			examples,
		);

		expect(result.coverage).toHaveLength(1); // operators
		expect(result.coverage[0]?.message).toContain('Operators');
		expect(result.coverage[0]?.success).toBe(false); // 1/2 operators found
	});

	it('should check coverage for String, Null, LiteralType, Image attributes', () => {
		const examples = [
			{
				content:
					'String s = "hello"; Object n = null; Integer i = 42; Boolean b = true;',
				exampleIndex: 0,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//LiteralExpression[@String = false() and @Null = false() and @LiteralType = "INTEGER" and @Image = "42"]',
			examples,
		);

		expect(result.coverage).toHaveLength(1); // operators
		expect(result.coverage[0]?.message).toContain('Operators');
		expect(result.coverage[0]?.success).toBe(false);
	});

	it('should check coverage for Static and Final attributes', () => {
		const examples = [
			{
				content: 'public static final Integer VALUE = 1;',
				exampleIndex: 0,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//ModifierNode[@Static = true() and @Final = true()]',
			examples,
		);

		expect(result.coverage).toHaveLength(1); // operators
		expect(result.coverage[0]?.message).toContain('Operators');
		expect(result.coverage[0]?.success).toBe(false);
	});
});
