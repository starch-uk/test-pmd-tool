import type { Conditional } from '../../types/index.js';

/**
 * Extract conditionals from XPath expression
 * @param xpath - XPath expression to analyze
 * @returns Array of conditional objects found
 */
export function extractConditionals(xpath: string): Conditional[] {
	if (!xpath) return [];

	const conditionals: Conditional[] = [];

	// Extract 'not' conditions
	const notMatches = xpath.matchAll(/not\s*\(([^)]+)\)/g);
	for (const match of notMatches) {
		conditionals.push({
			type: 'not',
			expression: match[1].trim(),
			position: match.index,
		});
	}

	// Extract 'and' conditions
	const andMatches = xpath.matchAll(/and\s+([^[\]]+)(?=\s*\])/g);
	for (const match of andMatches) {
		conditionals.push({
			type: 'and',
			expression: match[1].trim(),
			position: match.index,
		});
	}

	// Extract 'or' conditions
	const orMatches = xpath.matchAll(/or\s+([^[\]]+)(?=\s*\])/g);
	for (const match of orMatches) {
		conditionals.push({
			type: 'or',
			expression: match[1].trim(),
			position: match.index,
		});
	}

	return conditionals;
}
