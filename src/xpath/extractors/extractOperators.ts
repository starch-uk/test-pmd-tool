/**
 * Extract operators from XPath expression
 * @param xpath - XPath expression to analyze
 * @returns Array of unique operators found
 */
export function extractOperators(xpath: string): string[] {
	if (!xpath) return [];

	const operators = new Set<string>();

	// Match @Op='value' patterns
	const opMatches = xpath.matchAll(/@Op\s*=\s*['"]([^'"]+)['"]/g);

	for (const match of opMatches) {
		operators.add(match[1]);
	}

	return Array.from(operators);
}
