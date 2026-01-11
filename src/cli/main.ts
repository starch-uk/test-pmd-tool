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
		const result = await tester.runCoverageTest();
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
