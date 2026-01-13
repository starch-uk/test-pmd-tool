/**
 * @file
 * Extracts violation and valid markers from example content for PMD rule testing.
 */
import type { ViolationMarker } from '../types/index.js';

const LINE_NUMBER_OFFSET = 1;

/**
 * Extract violation and valid markers from example content.
 * @param exampleContent - Raw example content with markers.
 * @returns Object containing violation and valid markers.
 */
export function extractMarkers(exampleContent: string): {
	validMarkers: ViolationMarker[];
	violationMarkers: ViolationMarker[];
} {
	const lines = exampleContent.split('\n');
	const violationMarkers: ViolationMarker[] = [];
	const validMarkers: ViolationMarker[] = [];

	const hasInlineMarkersInExample =
		exampleContent.includes('// ❌') || exampleContent.includes('// ✅');

	lines.forEach((line, index) => {
		const trimmed = line.trim();
		const lineNumber = index + LINE_NUMBER_OFFSET;

		// Check for inline violation/valid markers
		if (trimmed.includes('// ❌')) {
			violationMarkers.push({
				description: 'Inline violation marker // ❌',
				index: violationMarkers.length,
				isViolation: true,
				lineNumber,
			});
		} else if (trimmed.includes('// ✅')) {
			validMarkers.push({
				description: 'Inline valid marker // ✅',
				index: validMarkers.length,
				isViolation: false,
				lineNumber,
			});
		}

		// Section headers create markers only when there are no inline markers
		if (!hasInlineMarkersInExample) {
			if (trimmed.startsWith('// Violation:')) {
				const description = trimmed
					.substring('// Violation:'.length)
					.trim();
				violationMarkers.push({
					description,
					index: violationMarkers.length,
					isViolation: true,
					lineNumber,
				});
			} else if (trimmed.startsWith('// Valid:')) {
				const description = trimmed
					.substring('// Valid:'.length)
					.trim();
				validMarkers.push({
					description,
					index: validMarkers.length,
					isViolation: false,
					lineNumber,
				});
			}
		}
	});

	return { validMarkers, violationMarkers };
}
