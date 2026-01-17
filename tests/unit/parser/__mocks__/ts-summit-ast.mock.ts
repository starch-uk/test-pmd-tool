/**
 * @file
 * Comprehensive mock implementation for ts-summit-ast module.
 * Provides reusable mocks for all ts-summit-ast functions used in tests.
 */
import { vi } from 'vitest';
import type { ASTNode, ApexParseResult, ApexParseOptions } from 'ts-summit-ast';

/**
 * Mock source range for AST nodes.
 */
export interface MockSourceRange {
	start: { line: number; column: number };
	end: { line: number; column: number };
}

/**
 * Mock extracted comment from ts-summit-ast.
 */
export interface MockExtractedComment {
	fullText: string;
	line: number;
	column: number;
	description: string;
	nodeRelationship?:
		| 'preceding'
		| 'following'
		| 'attached'
		| 'enclosing'
		| 'annotated';
	associationConfidence?: number;
	associatedNode?: ASTNode;
	commentType?: string;
	patternMetadata?: {
		type: string;
		matches: RegExpMatchArray;
	};
}

/**
 * Mock rule match result from wouldTriggerRule.
 */
export interface MockRuleMatch {
	matches: boolean;
	errors: unknown[];
}

/**
 * Configuration for ts-summit-ast mock behavior.
 */
export interface TSSummitASTMockConfig {
	/**
	 * Whether parseApexCode should return a valid/usable AST.
	 */
	isUsable?: boolean;

	/**
	 * Custom AST node to return (if isUsable is true).
	 */
	ast?: ASTNode;

	/**
	 * Parse errors to return.
	 */
	parseErrors?: unknown[];

	/**
	 * Comments to return from extractComments.
	 */
	extractedComments?: MockExtractedComment[];

	/**
	 * Source range to return from getSourceRange.
	 */
	sourceRange?: MockSourceRange | null;

	/**
	 * Source text to return from getSourceText.
	 */
	sourceText?: string;

	/**
	 * Rule match result from wouldTriggerRule.
	 */
	ruleMatch?: MockRuleMatch;
}

/**
 * Default mock AST node (simple ClassDeclaration).
 */
const DEFAULT_MOCK_AST: ASTNode = {
	kind: 'CompilationUnit',
	children: [
		{
			kind: 'ClassDeclaration',
			name: 'TestClass',
		} as ASTNode,
	],
} as ASTNode;

/**
 * Default mock source range.
 */
const DEFAULT_SOURCE_RANGE: MockSourceRange = {
	start: { line: 1, column: 1 },
	end: { line: 1, column: 20 },
};

/**
 * Create a mock AST node.
 */
export function createMockASTNode(
	kind: string,
	overrides?: Partial<ASTNode>,
): ASTNode {
	return {
		kind,
		...overrides,
	} as ASTNode;
}

/**
 * Create a mock source range.
 */
export function createMockSourceRange(
	startLine: number,
	startColumn: number,
	endLine: number,
	endColumn: number,
): MockSourceRange {
	return {
		start: { line: startLine, column: startColumn },
		end: { line: endLine, column: endColumn },
	};
}

/**
 * Create a mock extracted comment.
 */
export function createMockExtractedComment(
	overrides?: Partial<MockExtractedComment>,
): MockExtractedComment {
	return {
		fullText: '// ❌ Violation',
		line: 1,
		column: 1,
		description: 'Violation',
		nodeRelationship: 'attached',
		associationConfidence: 1,
		associatedNode: createMockASTNode('MethodDeclaration'),
		...overrides,
	};
}

/**
 * Create a mock parse result.
 */
export function createMockParseResult(
	overrides?: Partial<ApexParseResult>,
): ApexParseResult {
	return {
		ast: DEFAULT_MOCK_AST,
		isUsable: true,
		errors: [],
		...overrides,
	} as ApexParseResult;
}

/**
 * Comprehensive ts-summit-ast mock implementation.
 * Provides configurable mocks for all ts-summit-ast functions.
 */
export class TSSummitASTMock {
	private config: TSSummitASTMockConfig = {};

	/**
	 * Configure mock behavior.
	 */
	configure(config: TSSummitASTMockConfig): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Reset mock configuration to defaults.
	 */
	reset(): void {
		this.config = {};
	}

	/**
	 * Get mock parseApexCode implementation.
	 */
	getParseApexCode(): (
		source: string,
		options?: ApexParseOptions,
	) => ApexParseResult {
		return vi.fn((source: string, options?: ApexParseOptions) => {
			const isUsable = this.config.isUsable ?? true;
			const ast = this.config.ast ?? DEFAULT_MOCK_AST;
			const errors = this.config.parseErrors ?? [];

			return createMockParseResult({
				ast: isUsable ? ast : undefined,
				isUsable,
				errors,
			});
		});
	}

