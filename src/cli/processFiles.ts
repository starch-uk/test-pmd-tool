/**
 * @file
 * File processing utilities for rule testing.
 */
import { RuleTester } from '../tester/RuleTester.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- CoverageTracker is used as a value (calling getCoverageData method)
import { CoverageTracker } from '../coverage/trackCoverage.js';
import type { CoverageData } from '../coverage/trackCoverage.js';

const PARSE_INT_RADIX = 10;
const LINE_NUMBER_MATCH_GROUP_INDEX = 1;
const MIN_DETAILED_RESULTS_COUNT = 0;
const MIN_EXAMPLES_COUNT = 0;
const MIN_COUNT = 0;
const INDEX_OFFSET = 1;

/**
 * Test a single rule file.
 * @param ruleFilePath - Path to the XML rule file.
 * @param coverageTracker - Coverage tracker for this file (if coverage is enabled).
 * @param maxConcurrency - Maximum concurrency for example testing.
 * @returns Promise resolving to test result and coverage data.
 */
export async function testRuleFile(
	ruleFilePath: Readonly<string>,
	coverageTracker: Readonly<CoverageTracker | null>,
	maxConcurrency: Readonly<number>,
): Promise<{
	filePath: string;
	success: boolean;
	error?: string;
	coverageData?: Readonly<CoverageData>;
}> {
	try {
		const tester = new RuleTester(ruleFilePath);
		const result = await tester.runCoverageTest(false, maxConcurrency);

		// Record coverage data if tracker is provided
		if (coverageTracker && result.xpathCoverage.coveredLineNumbers) {
			for (const lineNumber of result.xpathCoverage.coveredLineNumbers) {
				coverageTracker.recordXPathLine(lineNumber);
			}
		}

		// Display results for this file
		console.log(
			`\n🧪 Testing rule: ${ruleFilePath}${coverageTracker ? ' (with coverage)' : ''}\n`,
		);

		// Display detailed test results
		const hasDetailedResults =
			result.detailedTestResults !== undefined &&
			result.detailedTestResults.length > MIN_DETAILED_RESULTS_COUNT;
		// Type assertion: hasDetailedResults ensures result.detailedTestResults is non-null
		const hasExamples = result.examplesTested > MIN_EXAMPLES_COUNT;
		if (hasDetailedResults || hasExamples) {
			console.log('📋 Test Details:');

			const forbiddenExampleIndices = new Set<number>();

			// Surface forbidden method name failures as primary test failures
			if (
				result.qualityChecks &&
				result.qualityChecks.issues.length > MIN_DETAILED_RESULTS_COUNT
			) {
				const FORBIDDEN_METHOD_MESSAGE =
					"You can't call a method testMethod in examples";
				const forbiddenMethodIssues =
					result.qualityChecks.issues.filter((issue) =>
						issue.includes(FORBIDDEN_METHOD_MESSAGE),
					);
				for (const issue of forbiddenMethodIssues) {
					console.log(`   - ${issue} ❌`);

					// Extract example index from message: "... Example N: ..."
					const exampleMatch = /Example\s+(\d+):/.exec(issue);
					const FIRST_CAPTURE_GROUP = 1;
					const exampleIndexString =
						exampleMatch?.[FIRST_CAPTURE_GROUP];
					if (exampleIndexString !== undefined) {
						const exampleIndex = Number.parseInt(
							exampleIndexString,
							PARSE_INT_RADIX,
						);
						if (!Number.isNaN(exampleIndex)) {
							forbiddenExampleIndices.add(exampleIndex);
						}
					}
				}
			}

			if (
				hasDetailedResults &&
				result.detailedTestResults !== undefined
			) {
				for (const testResult of result.detailedTestResults) {
					// Skip further checks for examples that violated the testMethod rule
					if (forbiddenExampleIndices.has(testResult.exampleIndex)) {
						continue;
					}

					const status = testResult.passed ? '✅' : '❌';
					const lineNumber =
						testResult.lineNumber !== undefined
							? String(testResult.lineNumber)
							: '?';
					const message =
						testResult.testType === 'violation'
							? testResult.passed
								? 'Violation triggered'
								: 'Violation not triggered'
							: testResult.passed
								? 'Valid not triggered'
								: 'Valid triggered';
					console.log(
						`   - Line: ${lineNumber}, Example ${String(testResult.exampleIndex)}: ${message} ${status}`,
					);
				}
			} else if (hasExamples) {
				console.log(
					`   No detailed test results available (${String(result.examplesTested)} example(s) were tested)`,
				);
			}
		}

		// Display summary
		// Show overall success
		console.log('\n📊 Test Summary:');
		console.log(`  Examples tested: ${String(result.examplesTested)}`);
		console.log(`  Examples passed: ${String(result.examplesPassed)}`);
		console.log(`  Total violations: ${String(result.totalViolations)}`);
		console.log(
			`  Rule triggers violations: ${result.ruleTriggersViolations ? '✅ Yes' : '❌ No'}`,
		);

		// Quality Checks
		if (result.qualityChecks) {
			console.log('\n⭐ Quality Checks:');
			if (result.qualityChecks.passed) {
				console.log('  Status: ✅ Passed');
			} else {
				console.log('  Status: ⚠️ Incomplete');
				// Sort issues by line number, then by message
				const FORBIDDEN_METHOD_MESSAGE =
					"You can't call a method testMethod in examples";
				const sortedIssues = result.qualityChecks.issues
					// Exclude forbidden method name failures from Quality Checks output;
					// they are shown under Test Details instead.
					.filter(
						(issue) => !issue.includes(FORBIDDEN_METHOD_MESSAGE),
					)
					.sort((a: string, b: string) => {
						// Extract line numbers from "Line X: ..." format
						const lineMatchA = /^Line\s+(\d+):/.exec(a);
						const lineMatchB = /^Line\s+(\d+):/.exec(b);
						const lineNumberA =
							lineMatchA?.[LINE_NUMBER_MATCH_GROUP_INDEX];
						const lineNumberB =
							lineMatchB?.[LINE_NUMBER_MATCH_GROUP_INDEX];
						const lineNumA = lineMatchA
							? Number.parseInt(
									lineNumberA ?? '',
									PARSE_INT_RADIX,
								)
							: Number.MAX_SAFE_INTEGER;
						const lineNumB = lineMatchB
							? Number.parseInt(
									lineNumberB ?? '',
									PARSE_INT_RADIX,
								)
							: Number.MAX_SAFE_INTEGER;

						// Sort by line number first
						if (lineNumA !== lineNumB) {
							return lineNumA - lineNumB;
						}

						// If same line number (or both have no line), sort by message
						return a.localeCompare(b);
					});
				for (const issue of sortedIssues) {
					console.log(`  - ${issue}`);
				}
			}
		}

		// XPath Coverage Details
		console.log('\n🔍 XPath Coverage:');
		if (result.xpathCoverage.overallSuccess) {
			console.log('  Status: ✅ Complete');
		} else {
			console.log('  Status: ⚠️ Incomplete');
		}

		if (result.xpathCoverage.coverage.length > MIN_COUNT) {
			console.log(
				`  Coverage items: ${String(result.xpathCoverage.coverage.length)}`,
			);
			result.xpathCoverage.coverage.forEach(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
				(coverage, index) => {
					const itemNumber = index + INDEX_OFFSET;
					// Determine status icon: ✅ for complete, ⚠️ for incomplete, ❌ for failed
					const status: string = coverage.success
						? '✅'
						: coverage.evidence.some(
									// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for some
									(evidence) =>
										evidence.count > MIN_COUNT &&
										evidence.count < evidence.required,
							  )
							? '⚠️'
							: '❌';
					console.log(
						`    ${String(itemNumber)}. ${status} ${coverage.message}`,
					);
					if (coverage.evidence.length > MIN_COUNT) {
						coverage.evidence.forEach(
							// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
							(evidence) => {
								const { description } = evidence;
								// Only show description if it has content (not empty)
								if (description.length > MIN_COUNT) {
									// Check if description contains newlines (for conditionals, node types, etc.)
									if (description.includes('\n')) {
										// Split by newline and indent each line
										description
											.split('\n')
											.forEach(
												(line: Readonly<string>) => {
													console.log(
														`         ${line}`,
													);
												},
											);
									} else {
										console.log(`         ${description}`);
									}
								}
							},
						);
					}
				},
			);
		}

		if (result.hardcodedValues.length > MIN_COUNT) {
			console.log(
				`\n⚠️  Hardcoded values found: ${String(result.hardcodedValues.length)}`,
			);
			result.hardcodedValues.forEach(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
				(issue) => {
					console.log(
						`  - ${issue.type}: ${issue.value} (${issue.severity})`,
					);
				},
			);
		}

		// Determine final status based on coverage completeness
		const isCoverageIncomplete = !result.xpathCoverage.overallSuccess;
		if (result.success && !isCoverageIncomplete) {
			console.log('\n✅ All tests passed!');
		} else if (isCoverageIncomplete) {
			console.log('\n❌ Tests failed, incomplete coverage');
		}

		tester.cleanup();
		const coverageData = coverageTracker
			? coverageTracker.getCoverageData()
			: undefined;
		return {
			coverageData,
			filePath: ruleFilePath,
			success: result.success,
		};
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		console.error(`\n❌ Error testing ${ruleFilePath}: ${errorMessage}`);
		return { error: errorMessage, filePath: ruleFilePath, success: false };
	}
}
