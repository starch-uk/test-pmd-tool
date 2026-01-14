/**
 * @file
 * Let variable extraction from XPath expressions.
 */

const MIN_STRING_LENGTH = 0;
const MATCH_FULL_INDEX = 0;
const NOT_FOUND_INDEX = -1;
const QUOTE_MATCH_GROUP_INDEX = 1;
const VALUE_MATCH_GROUP_INDEX = 2;
const ZERO_COUNT = 0;

/**
 * Represents a variable declared in a let statement.
 */
export interface LetVariable {
	name: string;
	value: string;
}

/**
 * Extract variables from XPath let statement.
 * @param xpath - XPath expression to analyze.
 * @returns Array of let variables found, or empty array if no let statement.
 */
export function extractLetVariables(xpath: string): LetVariable[] {
	if (xpath.length === MIN_STRING_LENGTH) return [];

	const variables: LetVariable[] = [];

	// Match let statement: "let $var1 = 'value', $var2 = 2 return ..."
	// Use a more robust pattern that handles multi-line and nested cases
	// Find "let" followed by content until "return" (not inside quotes)
	const letStartMatch = /let\s+/i.exec(xpath);
	if (letStartMatch?.index === undefined) {
		return variables;
	}

	const letStartIndex =
		letStartMatch.index + letStartMatch[MATCH_FULL_INDEX].length;
	let inSingleQuote = false;
	let inDoubleQuote = false;
	let parenDepth = 0;
	let declarationsEnd = NOT_FOUND_INDEX;

	// Find the matching "return" keyword, accounting for quotes and parentheses
	for (let i = letStartIndex; i < xpath.length; i++) {
		const char = xpath.charAt(i);

		if (char === "'" && !inDoubleQuote) {
			inSingleQuote = !inSingleQuote;
		} else if (char === '"' && !inSingleQuote) {
			inDoubleQuote = !inDoubleQuote;
		} else if (!inSingleQuote && !inDoubleQuote) {
			if (char === '(') {
				parenDepth++;
			} else if (char === ')') {
				parenDepth--;
			} else if (
				parenDepth === ZERO_COUNT &&
				xpath.substring(i).toLowerCase().startsWith('return')
			) {
				declarationsEnd = i;
				break;
			}
		}
	}

	if (declarationsEnd === NOT_FOUND_INDEX) {
		return variables;
	}

	// Extract the variable declarations part (between "let" and "return")
	const declarationsPart = xpath.substring(letStartIndex, declarationsEnd);

	// Parse variable declarations manually to handle complex expressions
	// Split by commas (but not inside quotes or parentheses)
	let inQuote2 = false;
	let inDoubleQuote2 = false;
	let parenDepth2 = 0;
	let currentVarStart = NOT_FOUND_INDEX;
	const varDeclarations: { start: number; end: number }[] = [];

	// Find variable declaration boundaries
	for (let i = 0; i < declarationsPart.length; i++) {
		const char = declarationsPart.charAt(i);

		if (char === "'" && !inDoubleQuote2) {
			inQuote2 = !inQuote2;
		} else if (char === '"' && !inQuote2) {
			inDoubleQuote2 = !inDoubleQuote2;
		} else if (!inQuote2 && !inDoubleQuote2) {
			if (char === '(') {
				parenDepth2++;
			} else if (char === ')') {
				parenDepth2--;
			} else if (char === '$' && parenDepth2 === ZERO_COUNT) {
				// Start of a new variable
				if (currentVarStart >= ZERO_COUNT) {
					// Save previous variable
					varDeclarations.push({ end: i, start: currentVarStart });
				}
				currentVarStart = i;
			} else if (
				char === ',' &&
				parenDepth2 === ZERO_COUNT &&
				currentVarStart >= ZERO_COUNT
			) {
				// End of current variable declaration
				varDeclarations.push({ end: i, start: currentVarStart });
				currentVarStart = NOT_FOUND_INDEX;
			}
		}
	}

	// Add the last variable if any
	if (currentVarStart >= ZERO_COUNT) {
		varDeclarations.push({
			end: declarationsPart.length,
			start: currentVarStart,
		});
	}

	// Extract variable name and value from each declaration
	// Handle both = and := (XPath 3.1 assignment operator)
	for (const decl of varDeclarations) {
		const declText = declarationsPart
			.substring(decl.start, decl.end)
			.trim();
		// Match both = and := assignment operators
		const equalsMatch = /\$([a-zA-Z_][a-zA-Z0-9_]*)\s*:?=\s*(.+)/s.exec(
			declText,
		);
		if (equalsMatch) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture groups ensure these exist
			const varName = `$${equalsMatch[QUOTE_MATCH_GROUP_INDEX]!}`;
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture groups ensure these exist
			const varValue = equalsMatch[VALUE_MATCH_GROUP_INDEX]!.trim();

			variables.push({
				name: varName,
				value: varValue,
			});
		}
	}

	return variables;
}
