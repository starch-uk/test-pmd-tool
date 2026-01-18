/**
 * @file
 * Quality checks for PMD rule files.
 */
import { readFileSync } from 'fs';
import type {
	RuleMetadata,
	ExampleData,
	ValidationResult,
} from '../../types/index.js';
import { extractLetVariables } from '../../xpath/extractLetVariables.js';
import { extractHardcodedValues } from '../../xpath/extractHardcodedValues.js';
import { checkDuplicates } from '../checkDuplicates.js';

const MAX_MESSAGE_LENGTH = 80;
const MIN_STRING_LENGTH = 0;
const LINE_NUMBER_OFFSET = 1;
const ARRAY_LAST_INDEX_OFFSET = 1;
const NOT_FOUND_INDEX = -1;
const ZERO_COUNT = 0;
const SINGLE_OCCURRENCE = 1;
const VERSION_PATTERN = /^Version:\s*(\d+)\.(\d+)\.(\d+)$/;
const VARIABLE_DOC_PATTERN = /^(?:[-*]\s+)?(\$[a-zA-Z_][a-zA-Z0-9_]*):\s*.+$/;
const INLINE_VIOLATION_MARKER = 'Inline violation marker // ❌';
const INLINE_VALID_MARKER = 'Inline valid marker // ✅';
const NEXT_LINE_OFFSET = 1;
const VAR_PREFIX_LENGTH = 1;
const REGEX_FIRST_CAPTURE_GROUP = 1;
const INDEX_OFFSET = 1;

