/**
 * @file
 * Extracts violation and valid markers from example content for PMD rule testing.
 * Uses AST-based extraction when available for precise code span identification.
 */
import type { ViolationMarker } from '../types/index.js';
import { extractMarkersWithAST } from './astMarkerExtractor.js';

// No longer needed - trusting ts-summit-ast implementation

/**
 * Extract violation and valid markers from example content.
 * Uses AST-based extraction via ts-summit-ast.
 * @param exampleContent - Raw example content with markers.
 * @param xpathExpression - Optional XPath expression for rule triggering verification.
 * @returns Object containing violation and valid markers.
 */
export function extractMarkers(
	exampleContent: string,
	xpathExpression?: string,
): {
	validMarkers: ViolationMarker[];
	violationMarkers: ViolationMarker[];
} {
	// Trust ts-summit-ast to handle all marker extraction
	return extractMarkersWithAST(exampleContent, xpathExpression);
}
