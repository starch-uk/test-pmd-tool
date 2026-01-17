/**
 * @file
 * Apex code parsing utilities using ts-summit-ast.
 * Uses the built-in Apex parser from ts-summit-ast for AST generation.
 */
import {
	parseApexCode as parseApexCodeImpl,
	type ApexParseOptions,
	type ApexParseResult,
} from 'ts-summit-ast';
import type { ASTNode } from 'ts-summit-ast';

/**
 * Parse Apex source code into an AST using the built-in parser from ts-summit-ast.
 * @param source - Apex source code to parse.
 * @param options - Optional parse options.
 * @returns Parse result with AST (if successful) or errors.
 */
function parseApexCode(
	source: Readonly<string>,
	options?: Readonly<ApexParseOptions>,
): ApexParseResult {
	return parseApexCodeImpl(source, {
		includeComments: true,
		includeLocation: true,
		includeSource: true,
		...options,
	});
}

/**
 * Check if a parse result is valid (has AST and is usable).
 * Trusts ts-summit-ast's isUsable flag.
 * @param result - Parse result to check.
 * @returns Type guard indicating if result is valid and has AST.
 */
function isValidParseResult(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type guard return type requires mutable parameter
	result: Readonly<ApexParseResult>,
): result is ApexParseResult & { ast: NonNullable<ASTNode> } {
	return result.isUsable === true && result.ast !== undefined;
}

export { isValidParseResult, parseApexCode };
