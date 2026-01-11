/**
 * Extract AST node types from XPath expression
 * @param xpath - XPath expression to analyze
 * @returns Array of unique AST node types found
 */
export function extractNodeTypes(xpath: string): string[] {
	if (!xpath) return [];

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

	// Add matches to the set
	for (const match of nodeTypeMatches1) {
		nodeTypes.add(match[1]);
	}

	for (const match of nodeTypeMatches2) {
		nodeTypes.add(match[1]);
	}

	for (const match of nodeTypeMatches3) {
		nodeTypes.add(match[1]);
	}

	return Array.from(nodeTypes);
}
