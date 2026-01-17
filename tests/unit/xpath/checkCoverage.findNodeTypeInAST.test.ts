/**
 * @file
 * Unit tests for findNodeTypeInAST function edge cases.
 * Tests paths that require specific AST node structures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkXPathCoverage } from '../../../src/xpath/checkCoverage.js';
import type { ExampleData } from '../../../src/types/index.js';

// Mock analyzeXPath
vi.mock('../../../src/xpath/analyzeXPath.js', () => ({
	analyzeXPath: vi.fn(),
}));

// Mock ts-summit-ast to return AST with array items that have 'kind' but it's not a string
vi.mock('ts-summit-ast', async (importOriginal) => {
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import needed for mocking
	const actual = await importOriginal<typeof import('ts-summit-ast')>();
	return {
		...actual,
		parseApexCode: vi.fn(() => ({
			ast: {
				kind: 'CompilationUnit',
				children: [
					// Array item with 'kind' property that is not a string (line 240: hasKindString false)
					{ kind: 123 }, // kind is number, not string
					// Array item without 'kind' property (line 231: item check fails)
					{ name: 'test' },
					// Array item that is null (line 231: item !== null check)
					null,
					// Array item that is undefined (line 231: item !== undefined check)
					undefined,
					// Valid AST node
					{
						kind: 'MethodDeclaration',
						name: 'exampleMethod',
					},
				],
			},
			isUsable: true,
			errors: [],
		})),
	};
});

import { analyzeXPath } from '../../../src/xpath/analyzeXPath.js';

const mockedAnalyzeXPath = vi.mocked(analyzeXPath);

describe('findNodeTypeInAST edge cases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should handle array items without kind property or with non-string kind (lines 55, 63 false branches)', () => {
		// Test lines 55, 63: array items that don't pass the checks
		// Line 55 false: item is null, undefined, not object, or missing 'kind'
		// Line 63 false: item has 'kind' but it's not a string
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
				content: 'public class Test { public void exampleMethod() {} }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//MethodDeclaration', examples);

		// Should complete without errors
		// The function should skip invalid array items (null, undefined, no kind, non-string kind)
		// and find the valid MethodDeclaration
		expect(result).toBeDefined();
		expect(result.coverage).toBeDefined();
		// Should find the MethodDeclaration despite invalid array items
		expect(result.coverage[0]?.success).toBe(true);
	});
});
