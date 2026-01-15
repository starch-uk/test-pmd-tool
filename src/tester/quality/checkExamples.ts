/**
 * @file
 * Example quality validation for PMD rules.
 */
import type { ExampleData, ValidationResult } from '../../types/index.js';

const MIN_EXAMPLES_COUNT = 0;
const MIN_VIOLATION_MARKERS = 0;
const MIN_VALID_MARKERS = 0;
const MIN_VIOLATIONS = 0;
const MIN_VALIDS = 0;
const MIN_MARKERS = 0;
const MIN_CODE_LINES = 0;
const INDEX_OFFSET = 1;

/**
 * Check consistency between markers and code content.
 * @param example - Example data to check.
 * @param exampleNum - Example number for error messages.
 * @param warnings - Array to append warnings to.
 */
function checkMarkerConsistency(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Object properties are accessed
	example: Readonly<ExampleData>,
	exampleNum: Readonly<number>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array is mutated via push()
	warnings: string[],
): void {
	const totalMarkers =
		example.violationMarkers.length + example.validMarkers.length;
	const totalCodeLines = example.violations.length + example.valids.length;

	if (totalMarkers === MIN_MARKERS && totalCodeLines > MIN_CODE_LINES) {
		const exampleNumStr = String(exampleNum);
		warnings.push(`Example ${exampleNumStr} has code but no markers`);
	}

	if (totalMarkers > MIN_MARKERS && totalCodeLines === MIN_CODE_LINES) {
		const exampleNumStr = String(exampleNum);
		warnings.push(`Example ${exampleNumStr} has markers but no code`);
	}
}

/**
 * Check examples for quality issues.
 * @param examples - Array of parsed examples to validate.
 * @returns Validation result with errors and warnings.
 */
export function checkExamples(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array elements are accessed and iterated
	examples: readonly ExampleData[],
): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (examples.length === MIN_EXAMPLES_COUNT) {
		errors.push('No examples found in rule');
		return { issues: errors, passed: false, warnings };
	}

	examples.forEach(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
		(example: Readonly<ExampleData>, index: Readonly<number>) => {
			const exampleNum = index + INDEX_OFFSET;

			// Check for forbidden method name 'testMethod'
			if (example.content.includes('testMethod(')) {
				const exampleNumStr = String(exampleNum);
				errors.push(
					`Example ${exampleNumStr}: You can't call a method testMethod in examples`,
				);
			}

			// Check for violation markers
			if (example.violationMarkers.length === MIN_VIOLATION_MARKERS) {
				const exampleNumStr = String(exampleNum);
				warnings.push(
					`Example ${exampleNumStr} has no violation markers`,
				);
			}

			// Check for valid markers
			if (example.validMarkers.length === MIN_VALID_MARKERS) {
				const exampleNumStr = String(exampleNum);
				warnings.push(`Example ${exampleNumStr} has no valid markers`);
			}

			// Check code content
			if (
				example.violations.length === MIN_VIOLATIONS &&
				example.valids.length === MIN_VALIDS
			) {
				const exampleNumStr = String(exampleNum);
				errors.push(`Example ${exampleNumStr} contains no code`);
			}

			// Check for mixed inline markers
			const hasViolations = example.violations.length > MIN_VIOLATIONS;
			const hasValids = example.valids.length > MIN_VALIDS;

			if (
				hasViolations &&
				hasValids &&
				example.violationMarkers.length > MIN_VIOLATION_MARKERS &&
				example.validMarkers.length > MIN_VALID_MARKERS
			) {
				// This is okay for mixed examples
			} else if (hasViolations && !hasValids) {
				// Pure violation example - should have violation markers
				if (example.violationMarkers.length === MIN_VIOLATION_MARKERS) {
					const exampleNumStr = String(exampleNum);
					warnings.push(
						`Example ${exampleNumStr} has violations but no violation markers`,
					);
				}
			} else if (!hasViolations && hasValids) {
				// Pure valid example - should have valid markers
				if (example.validMarkers.length === MIN_VALID_MARKERS) {
					const exampleNumStr = String(exampleNum);
					warnings.push(
						`Example ${exampleNumStr} has valid code but no valid markers`,
					);
				}
			}

			// Check marker consistency
			checkMarkerConsistency(example, exampleNum, warnings);
		},
	);

	const noErrors = errors.length === MIN_EXAMPLES_COUNT;
	return {
		issues: errors,
		passed: noErrors,
		warnings,
	};
}
