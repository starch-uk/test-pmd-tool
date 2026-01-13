/**
 * @file
 * Parses example content and extracts violations, valids, and markers for PMD rule testing.
 */
import type { ExampleData } from '../types/index.js';
import { extractMarkers } from './extractMarkers.js';

const EMPTY_STRING_INDEX = 0;

/**
 * Parse example content and extract violations, valids, and markers.
 * @param exampleContent - Raw example content with code and markers.
 * @returns Parsed example data (without exampleIndex, which is added by the caller).
 */
export function parseExample(
	exampleContent: string,
): Omit<ExampleData, 'exampleIndex'> {
	const lines = exampleContent.split('\n');
	const violations: string[] = [];
	const valids: string[] = [];
	let currentMode: 'valid' | 'violation' | null = null;

	const { validMarkers, violationMarkers } = extractMarkers(exampleContent);

	const hasInlineMarkersInExample =
		exampleContent.includes('// ❌') || exampleContent.includes('// ✅');

	lines.forEach((line) => {
		const trimmed = line.trim();

		/**
		 * Default to current mode.
		 */
		let lineMode = currentMode;

		// Check for inline violation/valid markers
		if (trimmed.includes('// ❌')) {
			lineMode = 'violation';
		} else if (trimmed.includes('// ✅')) {
			lineMode = 'valid';
		}

		if (trimmed.startsWith('// Violation:')) {
			currentMode = 'violation';
			// Section headers create markers only when there are no inline markers
			if (!hasInlineMarkersInExample) {
				// We don't add markers here - they're added in extractMarkers
			}
		} else if (trimmed.startsWith('// Valid:')) {
			currentMode = 'valid';
			// Section headers create markers only when there are no inline markers
			if (!hasInlineMarkersInExample) {
				// We don't add markers here - they're added in extractMarkers
			}
		} else if (trimmed && !trimmed.startsWith('//') && trimmed !== '') {
			// This is a code line - it belongs to the determined mode (inline markers override)
			// Remove inline comment markers from the code
			let codeLine = line;
			if (line.includes('// ❌')) {
				const splitResult = line.split('// ❌');
				// split() always returns at least one element, so [0] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- split() always returns at least one element
				codeLine = splitResult[EMPTY_STRING_INDEX]!.trim();
			} else if (line.includes('// ✅')) {
				const splitResult = line.split('// ✅');
				// split() always returns at least one element, so [0] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- split() always returns at least one element
				codeLine = splitResult[EMPTY_STRING_INDEX]!.trim();
			}

			if (lineMode === 'violation') {
				violations.push(codeLine);
			} else if (lineMode === 'valid') {
				valids.push(codeLine);
			}
		}
	});

	return {
		content: exampleContent,
		validMarkers,
		valids,
		violationMarkers,
		violations,
	};
}
