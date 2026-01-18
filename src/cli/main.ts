/**
 * @file
 * CLI entry point for PMD Rule Tester. Tests PMD rules using examples embedded in XML rule files.
 */
import { existsSync, realpathSync, statSync } from 'fs';
import { resolve } from 'path';
import { argv } from 'process';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import { RuleTester } from '../tester/RuleTester.js';
import { limitConcurrency } from '../utils/concurrency.js';
import {
	CoverageTracker,
	type CoverageData,
} from '../coverage/trackCoverage.js';
import { runPMD, runPmdAstDump } from '../pmd/runPMD.js';
import { createTestFile } from '../parser/createTestFile.js';
import { parseCliArgs, printUsage } from './args.js';
import { findXmlFiles } from './fileDiscovery.js';
import { testRuleFile } from './processFiles.js';
import { parseXmlAstAndStripWrappers } from './outputFormatter.js';
import { generateCoverageReport } from './coverageReporting.js';
import { setupErrorHandlers } from './errorHandling.js';

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ERROR = 1;
export { EXIT_CODE_SUCCESS, EXIT_CODE_ERROR };
const ARGV_SLICE_INDEX = 2;
const REPEAT_CHAR_COUNT = 60;
const MIN_FAILED_FILES_COUNT = 0;
const EXAMPLE_INDEX_OFFSET = 1;
const MIN_EXAMPLES_LENGTH = 0;
const EMPTY_STRING_LENGTH = 0;
const EMPTY_MARKERS_LENGTH = 0;

/**
 * Determine if this module is being executed as the CLI entrypoint.
 * @returns True if the current module is the Node entry file.
 */
function isCliInvocation(): boolean {
	const [, entryPath] = argv;
	if (entryPath === undefined) {
		return false;
	}
	try {
		// Convert import.meta.url to absolute file path
		const currentModulePath = fileURLToPath(import.meta.url);
		// Resolve entryPath to absolute path to handle relative paths from npm/node_modules
		const resolvedEntryPath = resolve(process.cwd(), entryPath);
		// Resolve symlinks to handle npm/pnpm bin symlinks
		const absoluteEntryPath = realpathSync(resolvedEntryPath);
		// Compare resolved absolute paths
		return currentModulePath === absoluteEntryPath;
	} catch {
		// If path resolution fails (e.g., file doesn't exist), assume not CLI invocation
		return false;
	}
}

/**
 * Run diagnostics mode: extract example, create test file, run PMD AST dump.
 * @param ruleFilePath - Path to the XML rule file.
 * @param exampleIndex - 1-based example index to dump.
 * @returns Promise that resolves when diagnostics are complete.
 */
async function runDiagnostics(
	ruleFilePath: Readonly<string>,
	exampleIndex: Readonly<number>,
): Promise<void> {
	try {
		const tester = new RuleTester(ruleFilePath);
		const examples = tester.extractExamples();

		if (examples.length === MIN_EXAMPLES_LENGTH) {
			console.error(`❌ No examples found in rule file: ${ruleFilePath}`);
			process.exit(EXIT_CODE_ERROR);
		}

		if (exampleIndex > examples.length) {
			console.error(
				`❌ Example index ${String(exampleIndex)} is out of range. Rule file has ${String(examples.length)} example(s).`,
			);
			process.exit(EXIT_CODE_ERROR);
		}

		const example = examples[exampleIndex - EXAMPLE_INDEX_OFFSET];
		if (example === undefined) {
			console.error(`❌ Example ${String(exampleIndex)} not found`);
			process.exit(EXIT_CODE_ERROR);
		}

		// Get XPath from rule metadata
		const ruleMetadata = tester.getRuleMetadata();
		const xpath = ruleMetadata.xpath ?? null;

		// Get coverage data from previous examples (examples before current index)
		const SLICE_START_INDEX = 0;
		const previousExamplesCoverage = examples
			.slice(SLICE_START_INDEX, exampleIndex - EXAMPLE_INDEX_OFFSET)
			.map(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for map
				(prevExample) => ({
					exampleContent: prevExample.content,
					validMarkers: prevExample.validMarkers,
					violationMarkers: prevExample.violationMarkers,
				}),
			);

		// Create test file for the example
		const testFileResult = createTestFile({
			exampleContent: example.content,
			exampleIndex,
			includeValids: true,
			includeViolations: true,
		});

		// Run PMD with the rule to get actual XPath matches (violations)
		// This tells us which lines in the test file match the XPath
		let xpathMatchLines: Set<number> | undefined = undefined;
		if (xpath !== null && xpath.length > EMPTY_STRING_LENGTH) {
			const pmdResult = await runPMD(
				testFileResult.filePath,
				ruleFilePath,
			);
			if (pmdResult.success && pmdResult.data) {
				const violationLines = pmdResult.data.violations.map(
					(v: Readonly<{ line: number }>) => v.line,
				);
				// Only create the set if there are violations
				// If empty, leave as undefined to fall back to node type checking
				if (violationLines.length > EMPTY_MARKERS_LENGTH) {
					xpathMatchLines = new Set(violationLines);
				}
			}
		}

		// Run PMD AST dump
		const astResult = await runPmdAstDump(
			testFileResult.filePath,
			ruleFilePath,
		);

		if (!astResult.success) {
			console.error(
				`❌ Failed to generate AST dump: ${astResult.error ?? 'Unknown error'}`,
			);
			console.error(
				`\n⚠️  The generated test file might have syntax errors. File path: ${testFileResult.filePath}`,
			);
			console.error(
				'\n💡 This might be caused by invalid example code or issues with wrapper generation.',
			);
			console.error(
				'   The test file has been preserved for debugging purposes.',
			);

			// Print the generated file content for debugging
			try {
				const { readFileSync } = await import('fs');
				const generatedContent = readFileSync(
					testFileResult.filePath,
					'utf-8',
				);
				console.error('\n📄 Generated test file content:');
				console.error('---');
				console.error(generatedContent);
				console.error('---');
			} catch {
				// Ignore errors reading the file
			}

			process.exit(EXIT_CODE_ERROR);
		}

		// Parse XML AST and strip wrappers, then render as tree with all attributes
		const rawXmlAst = astResult.data ?? '';
		const { wrapperInfo } = testFileResult;

		const cleanedAst = parseXmlAstAndStripWrappers({
			exampleContent: example.content,
			exampleIndex,
			previousExamplesCoverage,
			validMarkers: example.validMarkers,
			violationMarkers: example.violationMarkers,
			wrapperInfo,
			xmlAstOutput: rawXmlAst,
			xpath,
			xpathMatchLines,
		});

		// Print cleaned AST dump to stdout
		console.log(
			`# AST Dump for Example ${String(exampleIndex)} from ${ruleFilePath}\n`,
		);
		console.log(cleanedAst);

		// Cleanup
		tester.cleanup();
		process.exit(EXIT_CODE_SUCCESS);
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		console.error(`❌ Error running diagnostics: ${errorMessage}`);
		process.exit(EXIT_CODE_ERROR);
	}
}

