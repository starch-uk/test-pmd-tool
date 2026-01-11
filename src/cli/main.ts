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
	const ruleFilePath: string = args[FIRST_ARG_INDEX] ?? '';

	if (!ruleFilePath) {
		console.error('❌ No rule file path provided');
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

		// Display results
		const MIN_COUNT = 0;
		const INDEX_OFFSET = 1;
		console.log('\n📊 Test Results:');
		console.log(`  Examples tested: ${String(result.examplesTested)}`);
		console.log(`  Examples passed: ${String(result.examplesPassed)}`);
		console.log(`  Total violations: ${String(result.totalViolations)}`);
		console.log(
			`  Rule triggers violations: ${result.ruleTriggersViolations ? '✅ Yes' : '❌ No'}`,
		);

		// XPath Coverage Details
		console.log('\n🔍 XPath Coverage:');
		if (result.xpathCoverage.overallSuccess) {
			console.log('  Status: ✅ Complete');
		} else {
			console.log('  Status: ⚠️  Incomplete');
		}

		if (result.xpathCoverage.coverage.length > MIN_COUNT) {
			console.log(
				`  Coverage items: ${String(result.xpathCoverage.coverage.length)}`,
			);
			result.xpathCoverage.coverage.forEach(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
				(coverage, index) => {
					const status = coverage.success ? '✅' : '❌';
					const itemNumber = index + INDEX_OFFSET;
					console.log(
						`    ${String(itemNumber)}. ${status} ${coverage.message}`,
					);
					if (coverage.evidence.length > MIN_COUNT) {
						coverage.evidence.forEach(
							// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
							(evidence) => {
								const evidenceStatus =
									evidence.count >= evidence.required
										? '✅'
										: '⚠️';
								console.log(
									`       ${evidenceStatus} ${evidence.description} (${String(evidence.count)}/${String(evidence.required)})`,
								);
							},
						);
					}
				},
			);
		}

		if (result.xpathCoverage.uncoveredBranches.length > MIN_COUNT) {
			console.log(
				`\n  Uncovered branches (${String(result.xpathCoverage.uncoveredBranches.length)}):`,
			);
			result.xpathCoverage.uncoveredBranches.forEach((branch) => {
				console.log(`    - ${branch}`);
			});
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

		if (result.success) {
			console.log('\n✅ All tests passed!');
		} else {
			console.log('\n❌ Some tests failed');
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
