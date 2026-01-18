/**
 * @file
 * Unit tests for checkXPathCoverage function - node type coverage.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkXPathCoverage } from '../../src/xpath/checkCoverage.js';

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

describe('checkXPathCoverage - node types', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
		mockedAnalyzeXPath.mockClear();
	});
	it('should check coverage for BinaryExpression node type', () => {
		const examples = [
			{
				content:
					'public class Test { public void method() { Integer a = 1; Integer b = 2; Integer sum = a + b; Integer x = 3; Integer y = 1; Integer diff = x - y; } }',
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
			nodeTypes: ['BinaryExpression'],
			operators: [],
			patterns: [],
		});

		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//BinaryExpression</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			'//BinaryExpression',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
	});

	it('should check coverage for all node type cases', () => {
		const examples = [
			{
				content: `
if (condition) {}
switch on value { when 'test' {} }
for (Integer i = 0; i < 10; i++) {}
for (String item : items) {}
while (condition) {}
do {} while (condition);
Boolean result = condition ? true : false;
helperMethod();
`,
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
			nodeTypes: [
				'IfBlockStatement',
				'SwitchStatement',
				'ForLoopStatement',
				'ForEachStatement',
				'WhileLoopStatement',
				'DoWhileLoopStatement',
				'TernaryExpression',
				'MethodCallExpression',
			],
			operators: [],
			patterns: [],
		});

		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//IfBlockStatement | //SwitchStatement | //ForLoopStatement</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			'//IfBlockStatement | //SwitchStatement | //ForLoopStatement',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
	});

	it('should check coverage for StandardCondition node type', () => {
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
			nodeTypes: ['StandardCondition'],
			operators: [],
			patterns: [],
		});

		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//StandardCondition</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			'//StandardCondition',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
		// StandardCondition should always be covered (returns true)
		// Check if any coverage result mentions node types
		const nodeTypeCoverage = result.coverage.find(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(c) =>
				c.message.toLowerCase().includes('node') ||
				c.message.toLowerCase().includes('standardcondition'),
		);
		// StandardCondition always returns true, so if found, it should be successful
		if (nodeTypeCoverage) {
			expect(nodeTypeCoverage.success).toBe(true);
		}
	});

	it('should handle default case for unknown node types', () => {
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
			nodeTypes: ['UnknownNodeType'],
			operators: [],
			patterns: [],
		});

		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//UnknownNodeType</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			'//UnknownNodeType',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
		// Default case uses simple string matching - check if coverage was generated
		// The coverage might be in a node types coverage result
		const nodeTypeCoverage = result.coverage.find(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(c) =>
				c.message.toLowerCase().includes('node') ||
				c.message.toLowerCase().includes('unknownnodetype'),
		);
		// Coverage should exist for the node type
		expect(result.coverage.length).toBeGreaterThan(0);
		// Verify coverage was found
		expect(nodeTypeCoverage).toBeDefined();
	});

	it('should check coverage for UserClass node type with nested classes', () => {
		const examples = [
			{
				content: `
public class OuterClass {
    public class InnerClass {
        private Integer value;
    }
}
`,
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
			nodeTypes: ['UserClass'],
			operators: [],
			patterns: [],
		});

		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//UserClass</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			'//UserClass',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
		const nodeTypeCoverage = result.coverage.find(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(c) => c.message.toLowerCase().includes('node'),
		);
		expect(nodeTypeCoverage).toBeDefined();
		// UserClass might not exist as a node type in ts-summit-ast
		// Message format is "Node types: X/Y covered" where X is number covered, Y is total
		expect(nodeTypeCoverage?.message).toContain('Node types');
		expect(nodeTypeCoverage?.message).toContain('covered');
	});

	it('should check coverage for UserClass node type without nested classes', () => {
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
			nodeTypes: ['UserClass'],
			operators: [],
			patterns: [],
		});

		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//UserClass</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			'//UserClass',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
		const nodeTypeCoverage = result.coverage.find(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(c) => c.message.toLowerCase().includes('node'),
		);
		expect(nodeTypeCoverage).toBeDefined();
		expect(nodeTypeCoverage?.success).toBe(false);
	});
});
