/**
 * @file
 * Unit tests for findNodeTypes module edge cases.
 * Tests paths for undefined AST and nodes without kind property.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Test mocks require unsafe assignment */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock analyzeXPath
vi.mock('../../../src/xpath/analyzeXPath.js', () => ({
	analyzeXPath: vi.fn(),
}));

// Mock ts-summit-ast to test edge cases
vi.mock('ts-summit-ast', async (importOriginal) => {
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import needed for mocking
	const actual = await importOriginal<typeof import('ts-summit-ast')>();
	const parseApexCodeMock = vi.fn();
	return {
		...actual,
		parseApexCode: parseApexCodeMock,
	};
});

// Import mocked modules after all vi.mock() declarations
// Per VITEST.md, vi.mock() is hoisted, so imports get the mocked version
import * as tsSummitAST from 'ts-summit-ast';
import type { ExampleData } from '../../src/types/index.js';
import * as analyzeXPathModule from '../../src/xpath/analyzeXPath.js';
import { checkXPathCoverage } from '../../src/xpath/checkCoverage.js';
import { findNodeTypeInAST } from '../../src/xpath/findNodeTypes.js';

// Use vi.spyOn per VITEST.md "Spy on Export" pattern to get typed mock access
const mockedAnalyzeXPath = vi.spyOn(analyzeXPathModule, 'analyzeXPath');
const mockedParseApexCode = vi.mocked(tsSummitAST.parseApexCode);

describe('findNodeTypes edge cases', () => {
	beforeEach(() => {
		mockedAnalyzeXPath.mockClear();
		mockedParseApexCode.mockClear();
	});

	it('should handle undefined AST from parseApexCode', () => {
		// Test line 122 in findNodeTypes.ts when ast is undefined
		mockedParseApexCode.mockReturnValue({
			ast: undefined, // Return undefined ast to test line 122
			isUsable: false,
			errors: [],
		});

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
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//MethodDeclaration', examples);

		// Should have node type coverage result with parsing failure message
		const nodeTypeResult = result.coverage.find(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(c) => c.message.includes('Node types:'),
		);
		expect(nodeTypeResult).toBeDefined();
		// Should indicate AST parsing failed
		expect(nodeTypeResult?.evidence[0]?.description).toBe(
			'Cannot check node types - AST parsing failed',
		);
	});

	it('should handle node without kind property in findNodeTypeInAST', () => {
		// Test line 34 in findNodeTypes.ts when node doesn't have kind property
		// This tests the guard clause: typeof node !== 'object' || !('kind' in node)
		// Put node without kind in an array so it bypasses the check at lines 67-69
		// and reaches the guard clause at line 34
		mockedParseApexCode.mockReturnValue({
			ast: {
				kind: 'CompilationUnit',
				children: [
					{
						kind: 'ClassDeclaration',
						name: 'TestClass',
						// Add array with item that doesn't have 'kind'
						// This will be passed to findNodeTypeInAST at line 62 without kind check
						members: [
							// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Test requires node without kind property
							{
								name: 'member', // No 'kind' property - will hit guard clause
							} as unknown as typeof tsSummitAST.ASTNode,
						],
					},
				],
			},
			isUsable: true,
			errors: [],
		});

		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['NonExistentNodeType'],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'public class TestClass {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//NonExistentNodeType', examples);

		// Should handle node without kind property gracefully
		expect(result).toBeDefined();
		expect(result.coverage).toBeDefined();
		// Should not find NonExistentNodeType, but should handle node without kind without error
		const nodeTypeResult = result.coverage.find(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(c) => c.message.includes('Node types:'),
		);
		expect(nodeTypeResult).toBeDefined();
		expect(nodeTypeResult?.success).toBe(false);
	});

	it('should handle node without kind property when calling findNodeTypeInAST directly', () => {
		// Test line 34 in findNodeTypes.ts when node doesn't have kind property
		// This tests the guard clause: typeof node !== 'object' || !('kind' in node)
		// Call findNodeTypeInAST directly with a node that doesn't have 'kind'
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Test requires node without kind property
		const nodeWithoutKind = {
			name: 'test', // No 'kind' property
		} as unknown as typeof tsSummitAST.ASTNode;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Test requires bypassing type checks
		const result = findNodeTypeInAST(nodeWithoutKind, 'SomeNodeType');

		// Should return false when node doesn't have kind property
		expect(result).toBe(false);
	});
});
