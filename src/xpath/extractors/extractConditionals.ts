/**
 * @file
 * Conditional extraction from XPath expressions.
 */
import type { Conditional } from '../../types/index.js';

/**
 * Extract conditionals from XPath expression.
 * @param xpath - XPath expression to analyze.
 * @returns Array of conditional objects found.
 */
export function extractConditionals(xpath: string): Conditional[] {
	const MIN_STRING_LENGTH = 0;
	if (xpath.length === MIN_STRING_LENGTH) return [];

	const conditionals: Conditional[] = [];

	const MATCH_INDEX = 1;

	// Extract 'not' conditions
	const notMatches = xpath.matchAll(/not\s*\(([^)]+)\)/g);
	for (const match of notMatches) {
		// Regex capture group ([^)]+) requires at least one character, so match[1] is always defined
		// match.index is always defined for successful matches
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture group ensures match[1] is defined
		const expression = match[MATCH_INDEX]!;
		const position = match.index;
		conditionals.push({
			expression: expression.trim(),
			position,
			type: 'not',
		});
	}

	// Extract 'and' conditions
	const andMatches = xpath.matchAll(/and\s+([^[\]]+)(?=\s*\])/g);
	for (const match of andMatches) {
		// Regex capture group ([^[\]]+) requires at least one character, so match[1] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture group ensures match[1] is defined
		const expression = match[MATCH_INDEX]!;
		const position = match.index;
		conditionals.push({
			expression: expression.trim(),
			position,
			type: 'and',
		});
	}

	// Extract 'or' conditions
	const orMatches = xpath.matchAll(/or\s+([^[\]]+)(?=\s*\])/g);
	for (const match of orMatches) {
		// Regex capture group ([^[\]]+) requires at least one character, so match[1] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture group ensures match[1] is defined
		const expression = match[MATCH_INDEX]!;
		const position = match.index;
		conditionals.push({
			expression: expression.trim(),
			position,
			type: 'or',
		});
	}

	return conditionals;
}