interface XPathValueLocation {
	startChar: number;
	startLine: number;
	valueContent: string;
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
function findMessageLineNumber(xmlContent: string): number | undefined {
	const lines = xmlContent.split('\n');
	for (let i = 0; i < lines.length; i++) {
		// split('\n') always returns a dense array, so lines[i] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
		const line = lines[i]!;
		if (line.includes('message=')) {
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
function findDescriptionLineNumber(xmlContent: string): number | undefined {
	const lines = xmlContent.split('\n');
	for (let i = 0; i < lines.length; i++) {
		// split('\n') always returns a dense array, so lines[i] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
		const line = lines[i]!;
		if (line.includes('<description>')) {
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
	xmlContent: string,
): XPathValueLocation | undefined {
	const lines = xmlContent.split('\n');
	let inProperties = false;
	let inXPathProperty = false;
	let valueStartLine = -1;
	let valueStartChar = -1;
	let valueContent = '';

	for (let i = 0; i < lines.length; i++) {
		// split('\n') always returns a dense array, so lines[i] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
		const line = lines[i]!;
		if (line.includes('<properties>')) {
			inProperties = true;
		}
		if (inProperties && line.includes('name="xpath"')) {
			inXPathProperty = true;
		}
		if (inXPathProperty) {
			const valueTagIndex = line.indexOf('<value>');
			if (valueTagIndex !== NOT_FOUND_INDEX) {
				valueStartLine = i;
				valueStartChar = valueTagIndex + '<value>'.length;
				// Extract value content (may span multiple lines)
				let valueEndIndex = line.indexOf('</value>');
				if (valueEndIndex !== NOT_FOUND_INDEX) {
					// Value is on same line
					valueContent = line.substring(
						valueStartChar,
						valueEndIndex,
					);
				} else {
					// Value spans multiple lines
					valueContent = line.substring(valueStartChar);
					for (let j = i + NEXT_LINE_OFFSET; j < lines.length; j++) {
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures j < length
						const nextLine = lines[j]!;
						const endTagIndex = nextLine.indexOf('</value>');
						if (endTagIndex !== NOT_FOUND_INDEX) {
							valueContent +=
								'\n' +
								nextLine.substring(ZERO_COUNT, endTagIndex);
							break;
						}
						valueContent += '\n' + nextLine;
					}
				}

				// Check if content starts with CDATA and adjust accordingly
				const trimmedContent = valueContent.trim();
				let actualContentStartLine = valueStartLine;
				let actualContent = trimmedContent;

				// Check if valueContent contains CDATA (before trimming to handle whitespace)
				const cdataIndexInValue = valueContent.indexOf('<![CDATA[');
				if (cdataIndexInValue !== NOT_FOUND_INDEX) {
					// Find where CDATA content actually starts
					const afterCdataStart = valueContent.substring(
						cdataIndexInValue + '<![CDATA['.length,
					);
					const cdataEndIndex = afterCdataStart.indexOf(']]>');
					if (cdataEndIndex !== NOT_FOUND_INDEX) {
						// Extract content between CDATA markers
						actualContent = afterCdataStart
							.substring(ZERO_COUNT, cdataEndIndex)
							.trim();
						// Count how many lines the CDATA opening is on (from start of valueContent)
						// This tells us which line (relative to valueStartLine) contains CDATA
						const newlineCountToCdata = (
							valueContent
								.substring(ZERO_COUNT, cdataIndexInValue)
								.match(/\n/g) ?? []
						).length;
						// The actual content starts on the line after the CDATA opening
						// newlineCountToCdata gives us the line offset to CDATA, add 1 line to get to content
						actualContentStartLine =
							valueStartLine +
							newlineCountToCdata +
							LINE_NUMBER_OFFSET;
					}
				}

				return {
					startChar: valueStartChar,
					startLine: actualContentStartLine + LINE_NUMBER_OFFSET,
					valueContent: actualContent.trim(),
				};
			}
		}
		if (line.includes('</properties>')) {
			break;
		}
	}
	return undefined;
}

/**
 * Calculate line number in XML for a position within XPath value.
 * @param xpathValueLocation - XPath `<value>` content location info.
 * @param positionInXPath - Character position within the XPath string.
 * @returns Line number (1-based) in XML file.
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
 * Check message attribute length.
 * @param message - Message value.
 * @param messageLine - Line number of message attribute.
 * @returns Issue message or null if valid.
 */
function checkMessageLength(
	message: string | null | undefined,
	messageLine: number | undefined,
): string | null {
	if (
		message === null ||
		message === undefined ||
		message.length === MIN_STRING_LENGTH
	) {
		return messageLine !== undefined
			? `Line ${String(messageLine)}: message attribute is missing`
			: 'message attribute is missing';
	}

	if (message.length > MAX_MESSAGE_LENGTH) {
		return messageLine !== undefined
			? `Line ${String(messageLine)}: message attribute exceeds ${String(MAX_MESSAGE_LENGTH)} characters (${String(message.length)} chars)`
			: `message attribute exceeds ${String(MAX_MESSAGE_LENGTH)} characters (${String(message.length)} chars)`;
	}

	return null;
}

/**
 * Check description ends with Version line.
 * @param description - Description value.
 * @param descriptionLine - Line number of description element.
 * @returns Issue message or null if valid.
 */
function checkVersionLine(
	description: string | null | undefined,
	descriptionLine: number | undefined,
): string | null {
	if (
		description === null ||
		description === undefined ||
		description.length === MIN_STRING_LENGTH
	) {
		return descriptionLine !== undefined
			? `Line ${String(descriptionLine)}: description must end with 'Version: X.Y.Z'`
			: "description must end with 'Version: X.Y.Z'";
	}

	const lines = description.split('\n');
	const lastLineIndex = lines.length - ARRAY_LAST_INDEX_OFFSET;
	const lastLine = lines[lastLineIndex]?.trim();
	if (
		lastLine === undefined ||
		lastLine.length === MIN_STRING_LENGTH ||
		!VERSION_PATTERN.test(lastLine)
	) {
		return descriptionLine !== undefined
			? `Line ${String(descriptionLine)}: description must end with 'Version: X.Y.Z' (SemVer format)`
			: "description must end with 'Version: X.Y.Z' (SemVer format)";
	}

	return null;
}

/**
 * Check XPath hardcoded values are in let statement.
 * @param xpath - XPath expression (normalized from DOMParser).
 * @param xmlContent - Raw XML file content.
 * @returns Array of issue messages (one per missing hardcoded value).
 */
function checkXPathHardcodedValues(
	xpath: string | null | undefined,
	xmlContent: string,
): string[] {
	const issues: string[] = [];

	if (
		xpath === null ||
		xpath === undefined ||
		xpath.length === MIN_STRING_LENGTH
	) {
		return issues; // No XPath to check
	}

	// Find XPath value location in XML for accurate line numbers
	const xpathLocation = findXPathValueLocation(xmlContent);
	if (xpathLocation === undefined) {
		return issues; // Can't find XPath location
	}

	// Extract hardcoded values from the raw XML XPath content (not normalized)
	// This ensures positions are accurate for line number calculation
	const rawXPath = xpathLocation.valueContent;
	const hardcodedValues = extractHardcodedValues(rawXPath);
	if (hardcodedValues.length === MIN_STRING_LENGTH) {
		return issues; // No hardcoded values found
	}

	// Extract let variables from normalized XPath for comparison
	const letVariables = extractLetVariables(xpath);
	// Normalize let variable values for comparison (remove quotes, lowercase)
	const letVariableValues = new Set(
		letVariables.map((v: Readonly<{ name: string; value: string }>) => {
			const normalized = v.value
				.replace(/^['"]|['"]$/g, '')
				.toLowerCase()
				.trim();
			return normalized;
		}),
	);

	// Check if all hardcoded values are in let statement - report each missing one
	for (const hardcoded of hardcodedValues) {
		// Normalize hardcoded value (remove quotes, lowercase)
		const normalizedValue = hardcoded.value
			.replace(/^['"]|['"]$/g, '')
			.toLowerCase()
			.trim();

		if (!letVariableValues.has(normalizedValue)) {
			// Calculate exact line number where the hardcoded value appears
			const exactLine = calculateXPathLineNumber(
				xpathLocation,
				hardcoded.position,
			);
			issues.push(
				`Line ${String(exactLine)}: ${hardcoded.value} outside initial let statement`,
			);
		}
	}

	return issues;
}

/**
 * Find position of a variable in XPath string.
 * @param xpath - XPath expression.
 * @param varName - Variable name to find (e.g., "$modificationOps").
 * @returns Character position of variable name in XPath, or -1 if not found.
 */
function findVariablePositionInXPath(xpath: string, varName: string): number {
	// Find the variable name in the XPath, ensuring it's a variable declaration
	// Look for pattern: $varName := or $varName =
	const pattern = new RegExp(
		`\\$${varName.substring(VAR_PREFIX_LENGTH)}\\s*:?=`,
	);
	const match = pattern.exec(xpath);
	return match?.index ?? NOT_FOUND_INDEX;
}

/**
 * Check variable documentation in description.
 * @param xpath - XPath expression.
 * @param description - Description value.
 * @param xmlContent - Raw XML file content.
 * @returns Array of issue messages (one per missing variable).
 */
function checkVariableDocumentation(
	xpath: string | null | undefined,
	description: string | null | undefined,
	xmlContent: string,
): string[] {
	const issues: string[] = [];

	if (
		xpath === null ||
		xpath === undefined ||
		xpath.length === MIN_STRING_LENGTH
	) {
		return issues; // No XPath to check
	}

	const letVariables = extractLetVariables(xpath);
	if (letVariables.length === MIN_STRING_LENGTH) {
		return issues; // No let variables to document
	}

	if (
		description === null ||
		description === undefined ||
		description.length === MIN_STRING_LENGTH
	) {
		// If description is missing, report all variables
		const xpathLocation = findXPathValueLocation(xmlContent);
		for (const variable of letVariables) {
			// Use the actual XPath content from XML (not the normalized one from DOMParser)
			const xpathForPosition =
				xpathLocation !== undefined
					? xpathLocation.valueContent
					: xpath;
			const varPosition = findVariablePositionInXPath(
				xpathForPosition,
				variable.name,
			);
			const varLine =
				xpathLocation !== undefined && varPosition !== NOT_FOUND_INDEX
					? calculateXPathLineNumber(xpathLocation, varPosition)
					: undefined;
			issues.push(
				varLine !== undefined
					? `Line ${String(varLine)}: variable ${variable.name} undocumented`
					: `variable ${variable.name} undocumented`,
			);
		}
		return issues;
	}

	const descriptionLines = description.split('\n');
	const documentedVars = new Set<string>();

	for (const line of descriptionLines) {
		const trimmed = line.trim();
		const varMatch = VARIABLE_DOC_PATTERN.exec(trimmed);
		if (varMatch !== null) {
			// Extract "$varName" from captured group (handles both "- $var: desc" and "$var: desc" formats)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex match ensures group exists
			const varName = varMatch[REGEX_FIRST_CAPTURE_GROUP]!;
			documentedVars.add(varName);
		}
	}

	// Check all variables are documented - report one issue per missing variable
	const xpathLocation = findXPathValueLocation(xmlContent);
	for (const variable of letVariables) {
		if (!documentedVars.has(variable.name)) {
			// Use the actual XPath content from XML (not the normalized one from DOMParser)
			// to get accurate positions
			const xpathForPosition =
				xpathLocation !== undefined
					? xpathLocation.valueContent
					: xpath;
			const varPosition = findVariablePositionInXPath(
				xpathForPosition,
				variable.name,
			);
			const varLine =
				xpathLocation !== undefined && varPosition !== NOT_FOUND_INDEX
					? calculateXPathLineNumber(xpathLocation, varPosition)
					: undefined;
			issues.push(
				varLine !== undefined
					? `Line ${String(varLine)}: variable ${variable.name} undocumented`
					: `variable ${variable.name} undocumented`,
			);
		}
	}

	return issues;
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

interface MarkerLineNumberInput {
	exampleIndex: number;
	lines: readonly string[];
	markerLineInExample: number;
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
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
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
 * Check marker descriptions exist and are unique.
 * @param examples - Array of examples.
 * @param xmlContent - Raw XML file content.
 * @returns Issue messages array.
 */
function checkMarkerDescriptions(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array is iterated
	examples: readonly ExampleData[],
	xmlContent: Readonly<string>,
): string[] {
	const issues: string[] = [];
	const lines = xmlContent.split('\n');
	const markerDescriptions = new Map<
		string,
		{ example: number; line: number }[]
	>();

	// Collect all marker descriptions
	for (const example of examples) {
		const exampleLines = example.content.split('\n');

		// Check violation markers
		for (const marker of example.violationMarkers) {
			// Find the line in the example content
			const markerLineIndex = marker.lineNumber - LINE_NUMBER_OFFSET;
			if (
				markerLineIndex >= ZERO_COUNT &&
				markerLineIndex < exampleLines.length
			) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Bounds check ensures index is valid
				const markerLine = exampleLines[markerLineIndex]!;

				// Check for inline markers first
				let desc = '';
				if (markerLine.includes('// ❌')) {
					desc = extractTextAfterMarker(markerLine, '// ❌').trim();
				} else if (markerLine.includes('// Violation:')) {
					desc = extractTextAfterMarker(
						markerLine,
						'// Violation:',
					).trim();
				} else {
					// Fallback to marker description field
					desc = marker.description.trim();
					// Remove default descriptions
					if (desc === INLINE_VIOLATION_MARKER) {
						desc = '';
					}
				}

				if (desc.length === MIN_STRING_LENGTH) {
					const lineNum = findMarkerLineNumber({
						exampleIndex: example.exampleIndex,
						lines,
						markerLineInExample: marker.lineNumber,
					});
					issues.push(
						lineNum !== undefined
							? `Line ${String(lineNum)}: violation has no description`
							: `Example ${String(example.exampleIndex)}: violation has no description`,
					);
				} else {
					if (!markerDescriptions.has(desc)) {
						markerDescriptions.set(desc, []);
					}
					// get() after set() always returns the array, never undefined
					const locations = markerDescriptions.get(desc);
					if (locations === undefined) {
						// This should never happen since we just set it above
						continue;
					}
					const lineNum = findMarkerLineNumber({
						exampleIndex: example.exampleIndex,
						lines,
						markerLineInExample: marker.lineNumber,
					});
					locations.push({
						example: example.exampleIndex,
						line: lineNum ?? ZERO_COUNT,
					});
				}
			}
		}

		// Check valid markers
		for (const marker of example.validMarkers) {
			// Find the line in the example content
			const markerLineIndex = marker.lineNumber - LINE_NUMBER_OFFSET;
			if (
				markerLineIndex >= ZERO_COUNT &&
				markerLineIndex < exampleLines.length
			) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Bounds check ensures index is valid
				const markerLine = exampleLines[markerLineIndex]!;

				// Check for inline markers first
				let desc = '';
				if (markerLine.includes('// ✅')) {
					desc = extractTextAfterMarker(markerLine, '// ✅').trim();
				} else if (markerLine.includes('// Valid:')) {
					desc = extractTextAfterMarker(
						markerLine,
						'// Valid:',
					).trim();
				} else {
					// Fallback to marker description field
					desc = marker.description.trim();
					// Remove default descriptions
					if (desc === INLINE_VALID_MARKER) {
						desc = '';
					}
				}

				if (desc.length === MIN_STRING_LENGTH) {
					const lineNum = findMarkerLineNumber({
						exampleIndex: example.exampleIndex,
						lines,
						markerLineInExample: marker.lineNumber,
					});
					issues.push(
						lineNum !== undefined
							? `Line ${String(lineNum)}: valid has no description`
							: `Example ${String(example.exampleIndex)}: valid has no description`,
					);
				} else {
					if (!markerDescriptions.has(desc)) {
						markerDescriptions.set(desc, []);
					}
					// get() after set() always returns the array, never undefined
					const locations = markerDescriptions.get(desc);
					if (locations === undefined) {
						// This should never happen since we just set it above
						continue;
					}
					const lineNum = findMarkerLineNumber({
						exampleIndex: example.exampleIndex,
						lines,
						markerLineInExample: marker.lineNumber,
					});
					locations.push({
						example: example.exampleIndex,
						line: lineNum ?? ZERO_COUNT,
					});
				}
			}
		}
	}

	// Check for duplicates - report subsequent usage lines, not the original
	for (const [desc, locations] of markerDescriptions.entries()) {
		if (hasAtLeastTwoItems(locations)) {
			// Get the first occurrence (original) and subsequent duplicates
			const [firstLocation, ...restLocations] = locations;
			const originalLine = firstLocation.line;
			// Report all subsequent duplicates with reference to original
			for (const loc of restLocations) {
				issues.push(
					`Line ${String(loc.line)}: duplicate description '${desc}' (line ${String(originalLine)})`,
				);
			}
		}
	}

	return issues;
}

/**
 * Check at least one violation marker exists.
 * @param examples - Array of examples.
 * @param xmlContent - Raw XML file content.
 * @returns Issue message or null if valid.
 */
function checkViolationExists(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array is iterated
	examples: readonly ExampleData[],
	xmlContent: Readonly<string>,
): string | null {
	const hasViolation = examples.some(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
		(example: Readonly<ExampleData>) =>
			example.violationMarkers.length > MIN_STRING_LENGTH,
	);

	if (!hasViolation) {
		// Find first example line number
		const lines = xmlContent.split('\n');
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<example>')) {
				return `Line ${String(i + LINE_NUMBER_OFFSET)}: at least one violation marker (// Violation or // ❌) required`;
			}
		}
		return 'at least one violation marker (// Violation or // ❌) required';
	}

	return null;
}

/**
 * Check for forbidden method name 'testMethod' in examples.
 * @param examples - Parsed examples.
 * @param xmlContent - Raw XML file content.
 * @returns Array of issue messages.
 */
function checkForbiddenTestMethodName(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array is iterated
	examples: readonly ExampleData[],
	xmlContent: Readonly<string>,
): string[] {
	const issues: string[] = [];
	const MIN_ARRAY_LENGTH = 0;
	const FIRST_ELEMENT_INDEX = 0;

	const lines = xmlContent.split('\n');
	const testMethodLines: number[] = [];
	for (let i = 0; i < lines.length; i++) {
		// split('\n') always returns a dense array, so lines[i] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
		const line = lines[i]!;
		if (line.includes('testMethod(')) {
			testMethodLines.push(i + LINE_NUMBER_OFFSET);
		}
	}

	examples.forEach(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
		(example: Readonly<ExampleData>, index: Readonly<number>) => {
			if (example.content.includes('testMethod(')) {
				const exampleNum = index + INDEX_OFFSET;
				const lineNumber =
					testMethodLines.length > MIN_ARRAY_LENGTH
						? testMethodLines[FIRST_ELEMENT_INDEX]
						: undefined;
				const linePrefix =
					lineNumber === undefined
						? 'Line: ?, '
						: `Line: ${String(lineNumber)}, `;
				issues.push(
					`${linePrefix}Example ${String(exampleNum)}: You can't call a method testMethod in examples`,
				);
			}
		},
	);

	return issues;
}

/**
 * Run all quality checks on a rule file.
 * @param ruleFilePath - XML rule file path.
 * @param ruleMetadata - Parsed rule metadata.
 * @param examples - Parsed examples.
 * @returns Validation result with issues.
 */
export function checkQualityChecks(
	ruleFilePath: Readonly<string>,
	ruleMetadata: Readonly<RuleMetadata>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array is iterated
	examples: readonly ExampleData[],
): ValidationResult {
	const issues: string[] = [];

	try {
		const xmlContent = readFileSync(ruleFilePath, 'utf-8');

		// Check 1: Message length
		const messageLine = findMessageLineNumber(xmlContent);
		const messageIssue = checkMessageLength(
			ruleMetadata.message,
			messageLine,
		);
		if (messageIssue !== null) {
			issues.push(messageIssue);
		}

		// Check 2: Version line
		const descriptionLine = findDescriptionLineNumber(xmlContent);
		const versionIssue = checkVersionLine(
			ruleMetadata.description,
			descriptionLine,
		);
		if (versionIssue !== null) {
			issues.push(versionIssue);
		}

		// Check 3: XPath hardcoded values
		const xpathIssues = checkXPathHardcodedValues(
			ruleMetadata.xpath,
			xmlContent,
		);
		issues.push(...xpathIssues);

		// Check 4: Variable documentation
		const varDocIssues = checkVariableDocumentation(
			ruleMetadata.xpath,
			ruleMetadata.description,
			xmlContent,
		);
		issues.push(...varDocIssues);

		// Check 5 & 6: Marker descriptions and uniqueness
		const markerIssues = checkMarkerDescriptions(examples, xmlContent);
		issues.push(...markerIssues);

		// Check 7: Forbidden method name 'testMethod' in examples
		const testMethodIssues = checkForbiddenTestMethodName(
			examples,
			xmlContent,
		);
		issues.push(...testMethodIssues);

		// Check 8: At least one violation
		const violationIssue = checkViolationExists(examples, xmlContent);
		if (violationIssue !== null) {
			issues.push(violationIssue);
		}

		// Check 8: Duplicate test patterns
		const duplicatesResult = checkDuplicates(examples);
		// Add duplicate warnings as issues (they're warnings in the old system, but issues in Quality Checks)
		for (const warning of duplicatesResult.warnings) {
			issues.push(warning);
		}
		// Also add any duplicate errors
		issues.push(...duplicatesResult.issues);
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		issues.push(`Error reading rule file: ${errorMessage}`);
	}

	const MIN_ISSUES_COUNT = 0;
	return {
		issues,
		passed: issues.length === MIN_ISSUES_COUNT,
		warnings: [],
	};
}
