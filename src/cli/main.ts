/**
 * CLI entry point for PMD Rule Tester
 * Tests PMD rules using examples embedded in XML rule files
 */
import { existsSync } from 'fs';
import { argv } from 'process';
import { RuleTester } from '../tester/RuleTester.js';

/**
 * Main CLI function that processes command line arguments and executes rule testing
 * @returns Promise that resolves when testing is complete
 * @throws Error if rule testing fails
 */
async function main(): Promise<void> {
	const args = argv.slice(2);

	// Validate arguments
	if (args.length !== 1) {
		console.log('Usage: test-pmd-rule <rule.xml>');
		console.log(
			'\nThis tool tests PMD rules using examples embedded in XML rule files.',
		);
		console.log('\nRequirements:');
		console.log('- PMD CLI installed and in PATH');
		console.log('- Node.js 25+');
		process.exit(1);
	}

	const ruleFilePath: string = args[0];

	if (!ruleFilePath) {
		console.error('❌ No rule file path provided');
		process.exit(1);
	}

	// Validate rule file
	if (!existsSync(ruleFilePath)) {
		console.error(`❌ Rule file not found: ${ruleFilePath}`);
		process.exit(1);
	}

	if (!ruleFilePath.endsWith('.xml')) {
		console.error('❌ File must be an XML rule file (.xml)');
		process.exit(1);
	}

	const tester = new RuleTester(ruleFilePath);

	try {
		const result = await tester.runCoverageTest();
		tester.cleanup();
		process.exit(result.success ? 0 : 1);
	} catch (error: unknown) {
		console.error(`\n❌ Error: ${(error as Error).message}`);
		tester.cleanup();
		process.exit(1);
	}
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
	console.error(`Unexpected error: ${error.message}`);
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
	process.exit(1);
});

// Run main if called directly
main().catch((error) => {
	console.error(`Unexpected error: ${error.message}`);
	process.exit(1);
});
