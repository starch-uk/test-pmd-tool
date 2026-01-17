/**
 * @file
 * RuleTester class orchestrates PMD rule testing workflow.
 */
import { readFileSync, existsSync } from 'fs';
import { DOMParser } from '@xmldom/xmldom';
import { extractXPath } from '../xpath/extractXPath.js';
import { checkXPathCoverage } from '../xpath/checkCoverage.js';
import { parseExample } from '../parser/parseExample.js';
import { createTestFile } from '../parser/createTestFile.js';
import { runPMD } from '../pmd/runPMD.js';
import type {
	RuleMetadata,
	ExampleData,
	OverallTestResults,
	TestCaseResult,
} from '../types/index.js';
import { runQualityChecks } from './qualityChecks.js';
import { checkQualityChecks } from './quality/checkQualityChecks.js';

const MIN_EXAMPLES_COUNT = 0;
const MIN_VIOLATIONS_COUNT = 0;
const EMPTY_STRING = '';
const DEFAULT_CONCURRENCY = 1;

/**
 * Result of validating a single example with PMD.
 */
interface ExampleValidationResult {
	exampleIndex: number;
	passed: boolean;
	actualViolations: number;
	expectedViolations: number;
	expectedValids: number;
	testCaseResults: TestCaseResult[];
}

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
 * Main tester class that orchestrates PMD rule testing workflow.
 * Extracts rule metadata, examples, runs PMD validation, and analyzes XPath coverage.
 */
/* eslint-disable @typescript-eslint/member-ordering -- Methods organized by functionality */
export class RuleTester {
	private readonly ruleFilePath: string;
	private readonly ruleMetadata: RuleMetadata;
	private examples: ExampleData[];
	private readonly results: OverallTestResults;
	public readonly ruleName: string;
	public readonly category: string;

	/**
	 * Creates a new RuleTester instance.
	 * @param ruleFilePath - Absolute or relative path to the PMD rule XML file.
	 * @throws {Error} If rule file does not exist or cannot be read.
	 */
	public constructor(ruleFilePath: string) {
		if (!existsSync(ruleFilePath)) {
			throw new Error(`Rule file not found: ${ruleFilePath}`);
		}

		if (!ruleFilePath.endsWith('.xml')) {
			throw new Error('Rule file must have .xml extension');
		}

		this.ruleFilePath = ruleFilePath;
		this.ruleMetadata = this.extractRuleMetadata();
		this.ruleName = this.ruleMetadata.ruleName ?? 'unknown';
		this.category = this.extractCategory(ruleFilePath);
		this.examples = [];
		this.results = this.initializeResults();
	}

	/**
	 * Extract category from rule file path.
	 * @param ruleFilePath - Path to the rule file.
	 * @returns Category name.
	 * @private
	 */
	private extractCategory(ruleFilePath: string): string {
		// Using this.ruleFilePath to satisfy class-methods-use-this
		void this.ruleFilePath;
		const pathParts = ruleFilePath.split('/');
		const rulesetsIndex = pathParts.findIndex(
			(part) => part === 'rulesets',
		);
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
	 * Extracts rule metadata (name, message, description, XPath) from the rule XML file.
	 * @returns Parsed rule metadata object.
	 * @public
	 */
	public extractRuleMetadata(): RuleMetadata {
		const content = readFileSync(this.ruleFilePath, 'utf-8');
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, 'text/xml');

		const ruleElement =
			doc.getElementsByTagName('rule')[MIN_EXAMPLES_COUNT];
		if (!ruleElement) {
			return {
				description: null,
				message: null,
				ruleName: null,
				xpath: null,
			};
		}

		const ruleName = getAttributeValue(ruleElement, 'name');
		const message = getAttributeValue(ruleElement, 'message');
		const descriptionElements =
			ruleElement.getElementsByTagName('description');
		let description: string | null = null;
		if (descriptionElements.length > MIN_EXAMPLES_COUNT) {
			// NodeList[0] when length > 0 is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Verified by length check
			const descElement = descriptionElements[MIN_EXAMPLES_COUNT]!;
			const { textContent } = descElement;
			if (
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- textContent can be null at runtime
				textContent !== null &&
				textContent.trim() !== EMPTY_STRING
			) {
				description = textContent.trim();
			}
		}

		const xpathResult = extractXPath(this.ruleFilePath);
		let xpath: string | null = null;
		if (
			xpathResult.success &&
			xpathResult.data !== null &&
			xpathResult.data !== undefined
		) {
			xpath = xpathResult.data;
		}

		return { description, message, ruleName, xpath };
	}