/**
 * Main CLI function that processes command line arguments and executes rule testing.
 * @returns Promise that resolves when testing is complete.
 * @throws {Error} If rule testing fails.
 */
async function main(): Promise<void> {
	const args = argv.slice(ARGV_SLICE_INDEX);
	const parsedArgs = parseCliArgs(args);

	// Handle help flag
	if (parsedArgs.help) {
		printUsage(EXIT_CODE_SUCCESS);
		return;
	}

	// Validate path argument
	if (parsedArgs.path === null) {
		console.error('❌ Path argument is required');
		printUsage(EXIT_CODE_ERROR);
		return;
	}

	const pathArg = parsedArgs.path;

	// Validate diagnostics mode requirements
	if (parsedArgs.diag !== null) {
		if (parsedArgs.coverage) {
			console.error('❌ --coverage cannot be used with --diag');
			process.exit(EXIT_CODE_ERROR);
		}

		// Diagnostics mode requires a single file, not a directory
		if (!existsSync(pathArg)) {
			console.error(`❌ Path not found: ${pathArg}`);
			process.exit(EXIT_CODE_ERROR);
		}

		const stat = statSync(pathArg);
		if (!stat.isFile()) {
			console.error(
				'❌ --diag requires a single XML rule file, not a directory',
			);
			process.exit(EXIT_CODE_ERROR);
		}

		if (!pathArg.endsWith('.xml')) {
			console.error('❌ File must be an XML rule file (.xml)');
			process.exit(EXIT_CODE_ERROR);
		}

		// Run diagnostics and exit
		await runDiagnostics(pathArg, parsedArgs.diag);
		return;
	}

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
	const coverageTrackers = parsedArgs.coverage
		? new Map<string, CoverageTracker>()
		: null;

	// Create tasks for each file
	interface TaskResult {
		filePath: string;
		success: boolean;
		error?: string;
		coverageData?: Readonly<CoverageData>;
	}
	const tasks: (() => Promise<TaskResult>)[] = xmlFiles.map(
		(filePath: Readonly<string>) => async (): Promise<TaskResult> => {
			const tracker = coverageTrackers
				? (coverageTrackers.get(filePath) ??
					new CoverageTracker(filePath))
				: null;
			if (tracker && coverageTrackers) {
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
	if (parsedArgs.coverage && coverageTrackers) {
		generateCoverageReport(coverageTrackers);
	}

	process.exit(
		failedFiles === MIN_FAILED_FILES_COUNT
			? EXIT_CODE_SUCCESS
			: EXIT_CODE_ERROR,
	);
}

if (isCliInvocation()) {
	setupErrorHandlers();

	// Run main if called directly
	main().catch((error: unknown) => {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		console.error(`Unexpected error: ${errorMessage}`);
		process.exit(EXIT_CODE_ERROR);
	});
}
