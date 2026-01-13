/**
 * @file
 * CLI entry point for PMD Rule Tester. Tests PMD rules using examples embedded in XML rule files.
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { resolve, extname } from 'path';
import { argv } from 'process';
import { cpus } from 'os';
import { RuleTester } from '../tester/RuleTester.js';
import { limitConcurrency } from '../utils/concurrency.js';
import {
	CoverageTracker,
	type CoverageData,
} from '../coverage/trackCoverage.js';
import { generateLcovReport } from '../coverage/generateLcov.js';

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ERROR = 1;
const ARGV_SLICE_INDEX = 2;
const MIN_ARGS_COUNT = 0;
const MAX_ARGS_COUNT = 2;
const FIRST_ARG_INDEX = 0;
const SECOND_ARG_INDEX = 1;
const REPEAT_CHAR_COUNT = 60;
const MIN_FAILED_FILES_COUNT = 0;

/**
 * Recursively finds all XML files in a directory.
 * @param directory - Directory to search.
 * @returns Array of absolute paths to XML files.
 */
function findXmlFiles(directory: string): string[] {
	const xmlFiles: string[] = [];
	const items = readdirSync(directory);

	for (const item of items) {
		const fullPath = resolve(directory, item);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			// Recursively search subdirectories
			xmlFiles.push(...findXmlFiles(fullPath));
		} else if (
			stat.isFile() &&
			extname(fullPath).toLowerCase() === '.xml'
		) {
			xmlFiles.push(fullPath);
		}
	}

	return xmlFiles;
}

/**
 * Test a single rule file.
 * @param ruleFilePath - Path to the XML rule file.
 * @param coverageTracker - Coverage tracker for this file (if coverage is enabled).
 * @param maxConcurrency - Maximum concurrency for example testing.
 * @returns Promise resolving to test result and coverage data.
 */
