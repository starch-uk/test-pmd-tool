/**
 * @file
 * Line number finding utilities for XPath coverage checking.
 * Finds line numbers in XML rule files for XPath components.
 */
import { readFileSync } from 'fs';
import type { Conditional } from '../types/index.js';

const MIN_COUNT = 0;
const NOT_FOUND_INDEX = -1;
const LINE_OFFSET = 1;

/**
 * Find line number for an attribute in the XPath within the XML file.
 * @param ruleFilePath - Path to the rule XML file.
 * @param xpath - XPath expression.
 * @param attribute - Attribute to find (e.g., "Image", "Nested").
 * @returns Line number where attribute appears, or null if not found.
 */
function findAttributeLineNumber(
	ruleFilePath: Readonly<string>,
	xpath: Readonly<string>,
	attribute: Readonly<string>,
): number | null {
	try {
		const content = readFileSync(ruleFilePath, 'utf-8');
		const lines = content.split('\n');

		// Search for @AttributeName pattern in XPath section
		const attributePattern = `@${attribute}`;

		// Find the line containing the XPath value element
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			// Check if this line contains the XPath and the attribute
			const hasXPath = line.includes('xpath');
			const hasValue = line.includes('value');
			const hasAttribute = line.includes(attributePattern);
			if (hasXPath && hasValue && hasAttribute) {
				return i + LINE_OFFSET;
			}
		}

		// If not found in a single line, search for the XPath section and then the attribute
		let inXPathSection = false;
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<property') && line.includes('name="xpath"')) {
				inXPathSection = true;
			}
			if (inXPathSection && line.includes(attributePattern)) {
				return i + LINE_OFFSET;
			}
			if (inXPathSection && line.includes('</property>')) {
				inXPathSection = false;
			}
		}

		// Fallback: find position in XPath string and estimate line
		const xpathIndex = xpath.indexOf(attributePattern);
		if (xpathIndex !== NOT_FOUND_INDEX) {
			// Find the value element and count lines
			for (let i = 0; i < lines.length; i++) {
				// split('\n') always returns a dense array, so lines[i] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
				const line = lines[i]!;
				if (line.includes('<value>')) {
					// Count newlines in XPath up to the attribute position
					const xpathBeforeAttribute = xpath.substring(
						MIN_COUNT,
						xpathIndex,
					);
					const newlineMatches = xpathBeforeAttribute.match(/\n/g);
					// match() returns null if no match, or array if match found
					// Use 0 if no matches found (null case)
					const newlineCount = newlineMatches
						? newlineMatches.length
						: MIN_COUNT;
					return i + LINE_OFFSET + newlineCount;
				}
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Find line number for a node type in the XPath within the XML file.
 * @param ruleFilePath - Path to the rule XML file.
 * @param xpath - XPath expression.
 * @param nodeType - Node type to find.
 * @returns Line number where node type appears, or null if not found.
 */
function findNodeTypeLineNumber(
	ruleFilePath: Readonly<string>,
	xpath: Readonly<string>,
	nodeType: Readonly<string>,
): number | null {
	try {
		const content = readFileSync(ruleFilePath, 'utf-8');
		const lines = content.split('\n');

		// Find the line containing the XPath value element
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			// Check if this line contains the XPath and the node type
			const hasXPath = line.includes('xpath');
			const hasValue = line.includes('value');
			const hasNodeType = line.includes(nodeType);
			if (hasXPath && hasValue && hasNodeType) {
				return i + LINE_OFFSET;
			}
		}

		// If not found in a single line, search for the XPath section and then the node type
		let inXPathSection = false;
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<property') && line.includes('name="xpath"')) {
				inXPathSection = true;
			}
			if (inXPathSection && line.includes(nodeType)) {
				return i + LINE_OFFSET;
			}
			if (inXPathSection && line.includes('</property>')) {
				inXPathSection = false;
			}
		}

		// Fallback: find position in XPath string and estimate line
		const xpathIndex = xpath.indexOf(nodeType);
		if (xpathIndex !== NOT_FOUND_INDEX) {
			// Find the value element and count lines
			for (let i = 0; i < lines.length; i++) {
				// split('\n') always returns a dense array, so lines[i] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
				const line = lines[i]!;
				if (line.includes('<value>')) {
					// Count newlines in XPath up to the node type position
					const xpathBeforeNodeType = xpath.substring(
						MIN_COUNT,
						xpathIndex,
					);
					const newlineMatches = xpathBeforeNodeType.match(/\n/g);
					// match() returns null if no match, or array if match found
					// Use 0 if no matches found (null case)
					const newlineCount = newlineMatches
						? newlineMatches.length
						: MIN_COUNT;
					return i + LINE_OFFSET + newlineCount;
				}
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Find line number for a conditional in the XPath within the XML file.
 * @param ruleFilePath - Path to the rule XML file.
 * @param xpath - XPath expression.
 * @param conditional - Conditional to find.
 * @returns Line number where conditional appears, or null if not found.
 */
function findConditionalLineNumber(
	ruleFilePath: Readonly<string>,
	xpath: Readonly<string>,
	conditional: Readonly<Conditional>,
): number | null {
	try {
		const content = readFileSync(ruleFilePath, 'utf-8');
		const lines = content.split('\n');

		// Build search pattern from conditional expression
		// Normalize whitespace for matching (replace multiple spaces with single space)
		const exprPattern = conditional.expression.trim().replace(/\s+/g, ' ');
		// For 'or' and 'and' conditionals, include the operator in the search to be more specific
		// This helps distinguish nested conditionals (e.g., 'or' inside 'and')
		// Build search pattern: operator + expression
		const searchPattern =
			conditional.type === 'or' || conditional.type === 'and'
				? `${conditional.type} ${exprPattern}`
				: exprPattern;
		const normalizedSearchPattern = searchPattern.replace(/\s+/g, ' ');

		// Find the XPath section first
		let xpathSectionStart = NOT_FOUND_INDEX;
		let inXPathSection = false;
		let xpathContentStart = NOT_FOUND_INDEX;

		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<property') && line.includes('name="xpath"')) {
				inXPathSection = true;
				xpathSectionStart = i;
			}
			if (inXPathSection && line.includes('<value>')) {
				xpathContentStart = i;
			}
			if (inXPathSection && line.includes('</property>')) {
				inXPathSection = false;
			}
		}

		// If we found the XPath section, search within it for the expression
		if (xpathSectionStart !== NOT_FOUND_INDEX) {
			// Search for the expression pattern in the XPath section
			// Search from the end backwards to find the most specific match (for nested conditionals)
			// This helps when 'or' is nested inside 'and' - we want to find the 'or' line, not the 'and' line
			const LAST_INDEX_OFFSET = 1;
			const lastLineIndex = lines.length - LAST_INDEX_OFFSET;
			for (let i = lastLineIndex; i >= xpathSectionStart; i--) {
				// split('\n') always returns a dense array, so lines[i] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
				const line = lines[i]!;
				// Normalize whitespace in the line for comparison (replace multiple spaces with single space)
				const normalizedLine = line.replace(/\s+/g, ' ');
				if (normalizedLine.includes(normalizedSearchPattern)) {
					return i + LINE_OFFSET;
				}
			}
		}

		// Fallback: find position in trimmed XPath string and estimate line
		// The xpath parameter is already trimmed, so position is relative to trimmed string
		// For 'or' and 'and', position points to the operator, so we need to find that in the XML
		const xpathIndex = conditional.position;
		if (
			xpathIndex !== NOT_FOUND_INDEX &&
			xpathContentStart !== NOT_FOUND_INDEX
		) {
			// Find where the actual XPath content starts in the XML file
			// This is after <value> and potentially after <![CDATA[
			// eslint-disable-next-line @typescript-eslint/init-declarations -- Variable is assigned in all branches below
			let actualContentStartLine;
			// Check if CDATA is used
			const NEXT_LINE_OFFSET = 1;
			const nextLineIndex = xpathContentStart + NEXT_LINE_OFFSET;
			const hasNextLine = nextLineIndex < lines.length;
			const nextLine = hasNextLine ? lines[nextLineIndex] : undefined;
			const hasCdataStart =
				hasNextLine && nextLine?.includes('<![CDATA[') === true;
			if (hasCdataStart) {
				// CDATA starts on next line, actual content starts after that
				const CDATA_CONTENT_OFFSET = 1;
				actualContentStartLine = nextLineIndex + CDATA_CONTENT_OFFSET;
			} else {
				// Content might be on the same line as <value> or next line
				// Check if <value> line contains the start of XPath content
				const valueLine = lines[xpathContentStart];
				const hasValueLine = valueLine !== undefined;
				const valueLineEndsWithTag =
					hasValueLine && valueLine.trim().endsWith('<value>');
				if (hasValueLine && !valueLineEndsWithTag) {
					// Content starts on same line as <value>
					actualContentStartLine = xpathContentStart;
				} else {
					// Content starts on next line
					actualContentStartLine =
						xpathContentStart + NEXT_LINE_OFFSET;
				}
			}

			// Count newlines in the trimmed XPath up to the conditional position
			const xpathBeforeConditional = xpath.substring(
				MIN_COUNT,
				xpathIndex,
			);
			const newlineMatches = xpathBeforeConditional.match(/\n/g);
			// match() returns null if no match, or array if match found
			// Use 0 if no matches found (null case)
			const newlineCount = newlineMatches?.length ?? MIN_COUNT;

			// Calculate the line number
			// actualContentStartLine is 0-indexed, so we add LINE_OFFSET to convert to 1-indexed
			// Then add newlineCount to account for newlines in the XPath
			return actualContentStartLine + LINE_OFFSET + newlineCount;
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Find line number for an operator in the XPath within the XML file.
 * @param ruleFilePath - Path to the rule XML file.
 * @param xpath - XPath expression.
 * @param operator - Operator to find (e.g., "+", "=", "!=").
 * @returns Line number where operator appears, or null if not found.
 */
function findOperatorLineNumber(
	ruleFilePath: Readonly<string>,
	xpath: Readonly<string>,
	operator: Readonly<string>,
): number | null {
	try {
		const content = readFileSync(ruleFilePath, 'utf-8');
		const lines = content.split('\n');

		// Search for operator pattern in XPath section
		const operatorPattern = operator;

		// Find the line containing the XPath value element
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			// Check if this line contains the XPath and the operator
			const hasXPath = line.includes('xpath');
			const hasValue = line.includes('value');
			const hasOperator = line.includes(operatorPattern);
			if (hasXPath && hasValue && hasOperator) {
				return i + LINE_OFFSET;
			}
		}

		// If not found in a single line, search for the XPath section and then the operator
		let inXPathSection = false;
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<property') && line.includes('name="xpath"')) {
				inXPathSection = true;
			}
			if (inXPathSection && line.includes(operatorPattern)) {
				return i + LINE_OFFSET;
			}
			if (inXPathSection && line.includes('</property>')) {
				inXPathSection = false;
			}
		}

		// Fallback: find position in XPath string and estimate line
		const xpathIndex = xpath.indexOf(operatorPattern);
		if (xpathIndex !== NOT_FOUND_INDEX) {
			// Find the value element and count lines
			for (let i = 0; i < lines.length; i++) {
				// split('\n') always returns a dense array, so lines[i] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
				const line = lines[i]!;
				if (line.includes('<value>')) {
					// Count newlines in XPath up to the operator position
					const xpathBeforeOperator = xpath.substring(
						MIN_COUNT,
						xpathIndex,
					);
					const newlineMatches = xpathBeforeOperator.match(/\n/g);
					// match() returns null if no match, or array if match found
					// Use 0 if no matches found (null case)
					const newlineCount = newlineMatches?.length ?? MIN_COUNT;
					return i + LINE_OFFSET + newlineCount;
				}
			}
		}

		return null;
	} catch {
		return null;
	}
}

export {
	findAttributeLineNumber,
	findConditionalLineNumber,
	findNodeTypeLineNumber,
	findOperatorLineNumber,
};
