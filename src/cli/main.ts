/**
 * @file
 * CLI entry point for PMD Rule Tester. Tests PMD rules using examples embedded in XML rule files.
 */
import { existsSync } from 'fs';
import { argv } from 'process';
import { RuleTester } from '../tester/RuleTester.js';

const EXPECTED_ARG_COUNT = 1;
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ERROR = 1;
const ARGV_SLICE_INDEX = 2;

/**
 * Main CLI function that processes command line arguments and executes rule testing.
 * @returns Promise that resolves when testing is complete.
 * @throws {Error} If rule testing fails.
 */
async function main(): Promise<void> {
	const args = argv.slice(ARGV_SLICE_INDEX);

	// Validate arguments
	if (args.length !== EXPECTED_ARG_COUNT) {
		console.log('Usage: test-pmd-rule <rule.xml>');
		console.log(
			'\nThis tool tests PMD rules using examples embedded in XML rule files.',
		);
		console.log('\nRequirements:');
		console.log('- PMD CLI installed and in PATH');
		console.log('- Node.js 25+');
		process.exit(EXIT_CODE_ERROR);
	}

	const FIRST_ARG_INDEX = 0;
	// After length validation, we know args[FIRST_ARG_INDEX] exists
	const ruleFilePath = args[FIRST_ARG_INDEX];
	if (typeof ruleFilePath !== 'string') {
		console.error('❌ Invalid rule file path');
		process.exit(EXIT_CODE_ERROR);
	}

	// Validate rule file
	if (!existsSync(ruleFilePath)) {
		console.error(`❌ Rule file not found: ${ruleFilePath}`);
		process.exit(EXIT_CODE_ERROR);
	}

	if (!ruleFilePath.endsWith('.xml')) {
		console.error('❌ File must be an XML rule file (.xml)');
		process.exit(EXIT_CODE_ERROR);
	}

	const tester = new RuleTester(ruleFilePath);

	try {
		console.log(`\n🧪 Testing rule: ${ruleFilePath}\n`);
		const result = await tester.runCoverageTest();

		// Display detailed test results
		const MIN_DETAILED_RESULTS_COUNT = 0;
		if (
			result.detailedTestResults &&
			result.detailedTestResults.length > MIN_DETAILED_RESULTS_COUNT
		) {
			console.log('📋 Test Details:');
			for (const testResult of result.detailedTestResults) {
				const status = testResult.passed ? '✅' : '❌';
				const testType =
					testResult.testType === 'violation' ? 'Violation' : 'Valid';
				const lineInfo =
					testResult.lineNumber !== undefined
						? ` Line: ${String(testResult.lineNumber)}`
						: '';
				console.log(
					`   - Example ${String(testResult.exampleIndex)} Test: ${testType} ${status}${lineInfo}`,
				);
			}
		}

		// Display summary
		const MIN_COUNT = 0;
		const INDEX_OFFSET = 1;

		// Show overall success
		if (result.success) {
			console.log('\n📊 Test Summary:');
			console.log(`  Examples tested: ${String(result.examplesTested)}`);
			console.log(`  Examples passed: ${String(result.examplesPassed)}`);
			console.log(
				`  Total violations: ${String(result.totalViolations)}`,
			);
			console.log(
				`  Rule triggers violations: ${result.ruleTriggersViolations ? '✅ Yes' : '❌ No'}`,
			);
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
		process.exit(result.success ? EXIT_CODE_SUCCESS : EXIT_CODE_ERROR);
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		console.error(`\n❌ Error: ${errorMessage}`);
		tester.cleanup();
		process.exit(EXIT_CODE_ERROR);
	}
}

// Handle uncaught errors
process.on('uncaughtException', (error: Readonly<Error>) => {
	console.error(`Unexpected error: ${error.message}`);
	process.exit(EXIT_CODE_ERROR);
});

process.on(
	'unhandledRejection',
	(_reason: Readonly<unknown>, _promise: Readonly<Promise<unknown>>) => {
		console.error('Unhandled Rejection at:', _promise, 'reason:', _reason);
		process.exit(EXIT_CODE_ERROR);
	},
);

// Run main if called directly
main().catch((error: unknown) => {
	const errorMessage = error instanceof Error ? error.message : String(error);
	console.error(`Unexpected error: ${errorMessage}`);
	process.exit(EXIT_CODE_ERROR);
});
