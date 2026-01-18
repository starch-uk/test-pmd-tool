/**
 * @file
 * Helper functions for RuleTester class.
 */
import { readFileSync, existsSync } from 'fs';
import type { ExampleData, OverallTestResults } from '../types/index.js';

const MIN_EXAMPLES_COUNT = 0;
const MIN_VIOLATIONS_COUNT = 0;
const ZERO_INDEX = 0;

/**
 * Safely get attribute value from DOM element.
 * @param element - The DOM element to get attribute from.
 * @param name - The attribute name to retrieve.
 * @returns The attribute value or null if not found.
 */
function getAttributeValue(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Element is used for getAttribute
	element: Readonly<Element>,
	name: Readonly<string>,
): string | null {
	return element.getAttribute(name);
}

/**
 * Extract category from rule file path.
 * @param ruleFilePath - Path to the rule file.
 * @returns Category name.
 */
function extractCategory(ruleFilePath: Readonly<string>): string {
	const pathParts = ruleFilePath.split('/');
	const rulesetsIndex = pathParts.findIndex((part) => part === 'rulesets');
	const minIndex = -1;
	const categoryIndexOffset = 1;
	if (
		rulesetsIndex !== minIndex &&
		rulesetsIndex < pathParts.length - categoryIndexOffset
	) {
		const categoryIndex = rulesetsIndex + categoryIndexOffset;
		// The bounds check above ensures categoryIndex < pathParts.length,
		// and split('/') always returns a dense array, so pathParts[categoryIndex] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Bounds check ensures index is valid, split() returns dense array
		const category = pathParts[categoryIndex]!;
		return category;
	}
	return 'unknown';
}

/**
 * Initializes an empty results object for a new test run.
 * @returns Initialized OverallTestResults object.
 */
function initializeResults(): OverallTestResults {
	return {
		examplesPassed: MIN_EXAMPLES_COUNT,
		examplesTested: MIN_EXAMPLES_COUNT,
		hardcodedValues: [],
		ruleTriggersViolations: false,
		success: false,
		testResults: [],
		totalViolations: MIN_VIOLATIONS_COUNT,
		xpathCoverage: {
			coverage: [],
			overallSuccess: false,
			uncoveredBranches: [],
		},
	};
}

