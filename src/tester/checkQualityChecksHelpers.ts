/**
 * @file
 * Helper functions for quality checks.
 * Extracts and validates rule metadata, XPath values, and marker descriptions.
 */
import type { ExampleData } from '../types/index.js';

const MIN_STRING_LENGTH = 0;
const LINE_NUMBER_OFFSET = 1;
const NOT_FOUND_INDEX = -1;
const ZERO_COUNT = 0;
const SINGLE_OCCURRENCE = 1;
const VAR_PREFIX_LENGTH = 1;
const INLINE_VIOLATION_MARKER = 'Inline violation marker // ❌';
const INLINE_VALID_MARKER = 'Inline valid marker // ✅';

interface XPathValueLocation {
	startChar: number;
	startLine: number;
	valueContent: string;
}

interface MarkerLineNumberInput {
	exampleIndex: number;
	lines: readonly string[];
	markerLineInExample: number;
}

/**
 * Type guard: check array has at least 2 items.
 * @template T - Item type.
 * @param items - Items to check.
 * @returns True if array has at least 2 items.
 */
function hasAtLeastTwoItems<T>(
	items: readonly T[],
): items is readonly [T, T, ...T[]] {
	return items.length > SINGLE_OCCURRENCE;
}

/**
 * Find line number of message attribute in XML file.
 * @param xmlContent - Raw XML file content.
 * @returns Line number (1-based) or undefined if not found.
 */
function findMessageLineNumber(
	xmlContent: Readonly<string>,
): number | undefined {
	const lines = xmlContent.split('\n');
	for (let i = 0; i < lines.length; i++) {
		// split('\n') always returns a dense array, so lines[i] is always defined
		const line = lines[i];
		// eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit undefined check needed for strict-boolean-expressions
		if (line !== undefined && line.includes('message=')) {
			return i + LINE_NUMBER_OFFSET;
		}
	}
	return undefined;
}

/**
 * Find line number of description element in XML file.
 * @param xmlContent - Raw XML file content.
 * @returns Line number (1-based) or undefined if not found.
 */
function findDescriptionLineNumber(
	xmlContent: Readonly<string>,
): number | undefined {
	const lines = xmlContent.split('\n');
	for (let i = 0; i < lines.length; i++) {
		// split('\n') always returns a dense array, so lines[i] is always defined
		const line = lines[i];
		// eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit undefined check needed for strict-boolean-expressions
		if (line !== undefined && line.includes('<description>')) {
			return i + LINE_NUMBER_OFFSET;
		}
	}
	return undefined;
}

/**
 * Find XPath value element location in XML file.
 * @param xmlContent - Raw XML file content.
 * @returns Object with start line and character position, or undefined if not found.
 */
function findXPathValueLocation(
	xmlContent: Readonly<string>,
): XPathValueLocation | undefined {
	const lines = xmlContent.split('\n');
	let inProperties = false;
	let inXPathProperty = false;
	let valueStartLine = -1;
	let valueStartChar = -1;
	let valueContent = '';

	for (let i = 0; i < lines.length; i++) {
		// split('\n') always returns a dense array, so lines[i] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- split('\n') always returns dense array
		const line = lines[i]!;

		if (line.includes('<properties>')) {
			inProperties = true;
		}

		if (inProperties && line.includes('name="xpath"')) {
			inXPathProperty = true;
		}

		if (inXPathProperty && line.includes('<value>')) {
			valueStartLine = i;
			const valueTagIndex = line.indexOf('<value>');
			// indexOf can never be -1 when includes is true, so this is always >= 0
			valueStartChar = valueTagIndex + '<value>'.length;
			// Check if value content is on the same line
			const contentAfterTag = line.substring(valueStartChar);
			if (contentAfterTag.trim().length > MIN_STRING_LENGTH) {
				valueContent = contentAfterTag.trim();
			}
		}

		if (inXPathProperty && valueStartLine >= ZERO_COUNT) {
			if (line.includes('</value>')) {
				const closingTagIndex = line.indexOf('</value>');
				// indexOf can never be -1 when includes is true, so this is always >= 0
				valueContent += line.substring(ZERO_COUNT, closingTagIndex);
				break;
			} else if (valueStartLine !== i) {
				// Content is on subsequent lines
				valueContent += line;
			}
		}

		if (line.includes('</properties>')) {
			inProperties = false;
			inXPathProperty = false;
		}
	}

	const MIN_INDEX = 0;
	if (valueStartLine < MIN_INDEX || valueStartChar < MIN_INDEX) {
		return undefined;
	}

	return {
		startChar: valueStartChar,
		startLine: valueStartLine + LINE_NUMBER_OFFSET,
		valueContent: valueContent.trim(),
	};
}

