/**
 * @file
 * Unit tests for extractMarkers function with AST associations.
 * Tests paths that require ts-summit-ast to return comments with associated nodes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	TSSummitASTMock,
	createMockASTNode,
	createMockExtractedComment,
	createMockSourceRange,
} from './__mocks__/ts-summit-ast.mock.js';

// Mock ts-summit-ast at the top level using hoisted factory
// Note: mock variable cannot be accessed in vi.mock due to hoisting
// So we create a new mock instance in the factory
vi.mock('ts-summit-ast', async (importOriginal) => {
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import needed for mocking
	const actual = await importOriginal<typeof import('ts-summit-ast')>();
	const mockInstance = new TSSummitASTMock();
	const mocks = mockInstance.getMocks();
	return {
		...actual,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock return values are intentionally any
		extractComments: mocks.extractComments,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock return values are intentionally any
		getSourceRange: mocks.getSourceRange,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock return values are intentionally any
		getSourceText: mocks.getSourceText,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock return values are intentionally any
		parseApexCode: mocks.parseApexCode,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock return values are intentionally any
		wouldTriggerRule: mocks.wouldTriggerRule,
	};
});

// Create mock instance for test configuration
const mock = new TSSummitASTMock();

// Import after mock setup to avoid circular dependency
// eslint-disable-next-line import/order -- Imports must come after mock setup to avoid circular dependency
import { extractMarkers } from '../../../src/parser/extractMarkers.js';
// eslint-disable-next-line import/order -- Imports must come after mock setup to avoid circular dependency
import * as tsSummitAST from 'ts-summit-ast';

describe('extractMarkers with AST associations', () => {
	beforeEach(() => {
		mock.reset();
	});

	it('should include AST information when comment has associated node with good and confident association', () => {
		// Test AST information extraction paths
		const sourceRange = createMockSourceRange(3, 5, 3, 25);
		const associatedNode = createMockASTNode('MethodDeclaration');
		const comments = [
			createMockExtractedComment({
				fullText: '// ❌ Violation description',
				line: 3,
				column: 5,
				description: 'Violation description',
				nodeRelationship: 'attached',
				associationConfidence: 1,
				associatedNode,
			}),
		];

		mock.configure({
			extractedComments: comments,
			sourceRange,
			sourceText: 'private String field;',
		});

		// Update mock implementations using spyOn
		const mockedExtractComments = vi.spyOn(tsSummitAST, 'extractComments');
		const mockedGetSourceRange = vi.spyOn(tsSummitAST, 'getSourceRange');
		const mockedGetSourceText = vi.spyOn(tsSummitAST, 'getSourceText');

		mockedExtractComments.mockImplementation(mock.getExtractComments());
		mockedGetSourceRange.mockImplementation(mock.getGetSourceRange());
		mockedGetSourceText.mockImplementation(mock.getGetSourceText());

		const content = `public class Test {
    private String field; // ❌ Violation description
}`;

		const { violationMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0]).toMatchObject({
			description: 'Inline violation marker: Violation description',
			lineNumber: 3,
			codeSpan: {
				startLine: 3,
				startColumn: 5,
				endLine: 3,
				endColumn: 25,
			},
			codeText: 'private String field;',
			astNodeType: 'MethodDeclaration',
		});
	});

	it('should include rule mismatch warning when wouldTriggerRule returns false', () => {
		// Test XPath rule verification with mismatch
		const associatedNode = createMockASTNode('MethodDeclaration');
		const comments = [
			createMockExtractedComment({
				fullText: '// ❌ Violation',
				line: 3,
				column: 5,
				description: 'Violation',
				nodeRelationship: 'attached',
				associationConfidence: 1,
				associatedNode,
			}),
		];

		mock.configure({
			extractedComments: comments,
			sourceRange: createMockSourceRange(3, 5, 3, 25),
			ruleMatch: {
				matches: false,
				errors: [],
			},
		});

		const mockedExtractComments = vi.spyOn(tsSummitAST, 'extractComments');
		const mockedGetSourceRange = vi.spyOn(tsSummitAST, 'getSourceRange');
		const mockedWouldTriggerRule = vi.spyOn(
			tsSummitAST,
			'wouldTriggerRule',
		);

		mockedExtractComments.mockImplementation(mock.getExtractComments());
		mockedGetSourceRange.mockImplementation(mock.getGetSourceRange());
		mockedWouldTriggerRule.mockImplementation(mock.getWouldTriggerRule());

		const content = `public class Test {
    private String field; // ❌ Violation
}`;

		const xpath = "//Method[@Visibility='public']";
		const { violationMarkers } = extractMarkers(content, xpath);

		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0]?.description).toContain(
			'⚠️ Rule may not trigger',
		);
	});

	it('should include AST information for annotated comments', () => {
		// Test annotated node relationship
		const associatedNode = createMockASTNode('FieldDeclaration');
		const comments = [
			createMockExtractedComment({
				fullText: '// ✅ Valid',
				line: 3,
				column: 5,
				description: 'Valid',
				nodeRelationship: 'annotated',
				associationConfidence: 0.8,
				associatedNode,
			}),
		];

		mock.configure({
			extractedComments: comments,
			sourceRange: createMockSourceRange(3, 5, 3, 20),
			sourceText: 'private Integer x;',
		});

		const mockedExtractComments = vi.spyOn(tsSummitAST, 'extractComments');
		const mockedGetSourceRange = vi.spyOn(tsSummitAST, 'getSourceRange');
		const mockedGetSourceText = vi.spyOn(tsSummitAST, 'getSourceText');

		mockedExtractComments.mockImplementation(mock.getExtractComments());
		mockedGetSourceRange.mockImplementation(mock.getGetSourceRange());
		mockedGetSourceText.mockImplementation(mock.getGetSourceText());

		const content = `public class Test {
    private Integer x; // ✅ Valid
}`;

		const { validMarkers } = extractMarkers(content);

		expect(validMarkers).toHaveLength(1);
		expect(validMarkers[0]).toMatchObject({
			astNodeType: 'FieldDeclaration',
			codeSpan: {
				startLine: 3,
				startColumn: 5,
				endLine: 3,
				endColumn: 20,
			},
			codeText: 'private Integer x;',
		});
	});

	it('should not include AST information when association is not good or confident', () => {
		// Test else branch when no good association
		const comments = [
			createMockExtractedComment({
				fullText: '// ❌ Violation',
				line: 3,
				column: 5,
				description: 'Violation',
				nodeRelationship: 'preceding',
				associationConfidence: 0.3,
				associatedNode: createMockASTNode('MethodDeclaration'),
			}),
		];

		mock.configure({
			extractedComments: comments,
		});

		const mockedExtractComments = vi.spyOn(tsSummitAST, 'extractComments');
		mockedExtractComments.mockImplementation(mock.getExtractComments());

		const content = `public class Test {
    private String field; // ❌ Violation
}`;

		const { violationMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0]).toMatchObject({
			astNodeType: undefined,
			codeSpan: undefined,
			codeText: undefined,
		});
	});

	it('should use default association confidence when associationConfidence is undefined', () => {
		// Test default association confidence when undefined
		const comments = [
			createMockExtractedComment({
				fullText: '// ❌ Violation',
				line: 3,
				column: 5,
				description: 'Violation',
				nodeRelationship: 'attached',
				associationConfidence: undefined, // undefined to test ?? operator
				associatedNode: createMockASTNode('MethodDeclaration'),
			}),
		];

		mock.configure({
			extractedComments: comments,
		});

		const mockedExtractComments = vi.spyOn(tsSummitAST, 'extractComments');
		mockedExtractComments.mockImplementation(mock.getExtractComments());

		const content = `public class Test {
    private String field; // ❌ Violation
}`;

		const { violationMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		// Should not include AST info because default confidence (0) < threshold (0.5)
		expect(violationMarkers[0]).toMatchObject({
			astNodeType: undefined,
			codeSpan: undefined,
			codeText: undefined,
		});
	});

	it('should handle section markers with empty description match', () => {
		// Test section marker description extraction when matchGroup is undefined or empty
		const comments = [
			createMockExtractedComment({
				fullText: '// Violation:',
				line: 2,
				column: 1,
				description: '',
				commentType: 'violation',
			}),
		];

		mock.configure({
			extractedComments: comments,
		});

		const mockedExtractComments = vi.spyOn(tsSummitAST, 'extractComments');
		mockedExtractComments.mockImplementation(mock.getExtractComments());

		const content = `// Violation:
public class Test {
    private Integer value = 42;
}`;

		const { violationMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		// When descriptionText is empty, should use default 'Violation'
		expect(violationMarkers[0]?.description).toBe('Violation');
	});

	it('should handle violation markers with XPath when rule matches', () => {
		// Test XPath provided but rule matches
		const associatedNode = createMockASTNode('MethodDeclaration');
		const comments = [
			createMockExtractedComment({
				fullText: '// ❌ Violation',
				line: 3,
				column: 5,
				description: 'Violation',
				nodeRelationship: 'attached',
				associationConfidence: 1,
				associatedNode,
			}),
		];

		mock.configure({
			extractedComments: comments,
			sourceRange: createMockSourceRange(3, 5, 3, 25),
			ruleMatch: {
				matches: true,
				errors: [],
			},
		});

		const mockedExtractComments = vi.spyOn(tsSummitAST, 'extractComments');
		const mockedGetSourceRange = vi.spyOn(tsSummitAST, 'getSourceRange');
		const mockedWouldTriggerRule = vi.spyOn(
			tsSummitAST,
			'wouldTriggerRule',
		);

		mockedExtractComments.mockImplementation(mock.getExtractComments());
		mockedGetSourceRange.mockImplementation(mock.getGetSourceRange());
		mockedWouldTriggerRule.mockImplementation(mock.getWouldTriggerRule());

		const content = `public class Test {
    private String field; // ❌ Violation
}`;

		const xpath = '//MethodDeclaration';
		const { violationMarkers } = extractMarkers(content, xpath);

		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0]?.description).not.toContain(
			'⚠️ Rule may not trigger',
		);
	});
});
