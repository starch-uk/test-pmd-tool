/**
 * @file
 * Unit tests for astMarkerExtractor edge cases.
 * Tests paths that require specific AST node structures.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Test mocks require unsafe assignment */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- Test mocks require type assertions */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ts-summit-ast to test edge cases
vi.mock('ts-summit-ast', async (importOriginal) => {
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import needed for mocking
	const actual = await importOriginal<typeof import('ts-summit-ast')>();
	const extractCommentsMock = vi.fn();
	const getSourceRangeMock = vi.fn();
	const getSourceTextMock = vi.fn();
	return {
		...actual,
		extractComments: extractCommentsMock,
		getSourceRange: getSourceRangeMock,
		getSourceText: getSourceTextMock,
		parseApexCode: vi.fn(() => ({
			ast: {
				kind: 'CompilationUnit',
				children: [],
			},
			isUsable: true,
			errors: [],
		})),
	};
});

// Import mocked modules after all vi.mock() declarations
// Per VITEST.md, vi.mock() is hoisted, so imports get the mocked version
import * as tsSummitAST from 'ts-summit-ast';
import { extractMarkers } from '../../src/parser/extractMarkers.js';

const mockedExtractComments = vi.mocked(tsSummitAST.extractComments);
const mockedGetSourceRange = vi.mocked(tsSummitAST.getSourceRange);
const mockedGetSourceText = vi.mocked(tsSummitAST.getSourceText);

describe('astMarkerExtractor edge cases', () => {
	beforeEach(() => {
		mockedExtractComments.mockClear();
		mockedGetSourceRange.mockClear();
		mockedGetSourceText.mockClear();
	});

	it('should handle associatedNode without kind property', () => {
		// Test line 140 in astMarkerExtractor.ts when associatedNode doesn't have kind property
		// This tests the false branch of: if ('kind' in associatedNode)
		const associatedNodeWithoutKind = {
			name: 'test', // No 'kind' property - will hit false branch at line 140
		} as unknown as typeof tsSummitAST.ASTNode;

		mockedGetSourceRange.mockReturnValue({
			start: { line: 2, column: 5 },
			end: { line: 2, column: 20 },
		});
		mockedGetSourceText.mockReturnValue('private String field');

		mockedExtractComments.mockReturnValue([
			{
				fullText: '// ❌ Test violation',
				description: 'Test violation',
				line: 2,
				nodeRelationship: 'annotated',
				associationConfidence: 0.9,
				associatedNode: associatedNodeWithoutKind,
			},
		]);

		const content = `
public class TestClass {
    private String field; // ❌ Test violation
}
`;

		const { violationMarkers } = extractMarkers(content);

		// Should handle associatedNode without kind property gracefully
		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0]?.astNodeType).toBeUndefined(); // Should be undefined when kind is missing
		expect(violationMarkers[0]?.lineNumber).toBeDefined();
		expect(violationMarkers[0]?.codeSpan).toBeDefined(); // Should still have codeSpan even without kind
	});
});
