/**
 * @file
 * Conditional coverage checking strategies.
 */
import type { Conditional, CoverageResult } from '../../../types/index.js';
import { checkComparisonCoverage } from './checkComparison.js';

/**
 * Placeholder implementations for other conditional types
 * These will be implemented as needed.
 */

/**
 * Split combined AND conditions into individual parts.
 * Handles cases like "A and B and C" by splitting on 'and' while respecting context
 * (parentheses, quotes, etc.) to avoid splitting inside nested expressions.
 * @param expression - Combined AND expression to split.
 * @returns Array of individual condition parts, or original expression if no split needed.
 */
function splitCombinedAndConditions(expression: Readonly<string>): string[] {
	const MIN_EXPRESSION_LENGTH = 0;
	const AND_KEYWORD_LENGTH = 3;
	const AND_SKIP_OFFSET = 2;
	const PREV_CHAR_OFFSET = 1;
	const START_INDEX = 0;
	const parts: string[] = [];
	let currentPart = '';
	let depth = 0;
	let inQuotes = false;
	let quoteChar = '';

	for (let i = START_INDEX; i < expression.length; i++) {
		// Loop condition ensures i < length, so expression[i] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length
		const char = expression[i]!;

		// Track quote state
		if ((char === '"' || char === "'") && !inQuotes) {
			inQuotes = true;
			quoteChar = char;
			currentPart += char;
		} else if (char === quoteChar && inQuotes) {
			inQuotes = false;
			quoteChar = '';
			currentPart += char;
		} else if (inQuotes) {
			currentPart += char;
		} else {
			// Track parentheses depth
			if (char === '(') {
				depth++;
				currentPart += char;
			} else if (char === ')') {
				depth--;
				currentPart += char;
			} else if (
				depth === START_INDEX &&
				char === 'a' &&
				i + AND_SKIP_OFFSET < expression.length &&
				expression.substring(i, i + AND_KEYWORD_LENGTH) === 'and' &&
				(i === START_INDEX ||
					/\s/.test(expression[i - PREV_CHAR_OFFSET] ?? '')) &&
				(i + AND_KEYWORD_LENGTH >= expression.length ||
					/\s/.test(expression[i + AND_KEYWORD_LENGTH] ?? ''))
			) {
				// Found 'and' at top level - split here
				const trimmed = currentPart.trim();
				if (trimmed.length > MIN_EXPRESSION_LENGTH) {
					parts.push(trimmed);
				}
				currentPart = '';
				i += AND_SKIP_OFFSET; // Skip 'and'
			} else {
				currentPart += char;
			}
		}
	}

	// Add the last part
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
function checkConditionPart(part: Readonly<string>, content: Readonly<string>): boolean {
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
		return /new\s+List\s*[<\(]/.test(contentLower);
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
	return keywords.some((keyword) => contentLower.includes(keyword.toLowerCase()));
}

/**
 * Check coverage for AND operator conditionals.
 * @param conditional - Conditional expression to check.
 * @param content - Example content to validate against.
 * @returns Coverage result for the AND operator.
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
	if (expressionLower.includes('@final') || expressionLower.includes('final')) {
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

	// Check for @Static = true() pattern - check for 'static' keyword
	if (expressionLower.includes('@static') || expressionLower.includes('static')) {
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
 * @returns Coverage result for the NOT condition.
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
 * @returns Coverage result for the OR branch.
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
 * @returns Coverage result for the IF condition.
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
 * @returns Coverage result for the quantified condition.
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
 * @returns Coverage result for the boolean function.
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
	(conditional: Readonly<Conditional>, content: Readonly<string>) => CoverageResult
> = {
	and_operator: checkAndOperatorCoverage,
	boolean_function: checkBooleanFunctionCoverage,
	comparison: checkComparisonCoverage,
	if_condition: checkIfConditionCoverage,
	not_condition: checkNotConditionCoverage,
	or_branch: checkOrBranchCoverage,
	quantified: checkQuantifiedCoverage,
};