	/**
	 * Get mock extractComments implementation.
	 */
	getExtractComments(): (
		ast: ASTNode,
		source: string,
		options?: {
			associateNodes?: boolean;
			includeLineComments?: boolean;
			includeBlockComments?: boolean;
			commentPatterns?: Array<{ pattern: RegExp; type: string }>;
		},
	) => MockExtractedComment[] {
		return vi.fn(
			(
				ast: ASTNode,
				source: string,
				options?: {
					associateNodes?: boolean;
					includeLineComments?: boolean;
					includeBlockComments?: boolean;
					commentPatterns?: Array<{ pattern: RegExp; type: string }>;
				},
			) => {
				if (this.config.extractedComments !== undefined) {
					return this.config.extractedComments;
				}

				// Default: extract comments from source
				const comments: MockExtractedComment[] = [];
				const lines = source.split('\n');

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i] ?? '';
					const lineNumber = i + 1;

					if (line.includes('// ❌')) {
						const match = /\/\/\s*❌\s*(.*)/.exec(line);
						const description = match?.[1]?.trim() ?? '';
						comments.push(
							createMockExtractedComment({
								fullText: line.trim(),
								line: lineNumber,
								column: (line.indexOf('//') ?? 0) + 1,
								description: description || 'Violation',
								nodeRelationship: 'attached',
								associationConfidence: 1,
								associatedNode:
									createMockASTNode('MethodDeclaration'),
							}),
						);
					}

					if (line.includes('// ✅')) {
						const match = /\/\/\s*✅\s*(.*)/.exec(line);
						const description = match?.[1]?.trim() ?? '';
						comments.push(
							createMockExtractedComment({
								fullText: line.trim(),
								line: lineNumber,
								column: (line.indexOf('//') ?? 0) + 1,
								description: description || 'Valid',
								nodeRelationship: 'attached',
								associationConfidence: 1,
								associatedNode:
									createMockASTNode('MethodDeclaration'),
							}),
						);
					}

					if (line.includes('// Violation:')) {
						const match = /\/\/\s*Violation:\s*(.*)/.exec(line);
						const description = match?.[1]?.trim() ?? '';
						comments.push(
							createMockExtractedComment({
								fullText: line.trim(),
								line: lineNumber,
								column: 1,
								description: description || 'Violation',
								commentType: 'violation',
							}),
						);
					}

					if (line.includes('// Valid:')) {
						const match = /\/\/\s*Valid:\s*(.*)/.exec(line);
						const description = match?.[1]?.trim() ?? '';
						comments.push(
							createMockExtractedComment({
								fullText: line.trim(),
								line: lineNumber,
								column: 1,
								description: description || 'Valid',
								commentType: 'valid',
							}),
						);
					}
				}

				return comments;
			},
		);
	}

	/**
	 * Get mock getSourceRange implementation.
	 */
	getGetSourceRange(): (node: ASTNode) => MockSourceRange | null {
		return vi.fn((node: ASTNode) => {
			if (this.config.sourceRange === null) {
				return null;
			}
			return this.config.sourceRange ?? DEFAULT_SOURCE_RANGE;
		});
	}

	/**
	 * Get mock getSourceText implementation.
	 */
	getGetSourceText(): (node: ASTNode, source: string) => string {
		return vi.fn((node: ASTNode, source: string) => {
			if (this.config.sourceText !== undefined) {
				return this.config.sourceText;
			}

			// Default: extract text from source based on node kind
			const sourceRange = this.config.sourceRange ?? DEFAULT_SOURCE_RANGE;
			const lines = source.split('\n');
			const startLine = sourceRange.start.line - 1;
			const endLine = sourceRange.end.line - 1;
			const startColumn = sourceRange.start.column - 1;
			const endColumn = sourceRange.end.column - 1;

			if (startLine === endLine) {
				const line = lines[startLine] ?? '';
				return line.substring(startColumn, endColumn);
			}

			const parts: string[] = [];
			if (startLine >= 0 && startLine < lines.length) {
				parts.push((lines[startLine] ?? '').substring(startColumn));
			}
			for (let i = startLine + 1; i < endLine && i < lines.length; i++) {
				parts.push(lines[i] ?? '');
			}
			if (endLine >= 0 && endLine < lines.length) {
				parts.push((lines[endLine] ?? '').substring(0, endColumn));
			}

			return parts.join('\n');
		});
	}

	/**
	 * Get mock wouldTriggerRule implementation.
	 */
	getWouldTriggerRule(): (node: ASTNode, xpath: string) => MockRuleMatch {
		return vi.fn((node: ASTNode, xpath: string) => {
			return (
				this.config.ruleMatch ?? {
					matches: true,
					errors: [],
				}
			);
		});
	}

	/**
	 * Get all mock functions as an object for use in vi.mock.
	 * Use this in vi.mock factory function with importOriginal pattern.
	 *
	 * @example
	 * ```ts
	 * vi.mock('ts-summit-ast', async (importOriginal) => {
	 *   const actual = await importOriginal<typeof import('ts-summit-ast')>();
	 *   const mock = new TSSummitASTMock();
	 *   mock.configure({ isUsable: false });
	 *   return {
	 *     ...actual,
	 *     ...mock.getMocks(),
	 *   };
	 * });
	 * ```
	 */
	getMocks(): {
		parseApexCode: ReturnType<typeof this.getParseApexCode>;
		extractComments: ReturnType<typeof this.getExtractComments>;
		getSourceRange: ReturnType<typeof this.getGetSourceRange>;
		getSourceText: ReturnType<typeof this.getGetSourceText>;
		wouldTriggerRule: ReturnType<typeof this.getWouldTriggerRule>;
	} {
		return {
			parseApexCode: this.getParseApexCode(),
			extractComments: this.getExtractComments(),
			getSourceRange: this.getGetSourceRange(),
			getSourceText: this.getGetSourceText(),
			wouldTriggerRule: this.getWouldTriggerRule(),
		};
	}
}

/**
 * Default singleton instance for global mocking.
 */
export const tsSummitASTMock = new TSSummitASTMock();
