/**
 * @file
 * Meta test to prevent using forbidden method names in tests.
 *
 * Requirement: when a test contains a method called 'testMethod',
 * that test must fail and clearly say you can't call a method testMethod.
 */
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recursively collect all `.test.ts` files under the given directory.
 * @param dir - Root directory to start searching from.
 * @returns Array of absolute file paths to `.test.ts` files.
 */
function collectTestFiles(dir: string): string[] {
	const entries = readdirSync(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectTestFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
			files.push(fullPath);
		}
	}

	return files;
}

describe('test code conventions', () => {
	it("should not define methods named 'testMethod' in tests", () => {
		const testsRoot = path.resolve(__dirname, '..', '..');
		const testFiles = collectTestFiles(testsRoot);
		const forbiddenFiles: string[] = [];

		for (const file of testFiles) {
			// Skip this guard file itself
			if (file.endsWith('methodGuard.test.ts')) {
				continue;
			}

			const content = readFileSync(file, 'utf-8');
			if (content.includes('testMethod(')) {
				forbiddenFiles.push(path.relative(testsRoot, file));
			}
		}

		if (forbiddenFiles.length > 0) {
			const details = forbiddenFiles.join(', ');
			throw new Error(
				`Forbidden method name 'testMethod' found in test files: ${details}. You can't call a method testMethod in tests.`,
			);
		}

		expect(forbiddenFiles).toHaveLength(0);
	});
});
