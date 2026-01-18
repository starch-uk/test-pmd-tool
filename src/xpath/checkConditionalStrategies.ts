/**
 * @file
 * Conditional coverage checking strategies.
 */
import type { Conditional, CoverageResult } from '../types/index.js';
import { checkComparisonCoverage } from './checkComparison.js';

/**
 * Placeholder implementations for other conditional types
 * These will be implemented as needed.
 */

/**
 * Check if character is a quote character.
 * @param char - Character to check for quote.
 * @returns True if character is a quote character (single or double quote).
 */
function isQuote(char: string): boolean {
	return char === '"' || char === "'";
}

/**
 * Update quote state when processing a character.
 * @param char - Current character.
 * @param inQuotes - Current quote state.
 * @param quoteChar - Current quote character.
 * @returns Updated quote state and quote character.
 */
function updateQuoteState(
	char: Readonly<string>,
	inQuotes: Readonly<boolean>,
	quoteChar: string,
): { inQuotes: boolean; quoteChar: string } {
	if (isQuote(char) && !inQuotes) {
		return { inQuotes: true, quoteChar: char };
	}
	if (char === quoteChar && inQuotes) {
		return { inQuotes: false, quoteChar: '' };
	}
	return { inQuotes, quoteChar };
}

/**
 * Check if 'and' keyword is found at current position.
 * @param expression - Full expression string to search.
 * @param i - Current index position in expression.
 * @param depth - Current parentheses depth counter.
 * @returns True if 'and' keyword found at top level.
 */
function isAndKeywordAtTopLevel(
	expression: Readonly<string>,
	i: Readonly<number>,
	depth: Readonly<number>,
): boolean {
	const AND_KEYWORD_LENGTH = 3;
	const AND_SKIP_OFFSET = 2;
	const PREV_CHAR_OFFSET = 1;
	const START_INDEX = 0;

	if (
		depth === START_INDEX &&
		expression[i] === 'a' &&
		i + AND_SKIP_OFFSET < expression.length &&
		expression.substring(i, i + AND_KEYWORD_LENGTH) === 'and' &&
		(i === START_INDEX ||
			/\s/.test(expression[i - PREV_CHAR_OFFSET] ?? '')) &&
		(i + AND_KEYWORD_LENGTH >= expression.length ||
			/\s/.test(expression[i + AND_KEYWORD_LENGTH] ?? ''))
	) {
		return true;
	}
	return false;
}

/**
 * Process character in expression parsing, updating state.
 * @param char - Current character being processed.
 * @param i - Current index position in expression.
 * @param expression - Full expression string being parsed.
 * @param depth - Current parentheses nesting depth.
 * @param inQuotes - Current quote state flag.
 * @param currentPart - Current part string being built.
 * @param parts - Array of completed condition parts.
 * @returns Updated parsing state with new depth, quote state, and parts.
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function processes expression character with necessary context: char, index, expression, depth, quote state, current part, and parts array
function processExpressionChar(
	char: Readonly<string>,
	i: Readonly<number>,
	expression: Readonly<string>,
	depth: Readonly<number>,
	inQuotes: Readonly<boolean>,
	currentPart: string,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array is mutated via push()
	parts: string[],
): {
	currentPart: string;
	depth: number;
	inQuotes: boolean;
	skipChars: number;
} {
	const AND_SKIP_OFFSET = 2;
	const MIN_EXPRESSION_LENGTH = 0;

	const DEPTH_INCREMENT = 1;
	const DEPTH_DECREMENT = 1;
	const NO_SKIP = 0;
	if (char === '(') {
		return {
			currentPart: currentPart + char,
			depth: depth + DEPTH_INCREMENT,
			inQuotes,
			skipChars: NO_SKIP,
		};
	}
	if (char === ')') {
		return {
			currentPart: currentPart + char,
			depth: depth - DEPTH_DECREMENT,
			inQuotes,
			skipChars: NO_SKIP,
		};
	}
	if (isAndKeywordAtTopLevel(expression, i, depth)) {
		const trimmed = currentPart.trim();
		const hasContent = trimmed.length > MIN_EXPRESSION_LENGTH;
		if (hasContent) {
			parts.push(trimmed);
		}
		return {
			currentPart: '',
			depth,
			inQuotes,
			skipChars: AND_SKIP_OFFSET,
		};
	}
	return {
		currentPart: currentPart + char,
		depth,
		inQuotes,
		skipChars: 0,
	};
}

/**
 * Split combined AND conditions into individual parts.
 * Handles cases like "A and B and C" by splitting on 'and' while respecting context
 * (parentheses, quotes, etc.) to avoid splitting inside nested expressions.
 * @param expression - Combined AND expression to split.
 * @returns Array of individual condition parts, or original expression if no split needed.
 */
