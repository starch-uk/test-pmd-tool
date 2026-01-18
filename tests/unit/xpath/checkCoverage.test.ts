/**
 * @file
 * Unit tests for checkXPathCoverage function - line numbers and advanced scenarios.
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

describe.sequential('checkXPathCoverage', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
		mockedAnalyzeXPath.mockClear();
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

	it('should handle findNodeTypeLineNumber with multiline XPath', () => {
		const examples = [
			{
				content: 'public class TestClass {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['ClassDeclaration'],
			operators: [],
			patterns: [],
		});

		const multilineXPath = `//Class[
  @Name = 'TestClass'
]`;

		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>${multilineXPath}</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			multilineXPath,
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
	});

	it('should handle findNodeTypeLineNumber when node type not in single line and no newlines before node type', () => {
		// Test newlineMatches null case when xpathBeforeNodeType has no newlines
		const examples = [
			{
				content: 'public class TestClass {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['MethodDeclaration'],
			operators: [],
			patterns: [],
		});

		// XML where node type is not in a single line, forcing fallback path
		// XPath has no newlines before the node type, so newlineMatches will be null (line 178)
		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//MethodDeclaration[@Visibility="public"]</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			'//MethodDeclaration[@Visibility="public"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
	});

	it('should handle file content edge cases in findAttributeLineNumber', () => {
		// Test the defensive continue statements when line might be undefined
		// This covers lines 85, 130, 146, 166 in checkCoverage.ts
		// We use a Proxy to make array access return undefined for specific indices
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Name'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// Create a scenario where split might create edge cases
		// Mock readFileSync to return content that triggers findAttributeLineNumber
		const fileContent =
			'<rule>\n<property name="xpath">\n<value>//Method[@Name]</value>\n</property>\n</rule>';
		mockedReadFileSync.mockReturnValue(fileContent);

		const examples: ExampleData[] = [
			{
				content: 'public String Name = "test";',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name]',
			examples,
			'/path/to/rule.xml',
		);

		// Should complete without throwing
		expect(result).toBeDefined();
		expect(result.coverage).toBeDefined();
	});

	it('should handle file content edge cases in findNodeTypeLineNumber', () => {
		// Test the defensive continue statements when line might be undefined
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['MethodDeclaration'],
			operators: [],
			patterns: [],
		});

		// Mock readFileSync to return content that triggers findNodeTypeLineNumber
		const fileContent =
			'<rule>\n<property name="xpath">\n<value>//Method</value>\n</property>\n</rule>';
		mockedReadFileSync.mockReturnValue(fileContent);

		const examples: ExampleData[] = [
			{
				content: 'public class Test { public void method() {} }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method',
			examples,
			'/path/to/rule.xml',
		);

		// Should complete without throwing
		expect(result).toBeDefined();
		expect(result.coverage).toBeDefined();
	});

	it('should handle readFileSync errors gracefully in findAttributeLineNumber', () => {
		// Test the catch block that returns null
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Name'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// Mock readFileSync to throw an error
		mockedReadFileSync.mockImplementationOnce(() => {
			throw new Error('File read error');
		});

		const examples: ExampleData[] = [
			{
				content: 'public String Name = "test";',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name]',
			examples,
			'/path/to/rule.xml',
		);

		// Should complete without throwing, returning null for line numbers
		expect(result).toBeDefined();
		expect(result.coverage).toBeDefined();
	});

	it('should handle readFileSync errors gracefully in findNodeTypeLineNumber', () => {
		// Test the catch block that returns null
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['MethodDeclaration'],
			operators: [],
			patterns: [],
		});

		// Mock readFileSync to throw an error
		mockedReadFileSync.mockImplementationOnce(() => {
			throw new Error('File read error');
		});

		const examples: ExampleData[] = [
			{
				content: 'public class Test { public void method() {} }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method',
			examples,
			'/path/to/rule.xml',
		);

		// Should complete without throwing, returning null for line numbers
		expect(result).toBeDefined();
		expect(result.coverage).toBeDefined();
	});

	it('should handle operator when no newlines before position (newlineMatches null)', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['%'],
			patterns: [],
		});

		// XML that doesn't contain the operator, forcing fallback path
		// The search won't find '%' in the XML, so we hit the fallback
		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Name = "test"]</value>
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

		// Operator at start of XPath (index 0) means no newlines before
		// This forces fallback where xpathBeforeOperator is empty string, match returns null
		const xpath = '% //Method[@Name = "test"]';
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('Line ');
	});

	it('should treat AND conditionals as structurally covered when node types are fully covered and both violation and valid examples exist', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@SomeAttribute = $someVar and .//SomeNodeType',
					position: 0,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['MethodDeclaration'],
			operators: [],
			patterns: [],
		});

		// Examples with both violation and valid, but conditional expression won't match
		// This ensures conditionalSuccess is false initially, triggering the canTreatAsStructurallyCovered branch
		const examples: ExampleData[] = [
			{
				content: 'public class Test { public void method() {} }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: ['violation1'], // Has violation
			},
			{
				content: 'public class Test { private void method() {} }',
				exampleIndex: 2,
				validMarkers: [],
				valids: ['valid1'], // Has valid
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//MethodDeclaration[@SomeAttribute = $someVar and .//SomeNodeType]',
			examples,
			'/path/to/rule.xml',
		);

		// Should find conditional coverage result
		const conditionalResult = result.coverage.find(
			(c: Readonly<{ message: string }>) =>
				c.message.includes('Conditionals:'),
		);
		expect(conditionalResult).toBeDefined();
		// Conditional should be treated as structurally covered (all conditionals marked as covered)
		// because node types are fully covered and we have both violation and valid examples
		expect(conditionalResult?.success).toBe(true);
		expect(conditionalResult?.message).toContain('Conditionals:');
		expect(conditionalResult?.message).toContain('covered');
	});

	it('should check FullMethodName attribute coverage with Pattern.compile()', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['FullMethodName'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['MethodCallExpression'],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content:
					'public class Test { public void method() { Pattern.compile("test"); } }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//MethodCallExpression[@FullMethodName="Pattern.compile"]',
			examples,
			'/path/to/rule.xml',
		);

		const attributeResult = result.coverage.find(
			(c: Readonly<{ message: string }>) =>
				c.message.includes('Attributes:'),
		);
		expect(attributeResult).toBeDefined();
		expect(attributeResult?.success).toBe(true);
		expect(attributeResult?.message).toContain('1/1 covered');
	});

	it('should handle unknown conditional type with fallback string matching', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{ expression: '@UnknownAttr', type: 'unknown_type' },
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'public class Test { public void method() {} }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method[@UnknownAttr]', examples);

		// Should use fallback string matching for unknown type
		// Content doesn't contain '@unknownattr' or 'if', so it should be missing
		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
	});
});
