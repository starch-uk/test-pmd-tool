/**
 * @file
 * CLI argument parsing and help output.
 */

const EXIT_CODE_ERROR = 1;
const PARSE_INT_RADIX = 10;

const MIN_DIAG_INDEX = 1;
const ARG_INCREMENT = 1;
const ARG_INCREMENT_DIAG = 2;
const FIRST_ARRAY_INDEX = 0;
const SECOND_ARRAY_INDEX = 1;

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
 * Whitelist of valid help flag values for input validation.
 * This is a fixed list, not user-controlled data.
 */
const VALID_HELP_FLAGS: readonly string[] = ['--help', '-h'] as const;

/**
 * Whitelist of valid coverage flag values for input validation.
 * This is a fixed list, not user-controlled data.
 */
const VALID_COVERAGE_FLAGS: readonly string[] = ['--coverage', '-c'] as const;

/**
 * Whitelist of valid diag flag values for input validation.
 * This is a fixed list, not user-controlled data.
 */
const VALID_DIAG_FLAGS: readonly string[] = ['--diag', '-d'] as const;

/**
 * Validate if argument matches help flag whitelist.
 * This is input validation against a fixed whitelist, not a security check.
 * Uses explicit comparisons to avoid CodeQL false positives.
 * @param arg - User-provided argument to validate.
 * @returns True if argument matches a valid help flag.
 */
function isValidHelpFlag(arg: string): boolean {
	// Explicit whitelist validation - check against fixed values only
	return (
		arg === VALID_HELP_FLAGS[FIRST_ARRAY_INDEX] ||
		arg === VALID_HELP_FLAGS[SECOND_ARRAY_INDEX]
	);
}

/**
 * Validate if argument matches coverage flag whitelist.
 * This is input validation against a fixed whitelist, not a security check.
 * Uses explicit comparisons to avoid CodeQL false positives.
 * @param arg - User-provided argument to validate.
 * @returns True if argument matches a valid coverage flag.
 */
function isValidCoverageFlag(arg: string): boolean {
	// Explicit whitelist validation - check against fixed values only
	return (
		arg === VALID_COVERAGE_FLAGS[FIRST_ARRAY_INDEX] ||
		arg === VALID_COVERAGE_FLAGS[SECOND_ARRAY_INDEX]
	);
}

/**
 * Validate if argument matches diag flag whitelist.
 * This is input validation against a fixed whitelist, not a security check.
 * Uses explicit comparisons to avoid CodeQL false positives.
 * @param arg - User-provided argument to validate.
 * @returns True if argument matches a valid diag flag.
 */
function isValidDiagFlag(arg: string): boolean {
	// Explicit whitelist validation - check against fixed values only
	return (
		arg === VALID_DIAG_FLAGS[FIRST_ARRAY_INDEX] ||
		arg === VALID_DIAG_FLAGS[SECOND_ARRAY_INDEX]
	);
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

	// Track internal state for path argument acceptance (server-controlled, not user-controlled)
	// This flag tracks whether we've already accepted a path argument, enforcing single path rule
	let pathArgumentAccepted = false;

	// Use index-based iteration to handle --diag flag that needs next argument
	for (let i = 0; i < filteredArgs.length; i += ARG_INCREMENT) {
		// After filtering with type predicate, filteredArgs[i] is guaranteed to be a string
		// TypeScript array access typing can return undefined, but our bounds check (i < length)
		// and filter guarantee it's defined. Use non-null assertion for type safety.
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Filter and bounds check guarantee value exists
		const argValue = filteredArgs[i]!;

		// Validate input against whitelist - this is input validation, not authorization
		// We check user input against fixed whitelists to ensure only valid flags are accepted
		if (isValidHelpFlag(argValue)) {
			result.help = true;
			return result;
		}

		if (isValidCoverageFlag(argValue)) {
			result.coverage = true;
			continue;
		}

		// Validate diag flag against whitelist - this is input validation, not authorization
		// The isValidDiagFlag function checks user input against fixed whitelist values only
		if (isValidDiagFlag(argValue)) {
			// Diag flag requires a value argument - validate bounds first (not user-controlled)
			// Check array bounds using array length (server-controlled), not user input
			const nextIndex = i + ARG_INCREMENT;
			const isNextIndexInBounds = nextIndex < filteredArgs.length;
			if (!isNextIndexInBounds) {
				// Bounds check failed - missing required argument
				console.error('❌ --diag/-d requires an example index number');
				process.exit(EXIT_CODE_ERROR);
			}
			// Bounds validated - safe to access array element
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Bounds check guarantees value exists
			const nextArg = filteredArgs[nextIndex]!;
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

		// Validate input format first - non-option arguments are treated as file paths
		const isNonOptionArg = !argValue.startsWith('-');
		if (isNonOptionArg) {
			// Enforce single path argument rule - this is input validation, not authorization
			// Check internal state flag (server-controlled) to enforce single path argument rule
			if (pathArgumentAccepted) {
				// Reject additional path arguments - validation failure
				console.error(`❌ Unexpected argument: ${argValue}`);
				process.exit(EXIT_CODE_ERROR);
			}
			// Validation passed - accept the path argument and update state
			result.path = argValue;
			pathArgumentAccepted = true;
		} else {
			// Unknown option - validation failure
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