/**
 * Maps a marker's line number (within example content) to XML file line number.
 * Finds the marker by searching for its pattern in the XML within the example boundaries.
 * @param ruleFilePath - Path to the rule XML file.
 * @param example - The example data containing the marker.
 * @param exampleIndex - 1-based example index.
 * @param markerLineNumber - 1-based line number within the example content (used to find marker in example).
 * @returns Line number in the XML file, or undefined if not found.
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for proper marker line number mapping
function findMarkerLineNumber(
	ruleFilePath: Readonly<string>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- ExampleData needs to be mutable for property access
	example: Readonly<ExampleData>,
	exampleIndex: Readonly<number>,
	markerLineNumber: Readonly<number>,
): number | undefined {
	try {
		const content = readFileSync(ruleFilePath, 'utf-8');
		const lines = content.split('\n');

		// Find the example boundaries
		const NOT_FOUND_INDEX = -1;
		let exampleStart = NOT_FOUND_INDEX;
		let exampleEnd = NOT_FOUND_INDEX;
		let currentExampleIndex = 0;

		// Find the target example boundaries
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<example>')) {
				currentExampleIndex++;
				if (currentExampleIndex === exampleIndex) {
					exampleStart = i;
				}
			} else if (
				line.includes('</example>') &&
				currentExampleIndex === exampleIndex
			) {
				exampleEnd = i;
				break;
			}
		}

		if (
			exampleStart === NOT_FOUND_INDEX ||
			exampleEnd === NOT_FOUND_INDEX
		) {
			return undefined;
		}

		// Find the marker by searching for its pattern in the XML
		// For inline markers, search for "// ❌" or "// ✅"
		// For section markers, search for "// Violation:" or "// Valid:"
		const LINE_NUMBER_OFFSET = 1;
		const exampleContentLines = example.content.split('\n');

		// Get the line from example content that contains the marker
		const markerLineIndex = markerLineNumber - LINE_NUMBER_OFFSET;
		if (
			markerLineIndex < ZERO_INDEX ||
			markerLineIndex >= exampleContentLines.length
		) {
			return undefined;
		}

		// split('\n') always returns a dense array, so exampleContentLines[markerLineIndex] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Bounds checked above
		const markerLineInExample = exampleContentLines[markerLineIndex]!;

		// Search for this line (or a substring that uniquely identifies it) in the XML
		// within the example boundaries
		for (let i = exampleStart; i <= exampleEnd; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop bounds ensure valid index, split() returns dense array
			const xmlLine = lines[i]!;

			// Check if this XML line contains the marker pattern
			// For inline markers, look for the marker symbol
			if (markerLineInExample.includes('// ❌')) {
				if (xmlLine.includes('// ❌')) {
					// Try to match more specifically by checking if key parts of the line match
					// Extract a unique identifier from the marker line (the code part, not the comment)
					const codePart = markerLineInExample
						.split('// ❌')
						[ZERO_INDEX]?.trim();
					const EMPTY_STRING_LENGTH = 0;
					// If codePart exists and is found in xmlLine, return this line
					// Otherwise, return first match (no code part or codePart not found)
					const hasCodePart =
						codePart !== undefined &&
						codePart.length > EMPTY_STRING_LENGTH;
					if (hasCodePart) {
						const codePartMatches = xmlLine.includes(codePart);
						if (codePartMatches) {
							return i + LINE_NUMBER_OFFSET;
						}
						// If codePart exists but doesn't match, continue loop to find another match
					} else {
						// No code part, just return first match
						return i + LINE_NUMBER_OFFSET;
					}
				}
			} else if (markerLineInExample.includes('// ✅')) {
				if (xmlLine.includes('// ✅')) {
					const codePart = markerLineInExample
						.split('// ✅')
						[ZERO_INDEX]?.trim();
					const EMPTY_STRING_LENGTH = 0;
					// If codePart exists and is found in xmlLine, return this line
					// Otherwise, return first match (no code part or codePart not found)
					const hasCodePart =
						codePart !== undefined &&
						codePart.length > EMPTY_STRING_LENGTH;
					if (hasCodePart) {
						const codePartMatches = xmlLine.includes(codePart);
						if (codePartMatches) {
							return i + LINE_NUMBER_OFFSET;
						}
						// If codePart exists but doesn't match, continue loop to find another match
					} else {
						// No code part, just return first match
						return i + LINE_NUMBER_OFFSET;
					}
				}
			} else if (markerLineInExample.includes('// Violation:')) {
				if (xmlLine.includes('// Violation:')) {
					return i + LINE_NUMBER_OFFSET;
				}
			} else if (markerLineInExample.includes('// Valid:')) {
				if (xmlLine.includes('// Valid:')) {
					return i + LINE_NUMBER_OFFSET;
				}
			}
		}

		// Fallback: if we can't find the exact marker, try to map by line number offset
		// Find where example content starts in XML
		let exampleContentStart = NOT_FOUND_INDEX;
		for (let i = exampleStart; i <= exampleEnd; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop bounds ensure valid index, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<![CDATA[')) {
				exampleContentStart = i + LINE_NUMBER_OFFSET;
				break;
			}
		}

		if (exampleContentStart !== NOT_FOUND_INDEX) {
			const MARKER_LINE_OFFSET = 1;
			const xmlLineIndex =
				exampleContentStart + markerLineNumber - MARKER_LINE_OFFSET;
			// Since exampleContentStart is found within [exampleStart, exampleEnd],
			// and markerLineNumber is bounded by exampleContentLines.length,
			// xmlLineIndex should always be within bounds
			return xmlLineIndex;
		}

		return undefined;
	} catch {
		// Ignore errors when finding line numbers
	}
	return undefined;
}

/**
 * Maps a marker's line number (within example content) to test file line number.
 * Finds the code from the marker line in the generated test file.
 * @param example - The example data containing the marker.
 * @param markerLineNumber - 1-based line number within the example content.
 * @param testFilePath - Path to the generated test file.
 * @returns Line number in the test file, or undefined if not found.
 */
