/**
 * @file
 * Hardcoded value extraction from XPath expressions.
 */

const MIN_STRING_LENGTH = 0;
const MATCH_FULL_INDEX = 0;
const NUMBER_VALUE_GROUP_INDEX = 1;
const QUOTE_GROUP_INDEX = 1;
const STRING_VALUE_GROUP_INDEX = 2;
const ZERO_COUNT = 0;

/**
 * Represents a hardcoded value found in XPath.
 */
export interface HardcodedValue {
	type: 'number' | 'string';
	value: string;
	position: number;
}

/**
 * Extract all hardcoded numbers and strings from XPath (excluding those in let statements).
 * @param xpath - XPath expression to analyze.
 * @returns Array of hardcoded values found.
 */
export function extractHardcodedValues(xpath: string): HardcodedValue[] {
	if (xpath.length === MIN_STRING_LENGTH) return [];

	const values: HardcodedValue[] = [];

	// Extract let statement range if it exists
	// Use the same logic as extractLetVariables for consistency
	let letStart = -1;
	let letEnd = -1;
	const letStartMatch = /let\s+/i.exec(xpath);
	if (letStartMatch?.index !== undefined) {
		letStart = letStartMatch.index;
		const letStartIndex =
			letStartMatch.index + letStartMatch[MATCH_FULL_INDEX].length;
		let inSingleQuote = false;
		let inDoubleQuote = false;
		let parenDepth = 0;

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
					// Find the end of "return" keyword
					const returnEnd = i + 'return'.length;
					letEnd = returnEnd;
					break;
				}
			}
		}
	}

	// Extract hardcoded strings (single and double quotes)
	// Exclude strings that are inside the let statement
	const stringPattern = /(['"])([^'"]*)\1/g;
	let stringMatch: RegExpExecArray | null = null;
	while ((stringMatch = stringPattern.exec(xpath)) !== null) {
		// Skip if this string is inside the let statement
		if (
			letStart >= ZERO_COUNT &&
			stringMatch.index >= letStart &&
			stringMatch.index < letEnd
		) {
			continue;
		}

		// Skip empty strings
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture group ensures match[2] exists
		const stringValue = stringMatch[STRING_VALUE_GROUP_INDEX]!;
		if (stringValue.length === MIN_STRING_LENGTH) continue;

		values.push({
			position: stringMatch.index,
			type: 'string',
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture groups ensure these exist
			value: `${stringMatch[QUOTE_GROUP_INDEX]!}${stringValue}${stringMatch[QUOTE_GROUP_INDEX]!}`,
		});
	}

	// Extract hardcoded numbers (excluding common values like 0, 1)
	// Exclude numbers that are inside the let statement
	const numberPattern = /\b([2-9]\d*|0\d+)\b/g;
	let numberMatch: RegExpExecArray | null = null;
	while ((numberMatch = numberPattern.exec(xpath)) !== null) {
		// Skip if this number is inside the let statement
		if (
			letStart >= ZERO_COUNT &&
			numberMatch.index >= letStart &&
			numberMatch.index < letEnd
		) {
			continue;
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture group ensures match[1] exists
		const numberValue = numberMatch[NUMBER_VALUE_GROUP_INDEX]!;

		values.push({
			position: numberMatch.index,
			type: 'number',
			value: numberValue,
		});
	}

	return values;
}