function splitCombinedAndConditions(expression: Readonly<string>): string[] {
	const MIN_EXPRESSION_LENGTH = 0;
	const START_INDEX = 0;
	const parts: string[] = [];
	let currentPart = '';
	let depth = 0;
	let inQuotes = false;
	let quoteChar = '';

	for (let i = START_INDEX; i < expression.length; i++) {
		// split() and array access within bounds check ensure char is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length
		const char = expression[i]!;
		const quoteState = updateQuoteState(char, inQuotes, quoteChar);
		const { inQuotes: newInQuotes, quoteChar: newQuoteChar } = quoteState;
		inQuotes = newInQuotes;
		quoteChar = newQuoteChar;

		if (inQuotes && quoteState.inQuotes) {
			currentPart += char;
			continue;
		}

		const state = processExpressionChar(
			char,
			i,
			expression,
			depth,
			inQuotes,
			currentPart,
			parts,
		);
		({ currentPart, depth, inQuotes } = state);
		i += state.skipChars;
	}

	const trimmed = currentPart.trim();
	if (trimmed.length > MIN_EXPRESSION_LENGTH) {
		parts.push(trimmed);
	}

	return parts.length > START_INDEX ? parts : [expression];
}

/**
 * Check if a single condition part is covered in content.
 * @param part - Single condition part (e.g., "@FullMethodName = $var" or ".//NodeType").
 * @param content - Example content to validate against.
 * @returns True if the part is covered.
 */