/**
 * Calculate line number for a position in XPath string.
 * Uses the start line and character position from XPath value location to determine the actual XML line.
 * @param xpathValueLocation - XPath value location object with startLine and startChar.
 * @param positionInXPath - Character position within XPath string (0-based).
 * @returns Line number in XML file (1-based), or undefined if position is invalid.
 */
function calculateXPathLineNumber(
	xpathValueLocation: Readonly<XPathValueLocation>,
	positionInXPath: Readonly<number>,
): number {
	// Count newlines before the position in the XPath
	const xpathBeforePosition = xpathValueLocation.valueContent.substring(
		ZERO_COUNT,
		positionInXPath,
	);
	const newlineCount = (xpathBeforePosition.match(/\n/g) ?? []).length;
	return xpathValueLocation.startLine + newlineCount;
}

/**
 * Find position of a variable in XPath string.
 * @param xpath - XPath expression.
 * @param varName - Variable name to find (e.g., "$modificationOps").
 * @returns Character position of variable name in XPath, or -1 if not found.
 */
function findVariablePositionInXPath(
	xpath: Readonly<string>,
	varName: Readonly<string>,
): number {
	// Find the variable name in the XPath, ensuring it's a variable declaration
	// Look for pattern: $varName := or $varName =
	const pattern = new RegExp(
		`\\$${varName.substring(VAR_PREFIX_LENGTH)}\\s*:?=`,
	);
	const match = pattern.exec(xpath);
	return match?.index ?? NOT_FOUND_INDEX;
}

/**
 * Extract text after marker in a line.
 * @param line - Source line text.
 * @param marker - Marker token to locate.
 * @returns Marker description text following the token.
 */
function extractTextAfterMarker(
	line: Readonly<string>,
	marker: Readonly<string>,
): string {
	const markerIndex = line.indexOf(marker);
	const textAfter = line.substring(markerIndex + marker.length).trim();
	return textAfter;
}

/**
 * Find marker line number in XML.
 * @param input - Marker lookup input.
 * @returns Line number in XML or undefined.
 */
function findMarkerLineNumber(
	input: Readonly<MarkerLineNumberInput>,
): number | undefined {
	const { exampleIndex, lines, markerLineInExample } = input;
	let currentExampleIndex = 0;
	let exampleStart = NOT_FOUND_INDEX;

	for (let i = 0; i < lines.length; i++) {
		// split('\n') always returns a dense array, so lines[i] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- split('\n') always returns dense array
		const line = lines[i]!;
		if (line.includes('<example>')) {
			currentExampleIndex++;
			if (currentExampleIndex === exampleIndex) {
				exampleStart = i;
			}
		}
		if (exampleStart >= ZERO_COUNT && line.includes('</example>')) {
			// Calculate approximate line number within example
			const lineOffset = markerLineInExample - LINE_NUMBER_OFFSET;
			const estimatedLine =
				exampleStart + lineOffset + LINE_NUMBER_OFFSET;
			if (estimatedLine < i) {
				return estimatedLine + LINE_NUMBER_OFFSET;
			}
			break;
		}
	}

	return undefined;
}

/**
 * Extract description from marker line for violation markers.
 * @param markerLine - Line containing the marker.
 * @param marker - Violation marker object.
 * @param marker.description - Description from the marker object.
 * @returns Extracted description or empty string.
 */
function extractViolationDescription(
	markerLine: Readonly<string>,
	marker: Readonly<{ description: string }>,
): string {
	if (markerLine.includes('// ❌')) {
		return extractTextAfterMarker(markerLine, '// ❌').trim();
	}
	if (markerLine.includes('// Violation:')) {
		return extractTextAfterMarker(markerLine, '// Violation:').trim();
	}
	const desc = marker.description.trim();
	return desc === INLINE_VIOLATION_MARKER ? '' : desc;
}

/**
 * Extract description from marker line for valid markers.
 * @param markerLine - Line containing the marker.
 * @param marker - Valid marker object.
 * @param marker.description - Description from the marker object.
 * @returns Extracted description or empty string.
 */
