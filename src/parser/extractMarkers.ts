import type { ViolationMarker } from '../types/index.js';

/**
 * Extract violation and valid markers from example content
 * @param exampleContent - Raw example content with markers
 * @returns Object containing violation and valid markers
 */
export function extractMarkers(exampleContent: string): {
	violationMarkers: ViolationMarker[];
	validMarkers: ViolationMarker[];
} {
	const lines = exampleContent.split('\n');
	const violationMarkers: ViolationMarker[] = [];
	const validMarkers: ViolationMarker[] = [];

	const hasInlineMarkersInExample =
		exampleContent.includes('// ❌') || exampleContent.includes('// ✅');

	lines.forEach((line, index) => {
		const trimmed = line.trim();
		const lineNumber = index + 1;

		// Check for inline violation/valid markers
		if (trimmed.includes('// ❌')) {
			violationMarkers.push({
				lineNumber,
				description: 'Inline violation marker // ❌',
				isViolation: true,
				index: violationMarkers.length,
			});
		} else if (trimmed.includes('// ✅')) {
			validMarkers.push({
				lineNumber,
				description: 'Inline valid marker // ✅',
				isViolation: false,
				index: validMarkers.length,
			});
		}

		// Section headers create markers only when there are no inline markers
		if (!hasInlineMarkersInExample) {
			if (trimmed.startsWith('// Violation:')) {
				const description = trimmed
					.substring('// Violation:'.length)
					.trim();
				violationMarkers.push({
					lineNumber,
					description,
					isViolation: true,
					index: violationMarkers.length,
				});
			} else if (trimmed.startsWith('// Valid:')) {
				const description = trimmed
					.substring('// Valid:'.length)
					.trim();
				validMarkers.push({
					lineNumber,
					description,
					isViolation: false,
					index: validMarkers.length,
				});
			}
		}
	});

	return { violationMarkers, validMarkers };
}