function checkConditionPart(
	part: Readonly<string>,
	content: Readonly<string>,
): boolean {
	const MIN_EXPRESSION_LENGTH = 0;
	const ATTR_MATCH_INDEX = 1;
	const NODE_TYPE_MATCH_INDEX = 1;
	const contentLower = content.toLowerCase();
	const partLower = part.toLowerCase().trim();

	// Check for attribute comparisons like @FullMethodName = $var or @Name = "value"
	// Look for method calls that would match this pattern
	const attrPattern = /@\w+\s*=\s*(\$|["'])/;
	if (attrPattern.test(part)) {
		// Extract the attribute name (e.g., "FullMethodName" from "@FullMethodName = $var")
		const attrRegex = /@(\w+)/;
		const attrMatch = attrRegex.exec(part);
		// Regex capture group (\w+) requires at least one word character, so match[1] is always defined when regex matches
		// Since we're inside if (attrPattern.test(part)), attrMatch cannot be null
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture group ensures match[1] is defined, test() ensures match is not null
		const attrName = attrMatch![ATTR_MATCH_INDEX]!;
		// For FullMethodName, check for method calls
		if (attrName.toLowerCase() === 'fullmethodname') {
			return /\w+\.\w+\s*\(/.test(content);
		}
		// For MethodName, check for method calls
		if (attrName.toLowerCase() === 'methodname') {
			return /\w+\s*\(/.test(content);
		}
		// For Name attribute with quoted value, check if the value appears in content
		const quotedValueRegex = /["']([^"']+)["']/;
		const quotedValueMatch = quotedValueRegex.exec(part);
		const quotedValue = quotedValueMatch?.[ATTR_MATCH_INDEX];
		if (quotedValue !== undefined) {
			return contentLower.includes(quotedValue.toLowerCase());
		}
		// For other attributes, use generic pattern matching
		return true; // Assume covered if pattern matches
	}

	// Check for node type patterns like .//NewListLiteralExpression or //MethodCallExpression
	const nodeTypePattern = /\.?\/\/[A-Z]/;
	if (nodeTypePattern.test(part)) {
		// Extract node type name
		const nodeTypeRegex = /\.?\/\/([A-Z][a-zA-Z]*)/;
		const nodeTypeMatch = nodeTypeRegex.exec(part);
		// Regex capture group ([A-Z][a-zA-Z]*) requires at least one character, so match[1] is always defined when regex matches
		// Since we're inside if (nodeTypePattern.test(part)), nodeTypeMatch cannot be null
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture group ensures match[1] is defined, test() ensures match is not null
		const nodeType = nodeTypeMatch![NODE_TYPE_MATCH_INDEX]!;
		// Use similar heuristics as checkNodeTypeCoverage
		if (nodeType === 'NewListLiteralExpression') {
			// Look for list literals: new List<...>() or new List()
			return /new\s+List\s*[<\(]/.test(contentLower);
		}
		if (nodeType === 'MethodCallExpression') {
			return /\w+\s*\(/.test(content);
		}
		// Generic check: look for the node type name in content
		return contentLower.includes(nodeType.toLowerCase());
	}

	// Check for specific patterns
	if (partLower.includes('newlistliteralexpression')) {
		// Use case-insensitive regex to match "new List" or "new list" in content
		return /new\s+list\s*[<\(]/i.test(content);
	}

	// Generic keyword check
	const keywords = part
		.split(/[=<>!()\[\]\/\.@\$]+/)
		.map((s) => s.trim())
		.filter(
			(s) =>
				s.length > MIN_EXPRESSION_LENGTH &&
				!s.startsWith('@') &&
				s !== 'and' &&
				s !== 'or' &&
				s !== 'not',
		);
	return keywords.some((keyword) =>
		contentLower.includes(keyword.toLowerCase()),
	);
}

/**
 * Check coverage for AND operator conditionals.
 * Validates that both sides of an AND expression are covered in example content.
 * @param conditional - Conditional expression to check.
 * @param content - Example content to validate against.
 * @returns Result indicating whether both sides of the AND expression are present in the content.
 */
function checkAndOperatorCoverage(
	conditional: Readonly<Conditional>,
	content: Readonly<string>,
): CoverageResult {
	const MIN_EXPRESSION_LENGTH = 0;
	const MIN_COUNT = 0;
	const MIN_REQUIRED_COUNT = 1;

	if (conditional.expression.length === MIN_EXPRESSION_LENGTH) {
		return {
			details: [],
			evidence: [],
			message: 'No expression to check',
			success: false,
		};
	}

	const contentLower = content.toLowerCase();
	const expressionLower = conditional.expression.toLowerCase();

	// Check for common patterns in AND conditions
	// Look for @Final = true() pattern - check for 'final' keyword
	if (
		expressionLower.includes('@final') ||
		expressionLower.includes('final')
	) {
		const hasFinal = contentLower.includes('final');
		return {
			details: [],
			evidence: [
				{
					count: hasFinal ? MIN_REQUIRED_COUNT : MIN_COUNT,
					description: `AND condition "${conditional.expression}" coverage`,
					required: MIN_REQUIRED_COUNT,
					type: 'valid',
				},
			],
			message: hasFinal
				? `AND condition "${conditional.expression}" is covered`
				: `AND condition "${conditional.expression}" not covered - missing 'final' keyword`,
			success: hasFinal,
		};
	}

	// Check for @Static = true() pattern - validate 'static' keyword coverage
	if (
		expressionLower.includes('@static') ||
		expressionLower.includes('static')
	) {
		const hasStatic = contentLower.includes('static');
		return {
			details: [],
			evidence: [
				{
					count: hasStatic ? MIN_REQUIRED_COUNT : MIN_COUNT,
					description: `AND condition "${conditional.expression}" coverage`,
					required: MIN_REQUIRED_COUNT,
					type: 'valid',
				},
			],
			message: hasStatic
				? `AND condition "${conditional.expression}" is covered`
				: `AND condition "${conditional.expression}" not covered - missing 'static' keyword`,
			success: hasStatic,
		};
	}

	// Check if expression contains multiple 'and' conditions
	// If so, split and check each part individually
	const parts = splitCombinedAndConditions(conditional.expression);
	const MIN_PARTS_FOR_SPLIT = 2;
	if (parts.length >= MIN_PARTS_FOR_SPLIT) {
		// Multiple conditions - ALL must be satisfied
		const coveredParts: string[] = [];
		const missingParts: string[] = [];

		for (const part of parts) {
			const isCovered = checkConditionPart(part, content);
			if (isCovered) {
				coveredParts.push(part);
			} else {
				missingParts.push(part);
			}
		}

		const allCovered = missingParts.length === MIN_COUNT;
		const coveredCount = coveredParts.length;
		const totalParts = parts.length;
		return {
			details: [],
			evidence: [
				{
					count: allCovered ? MIN_REQUIRED_COUNT : MIN_COUNT,
					description: `AND condition "${conditional.expression}" coverage (${String(coveredCount)}/${String(totalParts)} parts covered)`,
					required: MIN_REQUIRED_COUNT,
					type: 'valid',
				},
			],
			message: allCovered
				? `AND condition "${conditional.expression}" is covered (all ${String(totalParts)} parts satisfied)`
				: `AND condition "${conditional.expression}" not fully covered - missing: ${missingParts.join(', ')}`,
			success: allCovered,
		};
	}

	// Single condition - use generic keyword check
	const keywords = conditional.expression
		.split(/[=<>!()\[\]]+/)
		.map((s) => s.trim())
		.filter((s) => s.length > MIN_EXPRESSION_LENGTH && !s.startsWith('@'));
	const hasKeywords = keywords.some((keyword) =>
		contentLower.includes(keyword.toLowerCase()),
	);

	return {
		details: [],
		evidence: [
			{
				count: hasKeywords ? MIN_REQUIRED_COUNT : MIN_COUNT,
				description: `AND condition "${conditional.expression}" coverage`,
				required: MIN_REQUIRED_COUNT,
				type: 'valid',
			},
		],
		message: hasKeywords
			? `AND condition "${conditional.expression}" is covered`
			: `AND condition "${conditional.expression}" not covered`,
		success: hasKeywords,
	};
}

/**
 * Check coverage for NOT condition conditionals.
 * @param conditional - Conditional expression to check.
 * @param content - Example content to validate against.
 * @returns Result indicating whether the negated condition is properly covered in the content.
 */
function checkNotConditionCoverage(
	conditional: Readonly<Conditional>,
	content: Readonly<string>,
): CoverageResult {
	const MIN_EXPRESSION_LENGTH = 0;
	const MIN_COUNT = 0;
	const MIN_REQUIRED_COUNT = 1;

	if (conditional.expression.length === MIN_EXPRESSION_LENGTH) {
		return {
			details: [],
			evidence: [],
			message: 'No expression to check',
			success: false,
		};
	}

	const contentLower = content.toLowerCase();
	const expressionLower = conditional.expression.toLowerCase();

	// Check for static final field patterns
	// NOT conditions typically exclude certain patterns, so we need to verify
	// the excluded pattern exists in the content (to test that the exclusion works)
	if (
		expressionLower.includes('fielddeclarationstatements') ||
		expressionLower.includes('field[') ||
		expressionLower.includes('ancestor::field')
	) {
		// Look for static final field declarations in the content
		// Pattern: "static final" together, typically in field declarations
		const hasStaticFinal = /static\s+final/.test(contentLower);
		const hasFieldDeclaration =
			contentLower.includes('field') ||
			/(private|public|protected)\s+(static\s+)?(final\s+)?\w+\s+\w+\s*=/.test(
				contentLower,
			);

		// For NOT conditions, we need to see the excluded pattern in the content
		// to verify the exclusion logic works correctly
		const isCovered = hasStaticFinal && hasFieldDeclaration;

		return {
			details: [],
			evidence: [
				{
					count: isCovered ? MIN_REQUIRED_COUNT : MIN_COUNT,
					description: `NOT condition "${conditional.expression}" coverage - static final fields present`,
					required: MIN_REQUIRED_COUNT,
					type: 'valid',
				},
			],
			message: isCovered
				? `NOT condition "${conditional.expression}" is covered - static final fields found`
				: `NOT condition "${conditional.expression}" not covered - missing static final field declarations`,
			success: isCovered,
		};
	}

	// Generic check: see if the negated pattern appears in content
	// For NOT conditions, the pattern being negated should appear in examples
	// to verify the negation logic works
	const keywords = conditional.expression
		.split(/[=<>!()\[\]:]+/)
		.map((s) => s.trim())
		.filter(
			(s) =>
				s.length > MIN_EXPRESSION_LENGTH &&
				!s.startsWith('@') &&
				s !== 'ancestor' &&
				s !== 'not',
		);
	const hasKeywords = keywords.some((keyword) =>
		contentLower.includes(keyword.toLowerCase()),
	);

	return {
		details: [],
		evidence: [
			{
				count: hasKeywords ? MIN_REQUIRED_COUNT : MIN_COUNT,
				description: `NOT condition "${conditional.expression}" coverage`,
				required: MIN_REQUIRED_COUNT,
				type: 'valid',
			},
		],
		message: hasKeywords
			? `NOT condition "${conditional.expression}" is covered`
			: `NOT condition "${conditional.expression}" not covered`,
		success: hasKeywords,
	};
}

/**
 * Check coverage for OR branch conditionals.
 * @param _conditional - Conditional expression to check.
 * @param _content - Example content to validate against.
 * @returns Result indicating whether at least one branch of the OR expression is covered.
 */
function checkOrBranchCoverage(
	_conditional: Readonly<Conditional>,
	_content: Readonly<string>,
): CoverageResult {
	return {
		details: [],
		evidence: [],
		message: 'Or branch coverage check not implemented',
		success: false,
	};
}

/**
 * Check coverage for IF condition conditionals.
 * @param _conditional - Conditional expression to check.
 * @param _content - Example content to validate against.
 * @returns Result indicating whether the IF condition is covered in the content.
 */
function checkIfConditionCoverage(
	_conditional: Readonly<Conditional>,
	_content: Readonly<string>,
): CoverageResult {
	return {
		details: [],
		evidence: [],
		message: 'If condition coverage check not implemented',
		success: false,
	};
}

/**
 * Check coverage for quantified conditionals.
 * @param _conditional - Conditional expression to check.
 * @param _content - Example content to validate against.
 * @returns Result indicating whether the quantified expression (e.g., forall, exists) is covered.
 */
function checkQuantifiedCoverage(
	_conditional: Readonly<Conditional>,
	_content: Readonly<string>,
): CoverageResult {
	return {
		details: [],
		evidence: [],
		message: 'Quantified condition coverage check not implemented',
		success: false,
	};
}

/**
 * Check coverage for boolean function conditionals.
 * @param _conditional - Conditional expression to check.
 * @param _content - Example content to validate against.
 * @returns Result indicating whether the boolean function call is covered in the content.
 */
function checkBooleanFunctionCoverage(
	_conditional: Readonly<Conditional>,
	_content: Readonly<string>,
): CoverageResult {
	return {
		details: [],
		evidence: [],
		message: 'Boolean function coverage check not implemented',
		success: false,
	};
}

/**
 * Strategy map for conditional coverage checkers.
 */
export const conditionalCheckers: Record<
	string,
	(
		conditional: Readonly<Conditional>,
		content: Readonly<string>,
	) => CoverageResult
> = {
	and_operator: checkAndOperatorCoverage,
	boolean_function: checkBooleanFunctionCoverage,
	comparison: checkComparisonCoverage,
	if_condition: checkIfConditionCoverage,
	not_condition: checkNotConditionCoverage,
	or_branch: checkOrBranchCoverage,
	quantified: checkQuantifiedCoverage,
};
