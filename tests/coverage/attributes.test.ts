/**
 * @file
 * Unit tests for checkXPathCoverage function - coverage for node types and attributes.
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

describe('checkXPathCoverage - coverage', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
		mockedAnalyzeXPath.mockClear();
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

		const examples = [
			{
				content: `@IsTest
public class TestClass { 
    @IsTest(SeeAllData=false)
    public void test() { }
}`,
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

	it('should check coverage for MethodName attribute', () => {
		const examples = [
			{
				content:
					'public class Test { public void exampleMethod() { Helper.helperMethod(); } }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['MethodName'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['MethodDeclaration'],
			operators: [],
			patterns: [],
		});

		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@MethodName = 'exampleMethod']</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			'//Method[@MethodName = "exampleMethod"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
	});

	it('should check coverage for Value attribute', () => {
		const examples = [
			{
				content: '@IsTest(isParallel=true) public class TestClass {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Value'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['AnnotationParameter'],
			operators: [],
			patterns: [],
		});

		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//AnnotationParameter[@Value = 'isParallel']</value>
    </property>
  </properties>
</rule>`);

		const result = checkXPathCoverage(
			"//AnnotationParameter[@Value = 'isParallel']",
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
	});
});
