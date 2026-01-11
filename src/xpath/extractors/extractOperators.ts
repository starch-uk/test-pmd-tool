/**
 * @file
 * Operator extraction from XPath expressions.
 */

const MATCH_INDEX = 1;
const MIN_STRING_LENGTH = 0;

/**
 * Extract operators from XPath expression.
 * @param xpath - XPath expression to analyze.
 * @returns Array of unique operators found.
 */
export function extractOperators(xpath: string): string[] {
	if (xpath.length === MIN_STRING_LENGTH) return [];

	const operators = new Set<string>();

	// Match @Op='value' patterns
	const opMatches = xpath.matchAll(/@Op\s*=\s*['"]([^'"]+)['"]/g);

	for (const match of opMatches) {
		// Regex capture group ([^'"]+) requires at least one character, so match[1] is always defined and length > 0
		const operator = match[MATCH_INDEX];
		operators.add(operator);
	}

	return Array.from(operators);
}
