/**
 * @file
 * Quality checks for PMD rule files.
 */
import { readFileSync } from 'fs';
import type {
	RuleMetadata,
	ExampleData,
	ValidationResult,
} from '../types/index.js';
import { extractLetVariables } from '../xpath/extractLetVariables.js';
import { extractHardcodedValues } from '../xpath/extractHardcodedValues.js';
import { checkDuplicates } from './checkDuplicates.js';
import {
	calculateXPathLineNumber,
	checkDuplicateDescriptions,
	findDescriptionLineNumber,
	findMessageLineNumber,
	findVariablePositionInXPath,
	findXPathValueLocation,
	processMarker,
} from './checkQualityChecksHelpers.js';

const MAX_MESSAGE_LENGTH = 80;
const MIN_STRING_LENGTH = 0;
const LINE_NUMBER_OFFSET = 1;
const ARRAY_LAST_INDEX_OFFSET = 1;
const NOT_FOUND_INDEX = -1;
const ZERO_COUNT = 0;
const VERSION_PATTERN = /^Version:\s*(\d+)\.(\d+)\.(\d+)$/;
const VARIABLE_DOC_PATTERN = /^(?:[-*]\s+)?(\$[a-zA-Z_][a-zA-Z0-9_]*):\s*.+$/;
const REGEX_FIRST_CAPTURE_GROUP = 1;
const INDEX_OFFSET = 1;

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
 * Check marker descriptions for completeness and duplicates.
 * @param examples - Array of examples.
 * @param xmlContent - Raw XML file content.
 * @returns Array of issue messages.
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

	for (const example of examples) {
		const exampleLines = example.content.split('\n');

		for (const marker of example.violationMarkers) {
			const markerLineIndex = marker.lineNumber - LINE_NUMBER_OFFSET;
			if (
				markerLineIndex >= ZERO_COUNT &&
				markerLineIndex < exampleLines.length
			) {
				// split('\n') always returns a dense array, so exampleLines[markerLineIndex] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Bounds check ensures index is valid, split() returns dense array
				const markerLine = exampleLines[markerLineIndex]!;
				processMarker({
					example,
					issues,
					marker,
					markerDescriptions,
					markerLine,
					markerType: 'violation',
					xmlLines: lines,
				});
			}
		}

		for (const marker of example.validMarkers) {
			const markerLineIndex = marker.lineNumber - LINE_NUMBER_OFFSET;
			if (
				markerLineIndex >= ZERO_COUNT &&
				markerLineIndex < exampleLines.length
			) {
				// split('\n') always returns a dense array, so exampleLines[markerLineIndex] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Bounds check ensures index is valid, split() returns dense array
				const markerLine = exampleLines[markerLineIndex]!;
				processMarker({
					example,
					issues,
					marker,
					markerDescriptions,
					markerLine,
					markerType: 'valid',
					xmlLines: lines,
				});
			}
		}
	}

	checkDuplicateDescriptions(markerDescriptions, issues);
	return issues;
}

/**
 * Check at least one violation marker exists in the examples.
 * Validates that examples have proper violation markers for testing.
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