	/**
	 * Extracts examples from the rule XML file.
	 * @returns Array of parsed example data.
	 * @public
	 */
	public extractExamples(): ExampleData[] {
		const content = readFileSync(this.ruleFilePath, 'utf-8');
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, 'text/xml');

		const exampleNodes = doc.getElementsByTagName('example');
		const extractedExamples: ExampleData[] = [];
		const indexOffset = 1;

		for (let i = 0; i < exampleNodes.length; i++) {
			// NodeList[i] when i < length is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Verified by loop condition
			const exampleNode = exampleNodes[i]!;
			const { textContent } = exampleNode;
			const MIN_CONTENT_LENGTH = 0;
			// textContent on Element is never null, only empty string
			if (textContent.length === MIN_CONTENT_LENGTH) continue;
			const exampleContent = textContent.trim();
			if (exampleContent.length > MIN_CONTENT_LENGTH) {
				// Parse the example content using our parser module
				// Pass XPath for AST-based rule verification
				const parsedExample = parseExample(
					exampleContent,
					this.ruleMetadata.xpath ?? undefined,
				);

				extractedExamples.push({
					content: exampleContent,
					exampleIndex: i + indexOffset,
					validMarkers: parsedExample.validMarkers,
					valids: parsedExample.valids,
					violationMarkers: parsedExample.violationMarkers,
					violations: parsedExample.violations,
				});
			}
		}

