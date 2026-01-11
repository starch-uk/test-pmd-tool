import type { ExampleData, ValidationResult } from '../../types/index.js';

/**
 * Check for duplicate messages, branches, or patterns across examples
 * @param examples - Array of parsed examples to check
 * @returns Validation result with errors and warnings
 */
export function checkDuplicates(examples: ExampleData[]): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (examples.length < 2) {
		return { passed: true, issues: errors, warnings };
	}

	// Check for duplicate violation patterns
	const violationPatterns = new Map<string, number[]>();
	const validPatterns = new Map<string, number[]>();

	examples.forEach((example, index) => {
		const exampleNum = index + 1;

		// Check violation patterns
		example.violations.forEach((code) => {
			const normalized = normalizeCode(code);
			if (!violationPatterns.has(normalized)) {
				violationPatterns.set(normalized, []);
			}
			violationPatterns.get(normalized)!.push(exampleNum);
		});

		// Check valid patterns
		example.valids.forEach((code) => {
			const normalized = normalizeCode(code);
			if (!validPatterns.has(normalized)) {
				validPatterns.set(normalized, []);
			}
			validPatterns.get(normalized)!.push(exampleNum);
		});
	});

	// Report duplicates
	checkPatternDuplicates(violationPatterns, 'violation', warnings);
	checkPatternDuplicates(validPatterns, 'valid', warnings);

	return {
		passed: errors.length === 0,
		issues: errors,
		warnings,
	};
}

/**
 * Normalize code for duplicate detection
 */
function normalizeCode(code: string): string {
	return code
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
		.toLowerCase();
}

/**
 * Check for duplicate patterns and add warnings
 */
function checkPatternDuplicates(
	patterns: Map<string, number[]>,
	type: string,
	warnings: string[],
): void {
	for (const [pattern, exampleNumbers] of patterns) {
		if (exampleNumbers.length > 1 && pattern.length > 10) {
			// Only warn for substantial duplicates
			warnings.push(
				`Duplicate ${type} pattern "${pattern.substring(0, 50)}..." ` +
					`found in examples: ${exampleNumbers.join(', ')}`,
			);
		}
	}
}
