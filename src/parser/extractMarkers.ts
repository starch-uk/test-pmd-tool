/**
 * @file
 * Extracts violation and valid markers from example content for PMD rule testing.
 */
import type { ViolationMarker } from '../types/index.js';

const LINE_NUMBER_OFFSET = 1;
const FIRST_MATCH_GROUP_INDEX = 1;
const MIN_DESCRIPTION_LENGTH = 0;
const REGEX_MARKER_PATTERN = /\/\/\s*❌\s*(.*)/;
const REGEX_VALID_PATTERN = /\/\/\s*✅\s*(.*)/;

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
			// Extract text after // ❌ marker, if any
			// Since we checked trimmed.includes('// ❌'), the regex will always match
			const regex = new RegExp(REGEX_MARKER_PATTERN);
			const markerMatch = regex.exec(trimmed);
			// markerMatch is never null because the pattern matches when includes() is true
			// firstMatch is always a string (possibly empty) because group 1 (.*) always matches
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex always matches when includes() is true
			const firstMatch = markerMatch![FIRST_MATCH_GROUP_INDEX]!;
			const descriptionText = firstMatch.trim();
			const description =
				descriptionText.length > MIN_DESCRIPTION_LENGTH
					? `Inline violation marker: ${descriptionText}`
					: 'Inline violation marker // ❌';
			violationMarkers.push({
				description,
				index: violationMarkers.length,
				isViolation: true,
				lineNumber,
			});
		} else if (trimmed.includes('// ✅')) {
			// Extract text after // ✅ marker, if any
			// Since we checked trimmed.includes('// ✅'), the regex will always match
			const regex = new RegExp(REGEX_VALID_PATTERN);
			const markerMatch = regex.exec(trimmed);
			// markerMatch is never null because the pattern matches when includes() is true
			// firstMatch is always a string (possibly empty) because group 1 (.*) always matches
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex always matches when includes() is true
			const firstMatch = markerMatch![FIRST_MATCH_GROUP_INDEX]!;
			const descriptionText = firstMatch.trim();
			const description =
				descriptionText.length > MIN_DESCRIPTION_LENGTH
					? `Inline valid marker: ${descriptionText}`
					: 'Inline valid marker // ✅';
			validMarkers.push({
				description,
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
