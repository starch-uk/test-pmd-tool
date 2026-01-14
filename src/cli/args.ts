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
 * @param args - Array of command line arguments.
 * @returns Parsed arguments structure.
 */
function parseCliArgs(args: readonly (string | undefined)[]): ParsedArgs {
	const result: ParsedArgs = {
		coverage: false,
		diag: null,
		help: false,
		path: null,
	};

	const MIN_ARGS_LENGTH = 0;
	if (args.length === MIN_ARGS_LENGTH) {
		return result;
	}

	let i = 0;
	while (i < args.length) {
		const arg = args[i];
		if (arg === undefined) {
			i += ARG_INCREMENT;
			continue;
		}

		if (arg === '--help' || arg === '-h') {
			result.help = true;
			return result;
		}

		if (arg === '--coverage' || arg === '-c') {
			result.coverage = true;
			i += ARG_INCREMENT;
			continue;
		}

		if (arg === '--diag' || arg === '-d') {
			const nextArg = args[i + ARG_INCREMENT];
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
			i += ARG_INCREMENT_DIAG;
			continue;
		}

		if (!arg.startsWith('-')) {
			if (result.path === null) {
				result.path = arg;
			} else {
				console.error(`❌ Unexpected argument: ${arg}`);
				process.exit(EXIT_CODE_ERROR);
			}
		} else {
			console.error(`❌ Unknown option: ${arg}`);
			process.exit(EXIT_CODE_ERROR);
		}

		i += ARG_INCREMENT;
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
