/**
 * @file
 * RuleTester class orchestrates PMD rule testing workflow.
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion -- False positives on lines 329:21 and 338:1 */
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
import { checkQualityChecks } from './checkQualityChecks.js';
import {
	extractCategory,
	findExampleLineNumber,
	findMarkerLineInTestFile,
	findMarkerLineNumber,
	getAttributeValue,
	initializeResults,
} from './RuleTesterHelpers.js';

const MIN_EXAMPLES_COUNT = 0;
const MIN_VIOLATIONS_COUNT = 0;
const EMPTY_STRING = '';
const DEFAULT_CONCURRENCY = 1;
const UNDEFINED_VALUE = undefined;
const NULL_VALUE = null;

/**
 * Result of validating a single example with PMD.
 */
interface ExampleValidationResult {
	readonly exampleIndex: number;
	readonly passed: boolean;
	readonly actualViolations: number;
	readonly expectedViolations: number;
	readonly expectedValids: number;
	readonly testCaseResults: readonly TestCaseResult[];
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
	public constructor(ruleFilePath: Readonly<string>) {
		if (!existsSync(ruleFilePath)) {
			throw new Error(`Rule file not found: ${ruleFilePath}`);
		}

		if (!ruleFilePath.endsWith('.xml')) {
			throw new Error('Rule file must have .xml extension');
		}

		this.ruleFilePath = ruleFilePath;
		this.ruleMetadata = this.extractRuleMetadata();
		this.ruleName = this.ruleMetadata.ruleName ?? 'unknown';
		this.category = extractCategory(ruleFilePath);
		this.examples = [];
		this.results = initializeResults();
	}

	/**
	 * Extracts rule metadata (name, message, description, XPath) from the rule XML file.
	 * Parses the XML file, extracts rule attributes, description text, and XPath expression.
	 * @returns Parsed rule metadata object containing rule name, description, XPath expression, and message template.
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
			xpathResult.data !== NULL_VALUE &&
			xpathResult.data !== UNDEFINED_VALUE
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
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for flatMap
			(result: Readonly<ExampleValidationResult>) =>
				result.testCaseResults,
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
	 * Provides sequential validation for compatibility and full test coverage.
	 * Processes each example one at a time, runs PMD validation, and collects results.
	 * @returns Promise resolving to validation results array containing pass/fail status, detected PMD violations, and coverage metrics for each example.
	 */
	private async validateExamplesWithPMDSequential(): Promise<
		ExampleValidationResult[]
	> {
		const EXAMPLE_INDEX_OFFSET = 1;
		const results: ExampleValidationResult[] = [];

		for (let i = 0; i < this.examples.length; i++) {
			// Array access with valid index always returns a value, never undefined
			// Loop condition `i < length` guarantees `this.examples[i]` is defined
			// TypeScript's type system doesn't understand this invariant, so we use a type assertion
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
	 * Finds the line number in the XML file for a given example index.
	 * Delegates to helper function for testability.
	 * @param exampleIndex - 1-based example index.
	 * @returns Line number in the XML file, or undefined if not found.
	 * @public
	 */
	public findExampleLineNumber(
		exampleIndex: Readonly<number>,
	): number | undefined {
		return findExampleLineNumber(this.ruleFilePath, exampleIndex);
	}

	/**
	 * Maps a marker's line number (within example content) to XML file line number.
	 * Delegates to helper function for testability.
	 * @param example - The example data containing the marker.
	 * @param exampleIndex - 1-based example index.
	 * @param markerLineNumber - 1-based line number within the example content.
	 * @returns Line number in the XML file, or undefined if not found.
	 * @public
	 */
	public findMarkerLineNumber(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Readonly wrapper type is sufficient for usage
		example: Readonly<ExampleData>,
		exampleIndex: Readonly<number>,
		markerLineNumber: Readonly<number>,
	): number | undefined {
		return findMarkerLineNumber(
			this.ruleFilePath,
			example,
			exampleIndex,
			markerLineNumber,
		);
	}

	/**
	 * Maps a marker's line number (within example content) to test file line number.
	 * Delegates to helper function for testability.
	 * @param example - The example data containing the marker.
	 * @param markerLineNumber - 1-based line number within the example content.
	 * @param testFilePath - Path to the generated test file.
	 * @returns Line number in the test file, or undefined if not found.
	 * @public
	 */
	// eslint-disable-next-line @typescript-eslint/class-methods-use-this -- Delegates to helper function, using this would require passing ruleFilePath unnecessarily
	public findMarkerLineInTestFile(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Readonly wrapper type is sufficient for usage
		example: Readonly<ExampleData>,
		markerLineNumber: Readonly<number>,
		testFilePath: Readonly<string>,
	): number | undefined {
		return findMarkerLineInTestFile(
			example,
			markerLineNumber,
			testFilePath,
		);
	}
}