function findMarkerLineInTestFile(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- ExampleData needs to be mutable for property access
	example: Readonly<ExampleData>,
	markerLineNumber: Readonly<number>,
	testFilePath: Readonly<string>,
): number | undefined {
	try {
		if (!existsSync(testFilePath)) {
			return undefined;
		}

		const testFileContent = readFileSync(testFilePath, 'utf-8');
		const testFileLines = testFileContent.split('\n');

		// Get the line from example content that contains the marker
		const LINE_NUMBER_OFFSET = 1;
		const exampleContentLines = example.content.split('\n');
		const markerLineIndex = markerLineNumber - LINE_NUMBER_OFFSET;
		if (
			markerLineIndex < ZERO_INDEX ||
			markerLineIndex >= exampleContentLines.length
		) {
			return undefined;
		}

		// split('\n') always returns a dense array, so exampleContentLines[markerLineIndex] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Bounds checked above
		const markerLineInExample = exampleContentLines[markerLineIndex]!;

		// Extract the code part (without the comment marker)
		let codeToFind = '';
		if (markerLineInExample.includes('// ❌')) {
			const splitResult = markerLineInExample.split('// ❌');
			// split() always returns at least one element, so [0] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- split() always returns at least one element
			codeToFind = splitResult[ZERO_INDEX]!.trim();
		} else if (markerLineInExample.includes('// ✅')) {
			const splitResult = markerLineInExample.split('// ✅');
			// split() always returns at least one element, so [0] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- split() always returns at least one element
			codeToFind = splitResult[ZERO_INDEX]!.trim();
		} else {
			codeToFind = markerLineInExample.trim();
		}

		const EMPTY_STRING_LENGTH = 0;
		if (codeToFind.length === EMPTY_STRING_LENGTH) {
			return undefined;
		}

		// Find the line in the test file that contains this code
		// Match by comparing trimmed versions to handle indentation differences
		const trimmedCodeToFind = codeToFind.trim();
		for (let i = 0; i < testFileLines.length; i++) {
			// split('\n') always returns a dense array, so testFileLines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures valid index, split() returns dense array
			const testLine = testFileLines[i]!;
			const trimmedTestLine = testLine.trim();

			// Check if the trimmed code appears in the trimmed test line
			// This handles indentation differences while ensuring the code matches
			if (trimmedTestLine.includes(trimmedCodeToFind)) {
				return i + LINE_NUMBER_OFFSET;
			}
		}

		return undefined;
	} catch {
		// Ignore errors when finding line numbers
	}
	return undefined;
}

/**
 * Finds the line number in the XML file for a given example index.
 * @param ruleFilePath - Path to the rule XML file.
 * @param exampleIndex - 1-based example index.
 * @returns Line number in the XML file, or undefined if not found.
 */
function findExampleLineNumber(
	ruleFilePath: Readonly<string>,
	exampleIndex: Readonly<number>,
): number | undefined {
	// readFileSync should never throw as file existence is checked in constructor
	const content = readFileSync(ruleFilePath, 'utf-8');
	const lines = content.split('\n');

	// Find the example tag for this index (0-based in array, 1-based in search)
	// Remove unreachable false branch - we always find the example we're searching for
	let currentExampleIndex = 0;
	const LINE_NUMBER_OFFSET = 1;
	const NOT_FOUND_INDEX = -1;
	const foundIndex = lines.findIndex((line) => {
		if (line.includes('<example>')) {
			currentExampleIndex++;
			// Return true when we find the target example
			// Remove unreachable false branch by using findIndex
			return currentExampleIndex === exampleIndex;
		}
		return false;
	});
	// If example index not found, this means the XML file structure
	// doesn't match what was parsed. This should never happen in normal operation
	// since examples are parsed from the same file. However, we handle it gracefully.
	// For 100% coverage, we need to test this path, so we keep it.
	return foundIndex === NOT_FOUND_INDEX
		? undefined
		: foundIndex + LINE_NUMBER_OFFSET;
}

export {
	getAttributeValue,
	extractCategory,
	initializeResults,
	findMarkerLineNumber,
	findMarkerLineInTestFile,
	findExampleLineNumber,
};
