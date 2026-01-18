/**
 * @file
 * Comparison conditional coverage checking.
 */
import type { Conditional, CoverageResult } from '../types/index.js';

const MIN_EXPRESSION_LENGTH = 0;
const MIN_COUNT = 0;
const MIN_REQUIRED_COUNT = 1;
const MIN_DEMONSTRATION_COUNT = 1;
const MIN_UNIQUE_VALUES = 1;
const ATTR_PREFIX_LENGTH = 1;

/**
 * Check if content demonstrates the comparison scenario.
 * @param attributes - Array of attribute names to check.
 * @param content - Example content to validate against.
 * @returns True if comparison is demonstrated in content.
 */
function checkComparisonDemonstration(
	attributes: readonly string[],
	content: Readonly<string>,
): boolean {
	// Look for patterns that would make the comparison true/false
	// This is a simplified check - would need more sophisticated analysis for real rules

	// Check if all attributes appear to have different values in the content
	const attrValues: Record<string, string[]> = {};

	for (const attr of attributes) {
		// Look for patterns like "BeginLine: 1" or similar in comments
		const valueMatches = content.match(
			new RegExp(`${attr}\\s*:\\s*([^\\s\\n]+)`, 'gi'),
		);
		if (valueMatches !== null) {
			// split(':') always returns at least 2 elements when regex matches (regex requires colon)
			// So [1] is always defined
			attrValues[attr] = valueMatches.map((match) => {
				const parts = match.split(':');
				// parts[1] is always defined when regex matches (regex requires colon before value)
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- split(':') with colon always has [1]
				return parts[ATTR_PREFIX_LENGTH]!.trim();
			});
		}
	}

	// If we found different values for different attributes, assume comparison is covered
	const uniqueValues = new Set(Object.values(attrValues).flat());
	return uniqueValues.size > MIN_UNIQUE_VALUES;
}

/**
 * Check coverage for comparison expressions (\@attr1 != \@attr2, etc.).
 * @param conditional - Conditional expression to check.
 * @param content - Example content to validate against.
 * @returns Coverage result for the comparison.
 */
export function checkComparisonCoverage(
	conditional: Readonly<Conditional>,
	content: Readonly<string>,
): CoverageResult {
	if (conditional.expression.length === MIN_EXPRESSION_LENGTH) {
		return {
			details: [],
			evidence: [],
			message: 'No expression to check',
			success: false,
		};
	}

	// Extract attribute names from comparison (e.g., @BeginLine != @EndLine)
	const attrMatches = conditional.expression.match(
		/@([A-Za-z][A-Za-z0-9]*)/g,
	);
	if (attrMatches === null || attrMatches.length === MIN_COUNT) {
		return {
			details: [],
			evidence: [],
			message: 'No attributes found in comparison',
			success: false,
		};
	}

	// Remove @ prefix
	const attributes = attrMatches.map((match) =>
		match.slice(ATTR_PREFIX_LENGTH),
	);

	// Check if content demonstrates the comparison scenario
	const demonstratesComparison = checkComparisonDemonstration(
		attributes,
		content,
	);

	const demonstrationCount = demonstratesComparison
		? MIN_DEMONSTRATION_COUNT
		: MIN_COUNT;
	const expressionStr = conditional.expression;

	return {
		details: [],
		evidence: [
			{
				count: demonstrationCount,
				description: `Comparison ${expressionStr} coverage`,
				required: MIN_REQUIRED_COUNT,
				type: 'valid',
			},
		],
		message: demonstratesComparison
			? `Comparison ${expressionStr} is demonstrated`
			: `Comparison ${expressionStr} not demonstrated in content`,
		success: demonstratesComparison,
	};
}