function extractValidDescription(
	markerLine: Readonly<string>,
	marker: Readonly<{ description: string }>,
): string {
	if (markerLine.includes('// ✅')) {
		return extractTextAfterMarker(markerLine, '// ✅').trim();
	}
	if (markerLine.includes('// Valid:')) {
		return extractTextAfterMarker(markerLine, '// Valid:').trim();
	}
	const desc = marker.description.trim();
	return desc === INLINE_VALID_MARKER ? '' : desc;
}

/**
 * Options for processing a marker.
 */
interface ProcessMarkerOptions {
	readonly marker: Readonly<{
		readonly lineNumber: number;
		readonly description: string;
	}>;
	readonly markerLine: Readonly<string>;
	readonly example: Readonly<ExampleData>;
	readonly xmlLines: readonly string[];
	readonly markerDescriptions: Map<
		string,
		{ example: number; line: number }[]
	>;
	readonly markerType: Readonly<'valid' | 'violation'>;
	readonly issues: string[];
}

/**
 * Process a single marker and update issues/descriptions map.
 * Extracts description from marker line and updates the marker descriptions map.
 * @param options - Options for processing the marker.
 * @param options.marker - Marker to process.
 * @param options.marker.lineNumber - Line number of the marker (1-based).
 * @param options.marker.description - The marker description text extracted from the source code.
 * @param options.markerLine - Line containing the marker.
 * @param options.example - Example containing the marker.
 * @param options.xmlLines - XML file lines for line number calculation.
 * @param options.markerDescriptions - Map to update with descriptions (normalized description -> example/line pairs).
 * @param options.markerType - Type of marker ('valid' or 'violation').
 * @param options.issues - Array to append issue messages to.
 */
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Parameter is already Readonly<ProcessMarkerOptions> with readonly properties, false positive
function processMarker(options: Readonly<ProcessMarkerOptions>): void {
	const {
		marker,
		markerLine,
		example,
		xmlLines,
		markerDescriptions,
		markerType,
		issues,
	} = options;
	const desc =
		markerType === 'violation'
			? extractViolationDescription(markerLine, marker)
			: extractValidDescription(markerLine, marker);

	const lineNum = findMarkerLineNumber({
		exampleIndex: example.exampleIndex,
		lines: xmlLines,
		markerLineInExample: marker.lineNumber,
	});

	if (desc.length === MIN_STRING_LENGTH) {
		const markerTypeLabel =
			markerType === 'violation' ? 'violation' : 'valid';
		const issueMessage =
			lineNum !== undefined
				? `Line ${String(lineNum)}: ${markerTypeLabel} has no description`
				: `Example ${String(example.exampleIndex)}: ${markerTypeLabel} has no description`;
		issues.push(issueMessage);
		return;
	}

	// Ensure the map has an array for this description
	let locations = markerDescriptions.get(desc);
	if (locations === undefined) {
		locations = [];
		markerDescriptions.set(desc, locations);
	}
	locations.push({
		example: example.exampleIndex,
		line: lineNum ?? ZERO_COUNT,
	});
}

/**
 * Check for duplicate marker descriptions and add issues.
 * @param markerDescriptions - Map of descriptions to locations.
 * @param issues - Array to append duplicate issues to.
 */
function checkDuplicateDescriptions(
	markerDescriptions: Readonly<
		Map<string, { example: number; line: number }[]>
	>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array is mutated via push()
	issues: string[],
): void {
	for (const [desc, locations] of markerDescriptions.entries()) {
		if (hasAtLeastTwoItems(locations)) {
			const [firstLocation, ...restLocations] = locations;
			const originalLine = firstLocation.line;
			for (const loc of restLocations) {
				issues.push(
					`Line ${String(loc.line)}: duplicate description '${desc}' (line ${String(originalLine)})`,
				);
			}
		}
	}
}

export {
	calculateXPathLineNumber,
	checkDuplicateDescriptions,
	extractTextAfterMarker,
	extractValidDescription,
	extractViolationDescription,
	findDescriptionLineNumber,
	findMarkerLineNumber,
	findMessageLineNumber,
	findVariablePositionInXPath,
	findXPathValueLocation,
	hasAtLeastTwoItems,
	processMarker,
};

export type { MarkerLineNumberInput, XPathValueLocation };
