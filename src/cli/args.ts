/**
 * @file
 * CLI argument parsing and help output.
 */

const EXIT_CODE_ERROR = 1;
const PARSE_INT_RADIX = 10;

const MIN_DIAG_INDEX = 1;
const ARG_INCREMENT = 1;
const ARG_INCREMENT_DIAG = 2;

/**
 * Parsed CLI arguments structure.
 */
interface ParsedArgs {
	coverage: boolean;
	diag: number | null;
	help: boolean;
	path: string | null;
}

/**
 * Parse command line arguments.
 * @param args - Array of command line arguments (from process.argv.slice(2)).
 * @returns Parsed arguments structure.
 */
function parseCliArgs(args: readonly (string | undefined)[]): ParsedArgs {
	const result: ParsedArgs = {
		coverage: false,
		diag: null,
		help: false,
		path: null,
	};

	// Filter out undefined values upfront to avoid security concerns with user-controlled data
	// process.argv always returns string[], but we handle undefined for defensive programming
	const filteredArgs = args.filter((arg): arg is string => arg !== undefined);

	const MIN_ARGS_LENGTH = 0;
	if (filteredArgs.length === MIN_ARGS_LENGTH) {
		return result;
	}

	// Use index-based iteration to handle --diag flag that needs next argument
	for (let i = 0; i < filteredArgs.length; i += ARG_INCREMENT) {
		// After filtering with type predicate, filteredArgs[i] is guaranteed to be a string
		// TypeScript array access typing can return undefined, but our bounds check (i < length)
		// and filter guarantee it's defined. Use non-null assertion for type safety.
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Filter and bounds check guarantee value exists
		const argValue = filteredArgs[i]!;

		if (argValue === '--help' || argValue === '-h') {
			result.help = true;
			return result;
		}

		if (argValue === '--coverage' || argValue === '-c') {
			result.coverage = true;
			continue;
		}

		if (argValue === '--diag' || argValue === '-d') {
			const nextIndex = i + ARG_INCREMENT;
			const nextArg = filteredArgs[nextIndex];
			if (nextArg === undefined) {
				console.error('❌ --diag/-d requires an example index number');
				process.exit(EXIT_CODE_ERROR);
			}
			const diagIndex = Number.parseInt(nextArg, PARSE_INT_RADIX);
			if (Number.isNaN(diagIndex) || diagIndex < MIN_DIAG_INDEX) {
				console.error(
					`❌ Invalid example index: ${nextArg}. Must be a positive integer (1-based).`,
				);
				process.exit(EXIT_CODE_ERROR);
			}
			result.diag = diagIndex;
			// Skip both the flag and its value (total of 2 arguments)
			i += ARG_INCREMENT_DIAG - ARG_INCREMENT; // Adjust for loop increment
			continue;
		}

		if (!argValue.startsWith('-')) {
			if (result.path === null) {
				result.path = argValue;
			} else {
				console.error(`❌ Unexpected argument: ${argValue}`);
				process.exit(EXIT_CODE_ERROR);
			}
		} else {
			console.error(`❌ Unknown option: ${argValue}`);
			process.exit(EXIT_CODE_ERROR);
		}
	}

	return result;
}

/**
 * Print usage information to console.
 * @param exitCode - Exit code to use (0 for help, 1 for error).
 */
function printUsage(exitCode: number): void {
	console.log('Usage: test-pmd-rule <rule.xml|directory> [options]');
	console.log(
		'\nThis tool tests PMD rules using examples embedded in XML rule files.',
	);
	console.log('\nArguments:');
	console.log(
		'  <rule.xml|directory>  Path to XML rule file or directory containing XML files',
	);
	console.log('\nOptions:');
	console.log(
		'  --coverage, -c        Generate LCOV coverage report in coverage/lcov.info',
	);
	console.log(
		'  --diag <number>, -d <number>  Output AST dump for specified example (1-based index)',
	);
	console.log('  --help, -h            Show this help message');
	console.log('\nExamples:');
	console.log('  test-pmd-rule path/to/rule.xml');
	console.log('  test-pmd-rule ../sca-extra/rulesets --coverage');
	console.log('  test-pmd-rule path/to/rule.xml --diag 2');
	console.log('  test-pmd-rule path/to/rule.xml -d 1');
	console.log('\nRequirements:');
	console.log('- PMD CLI installed and in PATH');
	console.log('- Node.js 25+');
	process.exit(exitCode);
}

export { parseCliArgs, printUsage, type ParsedArgs };
