/**
 * @file
 * PMD execution module. Runs PMD CLI against Apex files and parses results.
 */
import { execFileSync } from 'child_process';
import { resolve } from 'path';
import type { FileOperationResult, PMDResult } from '../types/index.js';
import { parseViolations } from './parseViolations.js';

const MIN_OUTPUT_LENGTH = 0;
const EMPTY_STRING = '';

/**
 * Execute PMD CLI against an Apex file using a ruleset.
 * @param apexFilePath - Path to the Apex file to analyze.
 * @param rulesetPath - Path to the PMD ruleset XML file.
 * @returns Promise resolving to PMD execution results with parsed violations.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Function signature requires Promise for compatibility with tests
async function runPMD(
	apexFilePath: string,
	rulesetPath: string,
): Promise<FileOperationResult<PMDResult>> {
	try {
		// Resolve absolute paths
		const absoluteApexPath = resolve(apexFilePath);
		const absoluteRulesetPath = resolve(rulesetPath);

		// Execute PMD with XML output format
		// Use execFileSync instead of execSync to prevent command injection
		// Arguments are passed as an array, avoiding shell interpretation of special characters
		const result = execFileSync(
			'pmd',
			[
				'check',
				'--no-cache',
				'--no-progress',
				'-d',
				absoluteApexPath,
				'-R',
				absoluteRulesetPath,
				'-f',
				'xml',
			],
			{
				cwd: process.cwd(),
				encoding: 'utf-8',
				stdio: ['pipe', 'pipe', 'pipe'],
				timeout: 30000,
			},
		);

		// Parse the XML output
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- execFileSync with encoding returns string | Buffer
		const violations = parseViolations(result as string);

		return {
			data: {
				violations,
			},
			success: true,
		};
	} catch (error: unknown) {
		// Handle PMD execution errors
		interface ExecError {
			code?: string;
			stdout?: Buffer | string;
			stderr?: Buffer | string;
			message?: string;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Error from execFileSync has known shape
		const execError = error as ExecError;
		if (execError.code === 'ENOENT') {
			return {
				error: 'PMD CLI not available. Please install PMD to run tests. Visit: https://pmd.github.io/pmd/pmd_userdocs_installation.html',
				success: false,
			};
		}

		// PMD may exit with non-zero when violations are found
		// Try to parse XML from stdout or error.stdout
		const xmlOutput = execError.stdout ?? EMPTY_STRING;
		const xmlOutputString =
			typeof xmlOutput === 'string' ? xmlOutput : xmlOutput.toString();

		if (xmlOutputString.trim().length > MIN_OUTPUT_LENGTH) {
			try {
				const violations = parseViolations(xmlOutputString);
				return {
					data: {
						violations,
					},
					success: true,
				};
			} catch {
				// XML parsing failed, return the original error
			}
		}

		// Return execution error with details
		const errorMessage = execError.message ?? 'Unknown error';
		let fullErrorMessage = `PMD execution failed: ${errorMessage}`;

		if (execError.stderr !== undefined) {
			const stderr =
				typeof execError.stderr === 'string'
					? execError.stderr
					: execError.stderr.toString();
			if (stderr.trim().length > MIN_OUTPUT_LENGTH) {
				fullErrorMessage += `\nPMD stderr:\n${stderr}`;
			}
		}

		if (execError.stdout !== undefined) {
			const stdout =
				typeof execError.stdout === 'string'
					? execError.stdout
					: execError.stdout.toString();
			// Include stdout even if it's whitespace-only (test expects this)
			if (stdout.length > MIN_OUTPUT_LENGTH) {
				fullErrorMessage += `\nPMD stdout:\n${stdout}`;
			}
		}

		return {
			error: fullErrorMessage,
			success: false,
		};
	}
}

/**
 * Execute PMD CLI in AST dump mode against an Apex file.
 * Returns the raw AST dump output from PMD using the `ast-dump` command.
 * @param apexFilePath - Path to the Apex file to analyze.
 * @param _rulesetPath - Path to the PMD ruleset XML file (not used for AST dump, but kept for API consistency).
 * @returns Promise resolving to AST dump output as string.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Function signature requires Promise for compatibility with tests
async function runPmdAstDump(
	apexFilePath: string,
	_rulesetPath: string,
): Promise<FileOperationResult<string>> {
	try {
		// Resolve absolute path
		const absoluteApexPath = resolve(apexFilePath);

		// Execute PMD ast-dump command with XML format for structured parsing
		// Use execFileSync instead of execSync to prevent command injection
		// Arguments are passed as an array, avoiding shell interpretation of special characters
		const result = execFileSync(
			'pmd',
			[
				'ast-dump',
				'--format',
				'xml',
				'--language',
				'apex',
				'--file',
				absoluteApexPath,
			],
			{
				cwd: process.cwd(),
				encoding: 'utf-8',
				stdio: ['pipe', 'pipe', 'pipe'],
				timeout: 30000,
			},
		);

		// Return the raw AST output as string
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- execFileSync with encoding returns string | Buffer
		const astOutput = result as string;

		return {
			data: astOutput,
			success: true,
		};
	} catch (error: unknown) {
		// Handle PMD execution errors
		interface ExecError {
			code?: string;
			stdout?: Buffer | string;
			stderr?: Buffer | string;
			message?: string;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Error from execFileSync has known shape
		const execError = error as ExecError;
		if (execError.code === 'ENOENT') {
			return {
				error: 'PMD CLI not available. Please install PMD to run tests. Visit: https://pmd.github.io/pmd/pmd_userdocs_installation.html',
				success: false,
			};
		}

		// Try to extract AST output from stdout even if PMD exited with non-zero
		const xmlOutput = execError.stdout ?? EMPTY_STRING;
		const xmlOutputString =
			typeof xmlOutput === 'string' ? xmlOutput : xmlOutput.toString();

		if (xmlOutputString.trim().length > MIN_OUTPUT_LENGTH) {
			// Return the output even if PMD exited with error (might still contain AST)
			return {
				data: xmlOutputString,
				success: true,
			};
		}

		// Return execution error with details
		const errorMessage = execError.message ?? 'Unknown error';
		let fullErrorMessage = `PMD AST dump failed: ${errorMessage}`;

		if (execError.stderr !== undefined) {
			const stderr =
				typeof execError.stderr === 'string'
					? execError.stderr
					: execError.stderr.toString();
			if (stderr.trim().length > MIN_OUTPUT_LENGTH) {
				fullErrorMessage += `\nPMD stderr:\n${stderr}`;
			}
		}

		if (execError.stdout !== undefined) {
			const stdout =
				typeof execError.stdout === 'string'
					? execError.stdout
					: execError.stdout.toString();
			if (stdout.length > MIN_OUTPUT_LENGTH) {
				fullErrorMessage += `\nPMD stdout:\n${stdout}`;
			}
		}

		return {
			error: fullErrorMessage,
			success: false,
		};
	}
}

export { runPMD, runPmdAstDump };