async function testRuleFile(
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
		const hasCoverageTracker = coverageTracker !== null;
		const MIN_COVERED_LINES_COUNT = 0;
		const coveredLines = result.xpathCoverage.coveredLineNumbers;
		if (
			hasCoverageTracker &&
			coveredLines &&
			coveredLines.length > MIN_COVERED_LINES_COUNT
		) {
			for (const lineNumber of coveredLines) {
				coverageTracker.recordXPathLine(lineNumber);
			}
		}

		// Display results for this file
		console.log(
			`\n🧪 Testing rule: ${ruleFilePath}${coverageTracker ? ' (with coverage)' : ''}\n`,
		);

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
			const INCOMPLETE_STATUS_MESSAGE = '  Status: ⚠️ Incomplete';
			console.log(INCOMPLETE_STATUS_MESSAGE);
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
		const coverageData: CoverageData | undefined =
			coverageTracker !== null
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

/**
 * Main CLI function that processes command line arguments and executes rule testing.
 * @returns Promise that resolves when testing is complete.
 * @throws {Error} If rule testing fails.
 */
async function main(): Promise<void> {
	const args = argv.slice(ARGV_SLICE_INDEX);

	// Validate arguments
	if (args.length === MIN_ARGS_COUNT || args.length > MAX_ARGS_COUNT) {
		console.log('Usage: test-pmd-rule <rule.xml|directory> [--coverage]');
		console.log(
			'\nThis tool tests PMD rules using examples embedded in XML rule files.',
		);
		console.log('\nArguments:');
		console.log(
			'  <rule.xml|directory>  Path to XML rule file or directory containing XML files',
		);
		console.log(
			'  --coverage             Generate LCOV coverage report in coverage/lcov.info',
		);
		console.log('\nRequirements:');
		console.log('- PMD CLI installed and in PATH');
		console.log('- Node.js 25+');
		process.exit(EXIT_CODE_ERROR);
	}

	const pathArg = args[FIRST_ARG_INDEX];
	if (typeof pathArg !== 'string') {
		console.error('❌ Invalid path argument');
		process.exit(EXIT_CODE_ERROR);
	}

	// Check for --coverage flag
	const hasCoverageFlag =
		args.length > SECOND_ARG_INDEX &&
		args[SECOND_ARG_INDEX] === '--coverage';

	// Validate input path
	if (!existsSync(pathArg)) {
		console.error(`❌ Path not found: ${pathArg}`);
		process.exit(EXIT_CODE_ERROR);
	}

	// Determine if path is file or directory and find XML files
	const stat = statSync(pathArg);
	const xmlFiles: string[] = [];

	if (stat.isFile()) {
		// Single file
		if (!pathArg.endsWith('.xml')) {
			console.error('❌ File must be an XML rule file (.xml)');
			process.exit(EXIT_CODE_ERROR);
		}
		xmlFiles.push(pathArg);
	} else if (stat.isDirectory()) {
		// Directory - find all XML files recursively
		xmlFiles.push(...findXmlFiles(pathArg));
		const MIN_XML_FILES_COUNT = 0;
		if (xmlFiles.length === MIN_XML_FILES_COUNT) {
			console.error(`❌ No XML files found in directory: ${pathArg}`);
			process.exit(EXIT_CODE_ERROR);
		}
	} else {
		console.error(`❌ Path is neither a file nor directory: ${pathArg}`);
		process.exit(EXIT_CODE_ERROR);
	}

	// Get CPU count for concurrency
	const cpuCount = cpus().length;
	const maxFileConcurrency = Math.min(xmlFiles.length, cpuCount);

	/**
	 * Use CPU count for example concurrency - PMD processes can handle parallel execution.
	 */
	const maxExampleConcurrency = cpuCount;

	console.log(
		`\n🚀 Processing ${String(xmlFiles.length)} rule file(s) with ${String(maxFileConcurrency)} parallel workers`,
	);
	console.log(
		`   Each file will test examples with up to ${String(maxExampleConcurrency)} parallel workers\n`,
	);

	// Create coverage trackers if coverage is enabled
	const coverageTrackers: Map<string, CoverageTracker> | null =
		hasCoverageFlag ? new Map<string, CoverageTracker>() : null;

	// Create tasks for each file
	interface TaskResult {
		filePath: string;
		success: boolean;
		error?: string;
		coverageData?: Readonly<CoverageData>;
	}
	const tasks: (() => Promise<TaskResult>)[] = xmlFiles.map(
		(filePath: Readonly<string>) => async (): Promise<TaskResult> => {
			const tracker =
				coverageTrackers !== null
					? (coverageTrackers.get(filePath) ??
						new CoverageTracker(filePath))
					: null;
			if (tracker !== null && coverageTrackers !== null) {
				coverageTrackers.set(filePath, tracker);
			}
			return testRuleFile(filePath, tracker, maxExampleConcurrency);
		},
	);

	// Execute tasks with concurrency limit
	const results = await limitConcurrency(tasks, maxFileConcurrency);

	// Summarize results
	const successfulFiles = results.filter(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
		(r: Readonly<TaskResult>) => r.success,
	).length;
	const failedFiles = results.filter(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
		(r: Readonly<TaskResult>) => !r.success,
	).length;

	console.log('\n' + '='.repeat(REPEAT_CHAR_COUNT));
	console.log('🎯 OVERALL RESULTS');
	console.log('='.repeat(REPEAT_CHAR_COUNT));
	console.log(`Total files processed: ${String(xmlFiles.length)}`);
	console.log(`Successful: ${String(successfulFiles)}`);
	console.log(`Failed: ${String(failedFiles)}`);

	if (failedFiles > MIN_FAILED_FILES_COUNT) {
		console.log('\n❌ Failed files:');
		results
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			.filter((r: Readonly<TaskResult>) => !r.success)
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			.forEach((result: Readonly<TaskResult>) => {
				const errorMessage = result.error ?? '';
				const MIN_ERROR_LENGTH = 0;
				const errorSuffix =
					errorMessage.length > MIN_ERROR_LENGTH
						? `: ${errorMessage}`
						: '';
				console.log(`  - ${result.filePath}${errorSuffix}`);
			});
	}

	// Generate coverage report if --coverage flag is set
	if (hasCoverageFlag && coverageTrackers !== null) {
		const coverageData: CoverageData[] = Array.from(
			coverageTrackers.values(),
		).map((tracker: Readonly<CoverageTracker>) =>
			tracker.getCoverageData(),
		);
		try {
			generateLcovReport(coverageData, 'coverage/lcov.info');
			console.log('\n📊 Coverage report generated: coverage/lcov.info');
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				`\n❌ Error generating coverage report: ${errorMessage}`,
			);
			process.exit(EXIT_CODE_ERROR);
		}
	}

	process.exit(
		failedFiles === MIN_FAILED_FILES_COUNT
			? EXIT_CODE_SUCCESS
			: EXIT_CODE_ERROR,
	);
}

// Handle uncaught errors
process.on('uncaughtException', (error: Readonly<Error>) => {
	console.error(`Unexpected error: ${error.message}`);
	process.exit(EXIT_CODE_ERROR);
});

process.on(
	'unhandledRejection',
	(_reason: Readonly<unknown>, _promise: Readonly<Promise<unknown>>) => {
		const reasonString =
			typeof _reason === 'string'
				? _reason
				: _reason instanceof Error
					? _reason.message
					: JSON.stringify(_reason);
		const promiseString = '[Promise]';
		console.error(
			`Unhandled Rejection at: ${promiseString}, reason: ${reasonString}`,
		);
		process.exit(EXIT_CODE_ERROR);
	},
);

// Run main if called directly
main().catch((error: unknown) => {
	const errorMessage = error instanceof Error ? error.message : String(error);
	console.error(`Unexpected error: ${errorMessage}`);
	process.exit(EXIT_CODE_ERROR);
});
