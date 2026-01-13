/**
 * @file
 * Duplicate pattern detection for rule examples.
 */
import type { ExampleData, ValidationResult } from '../../types/index.js';

const MIN_EXAMPLES_FOR_DUPLICATE_CHECK = 2;
const MIN_DUPLICATE_COUNT = 1;
const MIN_PATTERN_LENGTH = 10;
const PATTERN_DISPLAY_LENGTH = 50;
const INDEX_OFFSET = 1;
const ZERO_ERRORS = 0;
const MIN_COUNT = 0;

/**
 * Normalize code for duplicate detection.
 * @param code - Code string to normalize.
 * @returns Normalized code string.
 */
function normalizeCode(code: string): string {
	return code
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
		.toLowerCase();
}

/**
 * Check for duplicate patterns and add warnings.
 * @param patterns - Map of patterns to example numbers.
 * @param type - Type of pattern (violation or valid).
 * @param warnings - Array to append warnings to.
 */
function checkPatternDuplicates(
	patterns: Readonly<Map<string, readonly number[]>>,
	type: Readonly<string>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array is mutated via push()
	warnings: string[],
): void {
	for (const [pattern, exampleNumbers] of patterns.entries()) {
		if (
			exampleNumbers.length > MIN_DUPLICATE_COUNT &&
			pattern.length > MIN_PATTERN_LENGTH
		) {
			// Only warn for substantial duplicates
			const patternPreview = pattern.substring(
				MIN_COUNT,
				PATTERN_DISPLAY_LENGTH,
			);
			warnings.push(
				`Duplicate ${type} pattern "${patternPreview}..." ` +
					`found in examples: ${exampleNumbers.join(', ')}`,
			);
		}
	}
}

/**
 * Check for duplicate messages, branches, or patterns across examples.
 * @param examples - Array of parsed examples to check.
 * @returns Validation result with errors and warnings.
 */
export function checkDuplicates(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array elements are accessed and iterated
	examples: readonly ExampleData[],
): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (examples.length < MIN_EXAMPLES_FOR_DUPLICATE_CHECK) {
		return { issues: errors, passed: true, warnings };
	}

	// Check for duplicate violation patterns
	const violationPatterns = new Map<string, number[]>();
	const validPatterns = new Map<string, number[]>();

	examples.forEach(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
		(example: Readonly<ExampleData>, index: Readonly<number>) => {
			const exampleNum = index + INDEX_OFFSET;

			// Check violation patterns
			example.violations.forEach((code: Readonly<string>) => {
				const normalized = normalizeCode(code);
				if (!violationPatterns.has(normalized)) {
					violationPatterns.set(normalized, []);
				}
				// get() after set() always returns the array, never undefined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- get() after set() always returns the array
				const patternList = violationPatterns.get(normalized)!;
				patternList.push(exampleNum);
			});

			// Check valid patterns
			example.valids.forEach((code: Readonly<string>) => {
				const normalized = normalizeCode(code);
				if (!validPatterns.has(normalized)) {
					validPatterns.set(normalized, []);
				}
				// get() after set() always returns the array, never undefined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- get() after set() always returns the array
				const patternList = validPatterns.get(normalized)!;
				patternList.push(exampleNum);
			});
		},
	);

	// Report duplicates
	checkPatternDuplicates(violationPatterns, 'violation', warnings);
	checkPatternDuplicates(validPatterns, 'valid', warnings);

	const noErrors = errors.length === ZERO_ERRORS;
	return {
		issues: errors,
		passed: noErrors,
		warnings,
	};
}
