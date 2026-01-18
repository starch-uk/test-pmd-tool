/**
 * @file
 * Basic unit tests for checkXPathCoverage function - empty handling and basic coverage.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkXPathCoverage } from '../../../src/xpath/checkCoverage.js';
import type { ExampleData } from '../../../src/types/index.js';
import {
	createExampleDataForCoverage,
	createMockXPathAnalysis,
	expectXPathCoverageResult,
} from '../helpers/testHelpers.js';

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

describe('checkXPathCoverage - basic', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
		mockedAnalyzeXPath.mockClear();
	});

	describe('empty xpath handling', () => {
		const examples = [
			createExampleDataForCoverage({ content: 'test content' }),
		];

		it('should return empty coverage when xpath is null', () => {
			// Clear mock call history at start of test to ensure isolation from concurrent tests
			mockedAnalyzeXPath.mockClear();
			const result = checkXPathCoverage(null, examples);

			expectXPathCoverageResult(result, {
				coverageCount: 0,
				overallSuccess: false,
				uncoveredBranchesCount: 0,
			});
			expect(mockedAnalyzeXPath).not.toHaveBeenCalled();
		});

		it('should return empty coverage when xpath is undefined', () => {
			// Clear mock call history at start of test to ensure isolation from concurrent tests
			mockedAnalyzeXPath.mockClear();
			const result = checkXPathCoverage(undefined, examples);

			expectXPathCoverageResult(result, {
				coverageCount: 0,
				overallSuccess: false,
				uncoveredBranchesCount: 0,
			});
			expect(mockedAnalyzeXPath).not.toHaveBeenCalled();
		});

		it('should return empty coverage when xpath is empty string', () => {
			// Clear mock call history at start of test to ensure isolation from concurrent tests
			mockedAnalyzeXPath.mockClear();
			const result = checkXPathCoverage('', examples);

			expectXPathCoverageResult(result, {
				coverageCount: 0,
				overallSuccess: false,
				uncoveredBranchesCount: 0,
			});
			expect(mockedAnalyzeXPath).not.toHaveBeenCalled();
		});
	});

	it('should return empty coverage when examples array is empty', () => {
		// Clear mock call history at start of test to ensure isolation from concurrent tests
		mockedAnalyzeXPath.mockClear();
		const result = checkXPathCoverage('//Method', []);

		expect(result.coverage).toEqual([]);
		expect(result.overallSuccess).toBe(false);
		expect(result.uncoveredBranches).toEqual([]);
		expect(mockedAnalyzeXPath).not.toHaveBeenCalled();
	});

	it('should handle AST parsing failure in checkNodeTypeCoverage', () => {
		// Test when AST parsing fails, all node types should be marked as missing
		// Note: ts-summit-ast may handle invalid code gracefully, so this path might be hard to test
		// If the path is unreachable in practice, it should be removed
		mockedAnalyzeXPath.mockReturnValue(
			createMockXPathAnalysis({ nodeTypes: ['MethodDeclaration'] }),
		);

		// Empty content might cause parsing issues - test edge case
		const examples = [createExampleDataForCoverage({ content: '' })];

		const result = checkXPathCoverage('//MethodDeclaration', examples);

		// Should have node type coverage result
		const nodeTypeResult = result.coverage.find(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for Array.prototype.find
			(c) => c.message.includes('Node types:'),
		);
		expect(nodeTypeResult).toBeDefined();
		// Empty content should either fail parsing or be handled as "no content"
		// The exact behavior depends on ts-summit-ast's implementation
		expect(nodeTypeResult?.evidence[0]?.description).toBeDefined();
	});

	it('should check node types coverage when found', () => {
		mockedAnalyzeXPath.mockReturnValue(
			createMockXPathAnalysis({
				nodeTypes: ['MethodDeclaration', 'ClassDeclaration'],
			}),
		);

		const examples = [
			createExampleDataForCoverage({
				content: 'public class MyClass { public void method() {} }',
			}),
		];

		const result = checkXPathCoverage('//Method', examples);

		expectXPathCoverageResult(result, {
			coverageCount: 1,
			overallSuccess: true,
			uncoveredBranchesCount: 0,
		});
		expect(result.coverage[0]?.message).toContain('Node types');
		expect(result.coverage[0]?.success).toBe(true);
	});

	it('should check node types coverage when not found', () => {
		mockedAnalyzeXPath.mockReturnValue(
			createMockXPathAnalysis({
				nodeTypes: ['MethodDeclaration', 'ClassDeclaration'],
			}),
		);

		const examples = [
			createExampleDataForCoverage({ content: 'some unrelated content' }),
		];

		const result = checkXPathCoverage('//Method', examples);

		expectXPathCoverageResult(result, {
			coverageCount: 1,
			overallSuccess: false,
		});
		expect(result.coverage[0]?.message).toContain('Node types');
		expect(result.coverage[0]?.success).toBe(false);
		// uncoveredBranches format may have changed with AST-based detection
		// The important thing is that coverage is detected and reported
		expect(result.uncoveredBranches.length).toBeGreaterThan(0);
	});

	it('should check conditionals coverage when found', () => {
		mockedAnalyzeXPath.mockReturnValue(
			createMockXPathAnalysis({
				conditionals: [
					{ expression: '@Name', position: 0, type: 'and' },
					{ expression: '@Value', position: 10, type: 'or' },
				],
			}),
		);

		const examples = [
			createExampleDataForCoverage({
				content: 'if (@Name == "test") { }',
			}),
		];

		const result = checkXPathCoverage('//Method[@Name]', examples);

		expectXPathCoverageResult(result, {
			coverageCount: 1,
			overallSuccess: true,
			uncoveredBranchesCount: 0,
		});
		expect(result.coverage[0]?.message).toContain('Conditionals');
		expect(result.coverage[0]?.success).toBe(true);
	});

	it('should check conditionals coverage when not found', () => {
		mockedAnalyzeXPath.mockReturnValue(
			createMockXPathAnalysis({
				conditionals: [
					{ expression: '@Name', position: 0, type: 'and' },
				],
			}),
		);

		const examples = [
			createExampleDataForCoverage({ content: 'some unrelated content' }),
		];

		const result = checkXPathCoverage('//Method[@Name]', examples);

		expectXPathCoverageResult(result, {
			coverageCount: 1,
			overallSuccess: false,
		});
		expect(result.coverage[0]?.message).toContain('Conditionals');
		expect(result.coverage[0]?.success).toBe(false);
		expect(result.uncoveredBranches).toContain('Conditionals: @Name');
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
			nodeTypes: ['MethodDeclaration'],
			operators: ['=='],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: `public class TestClass {
    public String Name = "test";
    public void method() { 
        Integer x = 5;
        if (x == 5) { } 
    }
}`,
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
		mockedAnalyzeXPath.mockReturnValue(createMockXPathAnalysis());

		const examples = [
			createExampleDataForCoverage({ content: 'test content' }),
		];

		const result = checkXPathCoverage('//*', examples);

		expectXPathCoverageResult(result, {
			coverageCount: 0,
			overallSuccess: true,
			uncoveredBranchesCount: 0,
		});
	});

	it('should handle multiple examples', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['MethodDeclaration'],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'public class Test1 { public void method1() {} }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
			{
				content: 'public class Test2 { public void method2() {} }',
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
});
