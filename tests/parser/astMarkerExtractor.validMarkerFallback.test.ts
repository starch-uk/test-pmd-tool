/**
 * @file
 * Covers astMarkerExtractor fallback branches for valid markers.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('ts-summit-ast', () => ({
	parseApexCode: vi.fn(() => ({
		ast: undefined,
		errors: [{ message: 'nope', severity: 'error' }],
		isUsable: false,
		partialSuccess: false,
	})),
}));

import { extractMarkers } from '../../src/parser/extractMarkers.js';

describe('astMarkerExtractor fallback (valid markers)', () => {
	it('extracts ✅ markers when AST parsing fails', () => {
		// No description after ✅ to cover the "default description" branch.
		const content = `public class Example {\n  public void t(){\n    Integer x = 1; // ✅\n  }\n}\n`;

		const { validMarkers } = extractMarkers(content);
		expect(validMarkers.length).toBe(1);
		expect(validMarkers[0]?.isViolation).toBe(false);
	});
});
