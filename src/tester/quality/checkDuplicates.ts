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
 * Check for duplicate marker descriptions across all examples.
 * @param markerDescriptions - Map of normalized descriptions to example numbers.
 * @param warnings - Array to append warnings to.
 */
function checkMarkerDuplicates(
	markerDescriptions: Readonly<Map<string, readonly number[]>>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array is mutated via push()
	warnings: string[],
): void {
	for (const [description, exampleNumbers] of markerDescriptions.entries()) {
		if (
			exampleNumbers.length > MIN_DUPLICATE_COUNT &&
			description.length > MIN_PATTERN_LENGTH
		) {
			// Only warn for substantial duplicates
			const descriptionPreview = description.substring(
				MIN_COUNT,
				PATTERN_DISPLAY_LENGTH,
			);
			warnings.push(
				`Duplicate marker description "${descriptionPreview}..." ` +
					`found in examples: ${exampleNumbers.join(', ')}`,
			);
		}
	}
}

/**
 * Check for duplicate messages, branches, or patterns across examples.
 * Checks all markers (violation and valid) across all examples.
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

	// Check for duplicate marker descriptions across all examples
	// Collect all markers (both violation and valid) from all examples
	const markerDescriptions = new Map<string, number[]>();

	examples.forEach(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
		(example: Readonly<ExampleData>, index: Readonly<number>) => {
			const exampleNum = index + INDEX_OFFSET;

			// Check all violation markers
			example.violationMarkers.forEach(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
				(marker) => {
					const normalized = normalizeCode(marker.description);
					if (!markerDescriptions.has(normalized)) {
						markerDescriptions.set(normalized, []);
					}
					// get() after set() always returns the array, never undefined
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- get() after set() always returns the array
					const descriptionList = markerDescriptions.get(normalized)!;
					descriptionList.push(exampleNum);
				},
			);

			// Check all valid markers
			example.validMarkers.forEach(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
				(marker) => {
					const normalized = normalizeCode(marker.description);
					if (!markerDescriptions.has(normalized)) {
						markerDescriptions.set(normalized, []);
					}
					// get() after set() always returns the array, never undefined
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- get() after set() always returns the array
					const descriptionList = markerDescriptions.get(normalized)!;
					descriptionList.push(exampleNum);
				},
			);
		},
	);

	// Report duplicate markers
	checkMarkerDuplicates(markerDescriptions, warnings);

	const noErrors = errors.length === ZERO_ERRORS;
	return {
		issues: errors,
		passed: noErrors,
		warnings,
	};
}
