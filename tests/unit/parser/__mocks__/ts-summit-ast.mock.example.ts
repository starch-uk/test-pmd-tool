/**
 * @file
 * Example usage of ts-summit-ast mock class.
 * This file demonstrates how to use TSSummitASTMock in tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	TSSummitASTMock,
	createMockASTNode,
	createMockExtractedComment,
	createMockSourceRange,
	createMockParseResult,
	type MockExtractedComment,
} from './ts-summit-ast.mock.js';

/**
 * Example 1: Basic usage with default mock behavior
 */
describe('Basic Mock Usage', () => {
	const mock = new TSSummitASTMock();

	beforeEach(() => {
		mock.reset();
	});

	it('should use default mock behavior', () => {
		vi.mock('ts-summit-ast', async (importOriginal) => {
			const actual =
				await importOriginal<typeof import('ts-summit-ast')>();
			return {
				...actual,
				...mock.getMocks(),
			};
		});

		// Now ts-summit-ast functions will use default mock behavior
		// - parseApexCode returns valid AST
		// - extractComments extracts comments from source
		// - getSourceRange returns default range
		// - etc.
	});
});

/**
 * Example 2: Custom configuration for specific test scenarios
 */
describe('Custom Mock Configuration', () => {
	const mock = new TSSummitASTMock();

	beforeEach(() => {
		mock.reset();
	});

	it('should configure mock for parsing failure scenario', () => {
		mock.configure({
			isUsable: false,
			parseErrors: [{ message: 'Parsing failed', line: 1, column: 1 }],
		});

		vi.mock('ts-summit-ast', async (importOriginal) => {
			const actual =
				await importOriginal<typeof import('ts-summit-ast')>();
			return {
				...actual,
				...mock.getMocks(),
			};
		});

		// Now parseApexCode will return isUsable: false with errors
	});

	it('should configure mock for specific comments with good associations', () => {
		const comments: MockExtractedComment[] = [
			createMockExtractedComment({
				fullText: '// ❌ Violation description',
				line: 3,
				column: 5,
				description: 'Violation description',
				nodeRelationship: 'attached',
				associationConfidence: 1,
				associatedNode: createMockASTNode('MethodDeclaration'),
			}),
		];

		mock.configure({
			extractedComments: comments,
			sourceRange: createMockSourceRange(3, 5, 3, 30),
			sourceText: 'private String field;',
		});

		vi.mock('ts-summit-ast', async (importOriginal) => {
			const actual =
				await importOriginal<typeof import('ts-summit-ast')>();
			return {
				...actual,
				...mock.getMocks(),
			};
		});

		// Now extractComments will return the configured comments
		// with good associations and confident associations
	});

	it('should configure mock for rule mismatch scenario', () => {
		mock.configure({
			ruleMatch: {
				matches: false,
				errors: [],
			},
		});

		vi.mock('ts-summit-ast', async (importOriginal) => {
			const actual =
				await importOriginal<typeof import('ts-summit-ast')>();
			return {
				...actual,
				...mock.getMocks(),
			};
		});

		// Now wouldTriggerRule will return matches: false
	});

	it('should configure mock for null source range scenario', () => {
		mock.configure({
			sourceRange: null,
		});

		vi.mock('ts-summit-ast', async (importOriginal) => {
			const actual =
				await importOriginal<typeof import('ts-summit-ast')>();
			return {
				...actual,
				...mock.getMocks(),
			};
		});

		// Now getSourceRange will return null
	});
});

/**
 * Example 3: Using singleton instance for global mocking
 */
describe('Singleton Instance Usage', () => {
	import { tsSummitASTMock } from './ts-summit-ast.mock.js';

	beforeEach(() => {
		tsSummitASTMock.reset();
	});

	it('should use singleton instance for global configuration', () => {
		tsSummitASTMock.configure({
			isUsable: true,
			extractedComments: [],
		});

		vi.mock('ts-summit-ast', async (importOriginal) => {
			const actual =
				await importOriginal<typeof import('ts-summit-ast')>();
			return {
				...actual,
				...tsSummitASTMock.getMocks(),
			};
		});
	});
});

/**
 * Example 4: Helper functions for creating mock data
 */
describe('Helper Functions', () => {
	it('should create mock AST nodes', () => {
		const node = createMockASTNode('MethodDeclaration', {
			name: 'testMethod',
		});
		expect(node.kind).toBe('MethodDeclaration');
	});

	it('should create mock source ranges', () => {
		const range = createMockSourceRange(1, 1, 1, 20);
		expect(range.start).toEqual({ line: 1, column: 1 });
		expect(range.end).toEqual({ line: 1, column: 20 });
	});

	it('should create mock extracted comments', () => {
		const comment = createMockExtractedComment({
			fullText: '// ❌ Custom violation',
			line: 5,
			column: 10,
			description: 'Custom violation',
		});
		expect(comment.line).toBe(5);
		expect(comment.column).toBe(10);
		expect(comment.description).toBe('Custom violation');
	});

	it('should create mock parse results', () => {
		const result = createMockParseResult({
			isUsable: false,
			errors: [{ message: 'Error' }],
		});
		expect(result.isUsable).toBe(false);
		expect(result.errors).toHaveLength(1);
	});
});
