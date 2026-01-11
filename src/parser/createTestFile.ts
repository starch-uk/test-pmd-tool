import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseExample } from './parseExample.js';
import type { TestFileResult } from '../types/index.js';

/**
 * Create a temporary Apex test file from example content
 * @param exampleContent - Raw example content
 * @param exampleIndex - Index of the example for unique naming
 * @param includeViolations - Whether to include violation code
 * @param includeValids - Whether to include valid code
 * @returns Result of file creation
 */
export function createTestFile(
	exampleContent: string,
	exampleIndex: number,
	includeViolations = true,
	includeValids = true,
): TestFileResult {
	const tempFile = join(
		tmpdir(),
		`rule-test-example-${exampleIndex}-${Date.now()}.cls`,
	);

	// Parse the example to get violation and valid code
	const parsed = parseExample(exampleContent);

	// Always use the parsed approach for consistency
	let classContent = `public class TestClass${exampleIndex} {\n`;

	// Choose which code to include based on parameters
	let codeToInclude: string[] = [];
	if (includeViolations && !includeValids) {
		// Only violations
		codeToInclude = parsed.violations;
	} else if (includeValids && !includeViolations) {
		codeToInclude = parsed.valids;
	} else {
		// Both or neither
		codeToInclude = [...parsed.violations, ...parsed.valids];
	}

	// Process all the parsed code lines
	codeToInclude.forEach((line) => {
		classContent += `    ${line}\n`;
	});
	classContent += '}\n';

	writeFileSync(tempFile, classContent, 'utf-8');

	return {
		filePath: tempFile,
		hasViolations: parsed.violations.length > 0,
		hasValids: parsed.valids.length > 0,
		violationCount: parsed.violations.length,
		validCount: parsed.valids.length,
	};
}