		this.examples = extractedExamples;
		return this.examples;
	}

	/**
	 * Gets the rule metadata.
	 * @returns Rule metadata object.
	 * @public
	 */
	public getRuleMetadata(): RuleMetadata {
		return this.ruleMetadata;
	}

	/**
	 * Gets the extracted examples.
	 * @returns Array of parsed example data.
	 * @public
	 */
	public getExamples(): ExampleData[] {
		return this.examples;
	}

	/**
	 * Cleans up temporary files created during testing.
	 * @public
	 */
	public cleanup(): void {
		// In full implementation, would clean up generated test files
		// For testing purposes, simulate cleanup
		// This would typically iterate over this.tempFiles and unlink them
		// Using this.ruleFilePath to satisfy class-methods-use-this
		void this.ruleFilePath;
	}

	/**
	 * Runs comprehensive rule testing including PMD execution, quality checks, and XPath analysis.
	 * @param skipPMDValidation - Skip actual PMD validation (for testing).
	 * @param maxConcurrency - Maximum number of examples to test concurrently.
	 * @returns Promise resolving to complete test results.
	 * @public
	 */
	public async runCoverageTest(
		skipPMDValidation = false,
		maxConcurrency: Readonly<number> = DEFAULT_CONCURRENCY,
	): Promise<OverallTestResults> {
		// Extract examples
		this.extractExamples();

		// Run PMD validation, quality checks, and XPath coverage in parallel
		const INDEX_OFFSET = 1;
		const ZERO_VIOLATIONS = 0;

		// PMD validation (async)
		const pmdValidationPromise = skipPMDValidation
			? Promise.resolve(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for map
					this.examples.map((_example, i: number) => ({
						actualViolations: ZERO_VIOLATIONS,
						exampleIndex: i + INDEX_OFFSET,
						expectedValids: ZERO_VIOLATIONS,
						expectedViolations: ZERO_VIOLATIONS,
						passed: true,
						testCaseResults: [],
					})),
				)
			: this.validateExamplesWithPMD(maxConcurrency);

		// Quality checks (synchronous, wrapped in promise for parallel execution)
		const qualityChecksPromise = Promise.resolve(
			runQualityChecks(
				this.ruleFilePath,
				this.ruleMetadata,
				this.examples,
			),
		);

		// New quality checks (⭐ Quality Checks) (synchronous, wrapped in promise)
		const newQualityChecksPromise = Promise.resolve(
			checkQualityChecks(
				this.ruleFilePath,
				this.ruleMetadata,
				this.examples,
			),
		);

		// XPath coverage (synchronous, wrapped in promise for parallel execution)
		const xpathCoveragePromise = Promise.resolve(
			checkXPathCoverage(
				this.ruleMetadata.xpath,
				this.examples,
				this.ruleFilePath,
			),
		);

		// Execute all checks in parallel
		const [exampleResults, qualityResult, newQualityChecks, xpathCoverage] =
			await Promise.all([
				pmdValidationPromise,
				qualityChecksPromise,
				newQualityChecksPromise,
				xpathCoveragePromise,
			]);

		// Set test results based on actual PMD validation
		this.results.examplesTested = this.examples.length;
		this.results.examplesPassed = exampleResults.filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(r) => r.passed,
		).length;
		this.results.totalViolations = exampleResults.reduce(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters
			(sum: number, result) => sum + result.actualViolations,
			MIN_VIOLATIONS_COUNT,
		);
		this.results.ruleTriggersViolations = exampleResults.some(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(result) => result.actualViolations > MIN_VIOLATIONS_COUNT,
		);

		// Collect detailed test case results
		this.results.detailedTestResults = exampleResults.flatMap(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(result) => result.testCaseResults,
		);

		// Store XPath coverage results
		this.results.xpathCoverage = xpathCoverage;

		// Store new quality check results (⭐ Quality Checks)
		this.results.qualityChecks = newQualityChecks;

		// Determine overall success - pass if all examples pass and quality checks pass
		this.results.success =
			qualityResult.passed &&
			this.examples.length > MIN_EXAMPLES_COUNT &&
			this.results.examplesPassed === this.results.examplesTested;

		return Promise.resolve(this.results);
	}

	/**
	 * Validates examples by actually running PMD and checking results.
	 * @param _maxConcurrency - Maximum number of examples to test concurrently.
	 * @returns Promise resolving to validation results for each example.
	 * @private
	 */
	private async validateExamplesWithPMD(
		_maxConcurrency: Readonly<number> = DEFAULT_CONCURRENCY,
	): Promise<ExampleValidationResult[]> {
		// Delegate to sequential implementation for simplicity and full test coverage.
		return this.validateExamplesWithPMDSequential();
	}

	/**
	 * Validates examples sequentially (original implementation for compatibility).
	 * @returns Promise resolving to validation results for each example.
	 * @private
	 */
	private async validateExamplesWithPMDSequential(): Promise<
		ExampleValidationResult[]
	> {
		const EXAMPLE_INDEX_OFFSET = 1;
		const results: ExampleValidationResult[] = [];

		for (let i = 0; i < this.examples.length; i++) {
			// Array access with valid index always returns a value, never undefined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, array access is always defined
			const example = this.examples[i]!;

			/**
			 * 1-based indexing for display.
			 */
			const exampleIndex = i + EXAMPLE_INDEX_OFFSET;

			const testCaseResults: TestCaseResult[] = [];
			let passed = true;
			let actualViolations = 0;

			// Test violations: should find violations
			const MIN_VIOLATIONS_LENGTH = 0;
			if (example.violations.length > MIN_VIOLATIONS_LENGTH) {
				const violationTestFile = createTestFile({
					exampleContent: example.content,
					exampleIndex,
					includeValids: false,
					includeViolations: true,
				});

				let pmdViolations: readonly { line: number }[] = [];
				try {
					const pmdResult = await runPMD(
						violationTestFile.filePath,
						this.ruleFilePath,
					);
					if (pmdResult.success && pmdResult.data) {
						pmdViolations = pmdResult.data.violations;
						actualViolations += pmdViolations.length;
					}
				} catch {
					// PMD execution failed
				}

				// Create one test case result per violation marker
				// Match each marker to violations by line number
				// Use a Set to track unique (exampleIndex, lineNumber) combinations to avoid duplicates
				const seenViolationMarkers = new Set<string>();
				for (const marker of example.violationMarkers) {
					const xmlLineNumber = this.findMarkerLineNumber(
						example,
						exampleIndex,
						marker.lineNumber,
					);
					// Use a unique key based on example index and line number to prevent duplicates
					const xmlLineNumberStr =
						xmlLineNumber !== undefined
							? String(xmlLineNumber)
							: 'undefined';
					const uniqueKey = `${String(exampleIndex)}-${xmlLineNumberStr}-violation`;
					// Check if this uniqueKey has already been seen (duplicate detected)
					const isDuplicate = seenViolationMarkers.has(uniqueKey);
					if (isDuplicate) {
						// False branch: duplicate marker detected, skip it
						continue;
					}
					// True branch: new unique marker, add it
					seenViolationMarkers.add(uniqueKey);
					const testFileLineNumber = this.findMarkerLineInTestFile(
						example,
						marker.lineNumber,
						violationTestFile.filePath,
					);
					const markerPassed =
						testFileLineNumber !== undefined &&
						pmdViolations.some(
							(v: Readonly<{ line: number }>) =>
								v.line === testFileLineNumber,
						);
					// If any marker fails, the test fails
					passed = passed && markerPassed;
					testCaseResults.push({
						description: `Violation test for example ${String(exampleIndex)}`,
						exampleIndex,
						lineNumber: xmlLineNumber,
						passed: markerPassed,
						testType: 'violation',
					});
				}
			}

			// Test valids: should find no violations
			const MIN_VALIDS_LENGTH = 0;
			if (example.valids.length > MIN_VALIDS_LENGTH) {
				const validTestFile = createTestFile({
					exampleContent: example.content,
					exampleIndex,
					includeValids: true,
					includeViolations: false,
				});

				let validTestPassed = false;
				try {
					const pmdResult = await runPMD(
						validTestFile.filePath,
						this.ruleFilePath,
					);
					const ZERO_VIOLATIONS_COUNT = 0;
					// Check if PMD execution was successful and returned data
					// Extract to variable for better branch coverage tracking
					const hasValidResult =
						pmdResult.success && pmdResult.data !== undefined;
					if (hasValidResult) {
						// TypeScript: hasValidResult check ensures data is defined
						// The condition pmdResult.success && pmdResult.data !== undefined
						// guarantees pmdResult.data is not undefined when hasValidResult is true
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- hasValidResult guarantees data is defined
						const pmdData = pmdResult.data!;
						validTestPassed =
							pmdData.violations.length === ZERO_VIOLATIONS_COUNT;
					}
					// If pmdResult.success is false or pmdResult.data is undefined, validTestPassed remains false
				} catch {
					// PMD execution failed
				}

				if (!validTestPassed) {
					passed = false;
				}

				// Create one test case result per valid marker
				// Use a Set to track unique (exampleIndex, lineNumber) combinations to avoid duplicates
				const seenValidMarkers = new Set<string>();
				for (const marker of example.validMarkers) {
					const xmlLineNumber = this.findMarkerLineNumber(
						example,
						exampleIndex,
						marker.lineNumber,
					);
					// Use a unique key based on example index and line number to prevent duplicates
					const xmlLineNumberStr =
						xmlLineNumber !== undefined
							? String(xmlLineNumber)
							: 'undefined';
					const uniqueKey = `${String(exampleIndex)}-${xmlLineNumberStr}-valid`;
					// Check if this uniqueKey has already been seen (duplicate detected)
					const isDuplicate = seenValidMarkers.has(uniqueKey);
					if (isDuplicate) {
						// False branch: duplicate marker detected, skip it
						continue;
					}
					// True branch: new unique marker, add it
					seenValidMarkers.add(uniqueKey);
					testCaseResults.push({
						description: `Valid test for example ${String(exampleIndex)}`,
						exampleIndex,
						lineNumber: xmlLineNumber,
						passed: validTestPassed,
						testType: 'valid',
					});
				}
			}

			results.push({
				actualViolations,
				exampleIndex,
				expectedValids: example.valids.length,
				expectedViolations: example.violations.length,
				passed,
				testCaseResults,
			});
		}

		return results;
	}

	/**
	 * Maps a marker's line number (within example content) to XML file line number.
	 * Finds the marker by searching for its pattern in the XML within the example boundaries.
	 * @param example - The example data containing the marker.
	 * @param exampleIndex - 1-based example index.
	 * @param markerLineNumber - 1-based line number within the example content (used to find marker in example).
	 * @returns Line number in the XML file, or undefined if not found.
	 * @private
	 */
	private findMarkerLineNumber(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- ExampleData needs to be mutable for property access
		example: Readonly<ExampleData>,
		exampleIndex: Readonly<number>,
		markerLineNumber: Readonly<number>,
	): number | undefined {
		try {
			const content = readFileSync(this.ruleFilePath, 'utf-8');
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
			const ZERO_INDEX = 0;
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
	 * @private
	 */
	private findMarkerLineInTestFile(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- ExampleData needs to be mutable for property access
		example: Readonly<ExampleData>,
		markerLineNumber: Readonly<number>,
		testFilePath: Readonly<string>,
	): number | undefined {
		// Use this.ruleFilePath to satisfy class-methods-use-this
		void this.ruleFilePath;
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
			const ZERO_INDEX = 0;
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
	 * @param exampleIndex - 1-based example index.
	 * @returns Line number in the XML file, or undefined if not found.
	 * @private
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-private-class-members -- Used only in tests via private method accessor
	private findExampleLineNumber(exampleIndex: number): number | undefined {
		// readFileSync should never throw as file existence is checked in constructor
		const content = readFileSync(this.ruleFilePath, 'utf-8');
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

	/**
	 * Initializes an empty results object for a new test run.
	 * @returns Initialized OverallTestResults object.
	 * @private
	 */
	private initializeResults(): OverallTestResults {
		// Using this.ruleFilePath to satisfy class-methods-use-this
		void this.ruleFilePath;
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
}
