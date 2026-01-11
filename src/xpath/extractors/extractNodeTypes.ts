/**
 * @file
 * Node type extraction from XPath expressions.
 */

/**
 * Extract AST node types from XPath expression.
 * @param xpath - XPath expression to analyze.
 * @returns Array of unique AST node types found.
 */
export function extractNodeTypes(xpath: string): string[] {
	const MIN_STRING_LENGTH = 0;
	if (xpath.length === MIN_STRING_LENGTH) return [];

	const nodeTypes = new Set<string>();

	// Pattern 1: Match nodes ending with Statement, Expression, Declaration, Node, Block
	const nodeTypeMatches1 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)([A-Z][a-zA-Z]*(?:Statement|Expression|Declaration|Node|Block))(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 2: Match standalone AST node types: Method, Field, Class, Type, Condition, Loop, Block
	const nodeTypeMatches2 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)(Method|Field|Class|Type|Condition|Loop|Block)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 3: Match nodes containing Method/Class/Field/etc. in their names
	const nodeTypeMatches3 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)([A-Z][a-zA-Z]*(?:Method|Class|Field|Condition|Loop|Type)[a-zA-Z]*)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	const MATCH_INDEX = 1;

	// Add matches to the set
	for (const match of nodeTypeMatches1) {
		// Regex capture groups require at least one character, so match[1] is always defined and length > 0
		const nodeType = match[MATCH_INDEX];
		nodeTypes.add(nodeType);
	}

	for (const match of nodeTypeMatches2) {
		const nodeType = match[MATCH_INDEX];
		nodeTypes.add(nodeType);
	}

	for (const match of nodeTypeMatches3) {
		const nodeType = match[MATCH_INDEX];
		nodeTypes.add(nodeType);
	}

	return Array.from(nodeTypes);
}
