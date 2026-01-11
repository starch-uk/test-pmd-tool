import type { ExampleData, ValidationResult } from '../../types/index.js';

/**
 * Check examples for quality issues
 * @param examples - Array of parsed examples to validate
 * @returns Validation result with errors and warnings
 */
export function checkExamples(examples: ExampleData[]): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (examples.length === 0) {
		errors.push('No examples found in rule');
		return { passed: false, issues: errors, warnings };
	}

	examples.forEach((example, index) => {
		const exampleNum = index + 1;

		// Check for violation markers
		if (example.violationMarkers.length === 0) {
			warnings.push(`Example ${exampleNum} has no violation markers`);
		}

		// Check for valid markers
		if (example.validMarkers.length === 0) {
			warnings.push(`Example ${exampleNum} has no valid markers`);
		}

		// Check code content
		if (example.violations.length === 0 && example.valids.length === 0) {
			errors.push(`Example ${exampleNum} contains no code`);
		}

		// Check for mixed inline markers
		const hasViolations = example.violations.length > 0;
		const hasValids = example.valids.length > 0;

		if (
			hasViolations &&
			hasValids &&
			example.violationMarkers.length > 0 &&
			example.validMarkers.length > 0
		) {
			// This is okay for mixed examples
		} else if (hasViolations && !hasValids) {
			// Pure violation example - should have violation markers
			if (example.violationMarkers.length === 0) {
				warnings.push(
					`Example ${exampleNum} has violations but no violation markers`,
				);
			}
		} else if (!hasViolations && hasValids) {
			// Pure valid example - should have valid markers
			if (example.validMarkers.length === 0) {
				warnings.push(
					`Example ${exampleNum} has valid code but no valid markers`,
				);
			}
		}

		// Check marker consistency
		checkMarkerConsistency(example, exampleNum, warnings);
	});

	return {
		passed: errors.length === 0,
		issues: errors,
		warnings,
	};
}

/**
 * Check consistency between markers and code content
 */
function checkMarkerConsistency(
	example: ExampleData,
	exampleNum: number,
	warnings: string[],
): void {
	const totalMarkers =
		example.violationMarkers.length + example.validMarkers.length;
	const totalCodeLines = example.violations.length + example.valids.length;

	if (totalMarkers === 0 && totalCodeLines > 0) {
		warnings.push(`Example ${exampleNum} has code but no markers`);
	}

	if (totalMarkers > 0 && totalCodeLines === 0) {
		warnings.push(`Example ${exampleNum} has markers but no code`);
	}
}
