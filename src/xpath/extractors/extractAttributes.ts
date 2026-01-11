/**
 * @file
 * Attribute extraction from XPath expressions.
 */

const MATCH_INDEX = 1;
const MIN_STRING_LENGTH = 0;

/**
 * Extract attribute checks from XPath expression.
 * @param xpath - XPath expression to analyze.
 * @returns Array of unique attributes found.
 */
export function extractAttributes(xpath: string): string[] {
	if (xpath.length === MIN_STRING_LENGTH) return [];

	const attributes = new Set<string>();

	// Match @AttributeName patterns (but not @Op which is handled separately)
	const attrMatches = xpath.matchAll(
		/@([A-Za-z][A-Za-z0-9]*)(?=\s|$|[\]|\)|,|\||=])/g,
	);

	for (const match of attrMatches) {
		const attr = match[MATCH_INDEX];
		// Skip @Op as it's handled by extractOperators
		if (
			attr !== undefined &&
			attr.length > MIN_STRING_LENGTH &&
			attr !== 'Op'
		) {
			attributes.add(attr);
		}
	}

	return Array.from(attributes);
}
