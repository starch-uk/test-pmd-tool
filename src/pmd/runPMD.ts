import { execSync } from 'child_process';
import { resolve } from 'path';
import { parseViolations } from './parseViolations.js';
import type { PMDResult, FileOperationResult } from '../types/index.js';

/**
 * Execute PMD CLI against an Apex file using a ruleset
 * @param apexFilePath - Path to the Apex file to analyze
 * @param rulesetPath - Path to the PMD ruleset XML file
 * @returns Promise resolving to PMD execution results
 */
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
				encoding: 'utf-8',
				timeout: 30000,
				stdio: ['pipe', 'pipe', 'pipe'],
				cwd: process.cwd(),
			},
		);

		// Parse the XML output
		const violations = parseViolations(result);

		return {
			success: true,
			data: {
				violations,
			},
		};
	} catch (error: any) {
		// Handle PMD execution errors
		if (error.code === 'ENOENT') {
			return {
				success: false,
				error: 'PMD CLI not available. Please install PMD to run tests. Visit: https://pmd.github.io/pmd/pmd_userdocs_installation.html',
			};
		}

		// PMD may exit with non-zero when violations are found
		// Try to parse XML from stdout or error.stdout
		const xmlOutput = error.stdout || '';

		if (xmlOutput.trim()) {
			try {
				const violations = parseViolations(xmlOutput);
				return {
					success: true,
					data: {
						violations,
					},
				};
			} catch (parseError) {
				// XML parsing failed, return the original error
			}
		}

		// Return execution error with details
		let errorMessage = `PMD execution failed: ${error.message}`;

		if (error.stderr) {
			errorMessage += `\nPMD stderr:\n${error.stderr}`;
		}

		if (error.stdout) {
			errorMessage += `\nPMD stdout:\n${error.stdout}`;
		}

		return {
			success: false,
			error: errorMessage,
		};
	}
}
