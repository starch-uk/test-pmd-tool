/**
 * @file
 * Unit tests for checkXPathCoverage function.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkXPathCoverage } from '../../../src/xpath/checkCoverage.js';
import type { ExampleData } from '../../../src/types/index.js';

// Mock analyzeXPath
vi.mock('../../../src/xpath/analyzeXPath.js', () => ({
	analyzeXPath: vi.fn(),
}));

import { analyzeXPath } from '../../../src/xpath/analyzeXPath.js';

const mockedAnalyzeXPath = vi.mocked(analyzeXPath);

describe('checkXPathCoverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
		expect(result.coverage[0]?.success).toBe(true);
		expect(result.uncoveredBranches).toEqual([]);
		expect(result.overallSuccess).toBe(true);
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
		expect(result.coverage[0]?.evidence[0]?.description).toContain('none');
		expect(result.coverage[0]?.success).toBe(false);
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
		expect(result.coverage[0]?.evidence[0]?.description).toContain('none');
		expect(result.coverage[0]?.success).toBe(false);
	});
});
