/**
 * @file
 * PMD execution module. Runs PMD CLI against Apex files and parses results.
 */
import { execSync } from 'child_process';
import { resolve } from 'path';
import type { PMDResult, FileOperationResult } from '../types/index.js';
import { parseViolations } from './parseViolations.js';

const MIN_OUTPUT_LENGTH = 0;
const EMPTY_STRING = '';

/**
 * Execute PMD CLI against an Apex file using a ruleset.
 * @param apexFilePath - Path to the Apex file to analyze.
 * @param rulesetPath - Path to the PMD ruleset XML file.
 * @returns Promise resolving to PMD execution results.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Function signature requires Promise for compatibility with tests
export async function runPMD(
	apexFilePath: string,
	rulesetPath: string,
): Promise<FileOperationResult<PMDResult>> {
	try {
		// Resolve absolute paths
		const absoluteApexPath = resolve(apexFilePath);
		const absoluteRulesetPath = resolve(rulesetPath);

		// Execute PMD with XML output format
		const result = execSync(
			`pmd check --no-cache --no-progress -d "${absoluteApexPath}" -R "${absoluteRulesetPath}" -f xml`,
			{
				cwd: process.cwd(),
				encoding: 'utf-8',
				stdio: ['pipe', 'pipe', 'pipe'],
				timeout: 30000,
			},
		);

		// Parse the XML output
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- execSync with encoding returns string | Buffer
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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Error from execSync has known shape
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
