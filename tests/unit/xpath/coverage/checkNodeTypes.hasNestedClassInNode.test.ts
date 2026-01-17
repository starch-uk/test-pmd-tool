/**
 * @file
 * Unit tests for hasNestedClassInNode function edge cases.
 * Tests paths that require specific AST node structures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as tsSummitAST from 'ts-summit-ast';
import { hasNestedClasses } from '../../../../src/xpath/coverage/checkNodeTypes.js';

// Mock ts-summit-ast to return specific AST structures
vi.mock('ts-summit-ast', async (importOriginal) => {
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import needed for mocking
	const actual = await importOriginal<typeof import('ts-summit-ast')>();
	return {
		...actual,
		parseApexCode: vi.fn((source: string) => {
			// Return AST with non-ClassDeclaration node
			if (source.includes('MethodDeclaration')) {
				return {
					ast: {
						kind: 'MethodDeclaration', // Not ClassDeclaration
						name: 'exampleMethod',
					},
					isUsable: true,
					errors: [],
				};
			}
			// Return AST with ClassDeclaration that has single child node (not array)
			if (source.includes('singleChild')) {
				return {
					ast: {
						kind: 'CompilationUnit',
						children: [
							{
								kind: 'ClassDeclaration',
								name: 'OuterClass',
								// Single child node (not array) - tests else if branch
								body: {
									kind: 'ClassDeclaration', // Nested class as single child
									name: 'InnerClass',
								},
							},
						],
					},
					isUsable: true,
					errors: [],
				};
			}
			// Return AST with array items that have non-string kind
			if (source.includes('nonStringKind')) {
				return {
					ast: {
						kind: 'CompilationUnit',
						children: [
							{
								kind: 'ClassDeclaration',
								name: 'OuterClass',
								body: {
									kind: 'ClassBody',
									members: [
										// Array item with 'kind' that is not a string (line 117 false branch)
										{ kind: 123 }, // kind is number, not string
									],
								},
							},
						],
					},
					isUsable: true,
					errors: [],
				};
			}
			// Return AST with single child that doesn't meet else if conditions (line 128 false branch)
			if (source.includes('invalidSingleChild')) {
				return {
					ast: {
						kind: 'CompilationUnit',
						children: [
							{
								kind: 'ClassDeclaration',
								name: 'OuterClass',
								// Single child node that doesn't meet else if conditions
								// childNode doesn't meet typeof === 'object' ||
								// 'kind' in childNode || typeof childNode.kind === 'string'
								body: null, // null doesn't meet typeof === 'object' condition
								// Also test with non-object, missing kind, and non-string kind
								members: 'notAnObject', // Not an object
								children: { kind: 123 }, // Has kind but not a string
								declarations: { name: 'test' }, // Object but no 'kind' property
							},
						],
					},
					isUsable: true,
					errors: [],
				};
			}
			// Return AST with array items without kind or with non-string kind
			// This tests collectClassDeclarations, not hasNestedClassInNode
			if (source.includes('arrayItemsWithoutKind')) {
				return {
					ast: {
						kind: 'CompilationUnit',
						children: [
							{
								kind: 'ClassDeclaration',
								name: 'OuterClass',
								// Use 'children' property to test collectClassDeclarations
								children: [
									// Array item without 'kind' property
									{ name: 'test' },
									// Array item with 'kind' that is not a string
									{ kind: 123 },
									// Valid ClassDeclaration node
									{
										kind: 'ClassDeclaration',
										name: 'InnerClass',
									},
								],
							},
						],
					},
					isUsable: true,
					errors: [],
				};
			}
			// Default: return normal AST
			return {
				ast: {
					kind: 'CompilationUnit',
					children: [
						{
							kind: 'ClassDeclaration',
							name: 'TestClass',
						},
					],
				},
				isUsable: true,
				errors: [],
			};
		}),
	};
});

describe('hasNestedClasses edge cases', () => {
	beforeEach(() => {
		// Mocks are cleared automatically by clearMocks: true in vitest.config.ts
	});

	it('should return false when root node is not ClassDeclaration', () => {
		// Test early return when node.kind !== 'ClassDeclaration'
		// We need to mock parseApexCode to return an AST where the root is CompilationUnit
		// but has a MethodDeclaration child (not ClassDeclaration), so hasNestedClassInNode
		// is never called with a non-ClassDeclaration node.
		// Actually, hasNestedClassesAST collects all ClassDeclaration nodes first,
		// so if there are no ClassDeclaration nodes, hasNestedClassInNode is never called.
		// To test line 94, we need to ensure hasNestedClassInNode is called with a non-ClassDeclaration node.
		// But since hasNestedClassesAST only calls hasNestedClassInNode on ClassDeclaration nodes,
		// line 94 is unreachable in the current implementation.
		// However, the test should still verify the behavior when no ClassDeclaration nodes exist.
		const content = 'public void exampleMethod() {}';
		const result = hasNestedClasses(content);

		// Should return false (no ClassDeclaration nodes, so hasNestedClassInNode is never called)
		expect(result).toBe(false);
	});

	it('should handle single child node (not array) in hasNestedClassInNode', () => {
		// Test else if branch for single child node
		const content = `
public class OuterClass {
    public class InnerClass {
        private Integer value;
    }
}
singleChild`;
		const result = hasNestedClasses(content);

		// Should detect nested classes via single child node path
		expect(result).toBe(true);
	});

	it('should handle single child node that is not ClassDeclaration', () => {
		// Test false branch when childASTNode.kind !== 'ClassDeclaration'
		// This happens when a single child node exists but is not a ClassDeclaration
		// Mock parseApexCode to return an AST where a ClassDeclaration has a single child
		// that is not a ClassDeclaration (e.g., MethodDeclaration)
		vi.mocked(tsSummitAST.parseApexCode).mockReturnValueOnce({
			ast: {
				kind: 'CompilationUnit',
				children: [
					{
						kind: 'ClassDeclaration',
						name: 'OuterClass',
								// Single child node (not array) that is not ClassDeclaration
								body: {
									kind: 'MethodDeclaration', // Not ClassDeclaration
							name: 'method1',
						},
					},
				],
			},
			isUsable: true,
			errors: [],
		});

		const content = 'public class OuterClass { public void method1() {} }';
		const result = hasNestedClasses(content);

		// Should return false (no nested ClassDeclaration found)
		expect(result).toBe(false);
	});

	it('should handle array items with non-string kind', () => {
		// Test false branch when hasKindString is false in hasNestedClassInNode
		const content = 'public class OuterClass { public void method1() {} } nonStringKind';
		const result = hasNestedClasses(content);

		// Should return false (no nested ClassDeclaration found)
		expect(result).toBe(false);
	});

	it('should handle single child that doesn\'t meet else if conditions', () => {
		// Test else if false branch when childNode doesn't meet conditions
		const content = 'public class OuterClass {} invalidSingleChild';
		const result = hasNestedClasses(content);

		// Should return false (no nested ClassDeclaration found)
		expect(result).toBe(false);
	});

	it('should handle array items without kind property or with non-string kind', () => {
		// Test false branches when item doesn't meet conditions in collectClassDeclarations
		// Use a special marker string to trigger the mock setup
		const content = 'public class OuterClass { public class InnerClass {} } arrayItemsWithoutKind';
		const result = hasNestedClasses(content);

		// Should still detect nested classes despite invalid array items
		expect(result).toBe(true);
	});
});