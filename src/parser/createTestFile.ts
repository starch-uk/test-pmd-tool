/**
 * @file
 * Creates temporary Apex test files from example content for PMD rule testing.
 */
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { TestFileResult } from '../types/index.js';
import { parseExample } from './parseExample.js';

const EMPTY_LENGTH = 0;

interface CreateTestFileOptions {
	exampleContent: string;
	exampleIndex: number;
	includeViolations?: boolean;
	includeValids?: boolean;
}

/**
 * Create a temporary Apex test file from example content.
 * @param options - Configuration options for test file creation.
 * @param options.exampleContent - Raw example content.
 * @param options.exampleIndex - Index of the example for unique naming.
 * @param options.includeViolations - Whether to include violation code.
 * @param options.includeValids - Whether to include valid code.
 * @returns Result of file creation.
 */
export function createTestFile({
	exampleContent,
	exampleIndex,
	includeViolations = true,
	includeValids = true,
}: Readonly<CreateTestFileOptions>): TestFileResult {
	const tempFile = join(
		tmpdir(),
		`rule-test-example-${String(exampleIndex)}-${String(Date.now())}.cls`,
	);

	// Parse the example to get violation and valid code
	const parsed = parseExample(exampleContent);

	// Always use the parsed approach for consistency
	let classContent = `public class TestClass${String(exampleIndex)} {\n`;

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
		hasValids: parsed.valids.length > EMPTY_LENGTH,
		hasViolations: parsed.violations.length > EMPTY_LENGTH,
		validCount: parsed.valids.length,
		violationCount: parsed.violations.length,
	};
}
