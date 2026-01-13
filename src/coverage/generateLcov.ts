/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */

/**
 * @file
 * LCOV format coverage report generation.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { CoverageData } from './trackCoverage.js';

/**
 * Generates LCOV format coverage report.
 * @param coverageData - Array of coverage data for each file.
 * @param outputPath - Path to write the LCOV report.
 */
export function generateLcovReport(
	coverageData: readonly CoverageData[],
	outputPath: string,
): void {
	const lcovContent: string[] = [];

	for (const data of coverageData) {
		// SF:<source_file_path>
		lcovContent.push(`SF:${data.filePath}`);

		// DA:<line_number>,<execution_count> for XPath lines
		for (const [lineNumber, executionCount] of data.xpathLines) {
			lcovContent.push(`DA:${String(lineNumber)},${String(executionCount)}`);
		}

		// DA:<line_number>,<execution_count> for component lines
		for (const [lineNumber, executionCount] of data.componentLines) {
			lcovContent.push(`DA:${String(lineNumber)},${String(executionCount)}`);
		}

		// end_of_record
		lcovContent.push('end_of_record');
	}

	// Ensure output directory exists
	const outputDir = dirname(outputPath);
	mkdirSync(outputDir, { recursive: true });

	// Write the LCOV file
	const content = lcovContent.join('\n') + '\n';
	writeFileSync(outputPath, content, 'utf-8');
}
/* eslint-enable @typescript-eslint/prefer-readonly-parameter-types */