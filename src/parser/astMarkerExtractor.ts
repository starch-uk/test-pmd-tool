/**
 * @file
 * AST-based marker extraction using ts-summit-ast for precise code span identification.
 */
import {
	extractComments,
	getSourceRange,
	getSourceText,
	wouldTriggerRule,
} from 'ts-summit-ast';
import type { ViolationMarker } from '../types/index.js';
import { parseApexCode, isValidParseResult } from './apexParser.js';

const MIN_DESCRIPTION_LENGTH = 0;
const MIN_CONFIDENCE_THRESHOLD = 0.5;
const FIRST_MATCH_GROUP_INDEX = 1;
const DEFAULT_ASSOCIATION_CONFIDENCE = 0;
const EMPTY_STRING_LENGTH = 0;

/**
 * Extract markers with AST-based code span information.
 * Uses ts-summit-ast APIs for precise code span identification and rule verification.
 * @param exampleContent - Raw example content with markers.
 * @param xpathExpression - Optional XPath expression for rule triggering verification.
 * @returns Object containing violation and valid markers with AST information.
 */
export function extractMarkersWithAST(
	exampleContent: string,
	xpathExpression?: string,
): {
	validMarkers: ViolationMarker[];
	violationMarkers: ViolationMarker[];
} {
	// Parse the Apex code to get AST
	const parseResult = parseApexCode(exampleContent);
	const hasValidAST = isValidParseResult(parseResult);

	const violationMarkers: ViolationMarker[] = [];
	const validMarkers: ViolationMarker[] = [];

	// Check if inline markers are present (to prioritize them over section markers)
	const hasInlineMarkersInExample =
		exampleContent.includes('// ❌') || exampleContent.includes('// ✅');

	// Trust ts-summit-ast to parse and extract comments
	// Use comment pattern recognition if available (new ts-summit-ast API)
	if (hasValidAST) {
		// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Type parameter index must be literal number
		const extractionOptions: Parameters<typeof extractComments>[2] = {
			associateNodes: true,
			includeLineComments: true,
		};

		// Use comment pattern recognition for section markers if API supports it (new ts-summit-ast feature)
		// Pattern for section markers: // Violation: or // Valid:
		// This will automatically categorize these comments and extract metadata
		const sectionViolationPattern = /^\/\/\s*Violation:\s*(.+)$/;
		const sectionValidPattern = /^\/\/\s*Valid:\s*(.+)$/;
		// Type assertion for commentPatterns if available in ts-summit-ast
		const optionsWithPatterns = extractionOptions as {
			commentPatterns?: { pattern: RegExp; type: string }[];
		};
		optionsWithPatterns.commentPatterns = [
			{ pattern: sectionViolationPattern, type: 'violation' },
			{ pattern: sectionValidPattern, type: 'valid' },
		];

		const extractedComments = extractComments(
			parseResult.ast,
			exampleContent,
			extractionOptions,
		);

		for (const comment of extractedComments) {
			// Use fullText directly (now required in ts-summit-ast)
			const { fullText } = comment;
			const isViolationMarker = fullText.includes('❌');
			const isValidMarker = fullText.includes('✅');
			const isSectionViolation = fullText.startsWith('// Violation:');
			const isSectionValid = fullText.startsWith('// Valid:');

			if (isViolationMarker || isValidMarker) {
				// Use description directly (now required in ts-summit-ast)
				// Strip marker emoji from description if present
				const descriptionText = comment.description
					.replace(/^❌\s*/, '')
					.replace(/^✅\s*/, '')
					.trim();

				const description =
					descriptionText.length > MIN_DESCRIPTION_LENGTH
						? `Inline ${isViolationMarker ? 'violation' : 'valid'} marker: ${descriptionText}`
						: `Inline ${isViolationMarker ? 'violation' : 'valid'} marker // ${isViolationMarker ? '❌' : '✅'}`;

				const marker: ViolationMarker = {
					description,
					index: isViolationMarker
						? violationMarkers.length
						: validMarkers.length,
					isViolation: isViolationMarker,
					lineNumber: comment.line,
				};

				// Add AST information if node is associated
				// Use nodeRelationship and associationConfidence directly (now required in ts-summit-ast)
				const isAnnotated = comment.nodeRelationship === 'annotated';
				const isAttached = comment.nodeRelationship === 'attached';
				const hasGoodAssociation = isAnnotated || isAttached;
				// associationConfidence is required when associateNodes is true
				const associationConfidence =
					comment.associationConfidence ??
					DEFAULT_ASSOCIATION_CONFIDENCE;
				const hasConfidentAssociation =
					associationConfidence >= MIN_CONFIDENCE_THRESHOLD;

				const { associatedNode } = comment;
				if (
					associatedNode &&
					hasGoodAssociation &&
					hasConfidentAssociation
				) {
					// ts-summit-ast always provides source range for associated nodes
					const sourceRange = getSourceRange(associatedNode);
					// Type assertion: ts-summit-ast guarantees source range for associated nodes
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ts-summit-ast guarantees source range for associated nodes
					const range = sourceRange!;
					marker.codeSpan = {
						endColumn: range.end.column,
						endLine: range.end.line,
						startColumn: range.start.column,
						startLine: range.start.line,
					};
					marker.codeText = getSourceText(
						associatedNode,
						exampleContent,
					);

					// Get node type from AST
					// Ensure associatedNode has kind property before accessing
					if ('kind' in associatedNode) {
						marker.astNodeType = (
							associatedNode as { kind: string }
						).kind;
					}

					// Verify rule triggering if XPath is provided
					// Only check for violation markers to avoid unnecessary warnings on valid markers
					if (
						xpathExpression !== undefined &&
						xpathExpression.length > EMPTY_STRING_LENGTH &&
						isViolationMarker
					) {
						const ruleMatch = wouldTriggerRule(
							associatedNode,
							xpathExpression,
						);
						// Add warning only if rule doesn't match (unreachable in practice)
						if (!ruleMatch.matches) {
							marker.description += ` (⚠️ Rule may not trigger)`;
						}
					}
				} else {
					// Ensure optional properties are undefined when no node is associated
					marker.astNodeType = undefined;
					marker.codeSpan = undefined;
					marker.codeText = undefined;
				}

				if (isViolationMarker) {
					violationMarkers.push(marker);
				} else {
					validMarkers.push(marker);
				}
			} else if (
				(isSectionViolation || isSectionValid) &&
				!hasInlineMarkersInExample
			) {
				// Extract description from section marker format
				// Pattern metadata path is unreachable - ts-summit-ast doesn't provide it for section markers
				const descriptionMatch =
					/^\/\/\s*(?:Violation|Valid):\s*(.+)$/.exec(fullText);
				const matchGroup = descriptionMatch?.[FIRST_MATCH_GROUP_INDEX];
				const descriptionText =
					matchGroup !== undefined ? matchGroup.trim() : '';

				const description =
					descriptionText.length > MIN_DESCRIPTION_LENGTH
						? descriptionText
						: isSectionViolation
							? 'Violation'
							: 'Valid';

				const marker: ViolationMarker = {
					description,
					index: isSectionViolation
						? violationMarkers.length
						: validMarkers.length,
					isViolation: isSectionViolation,
					lineNumber: comment.line,
				};

				if (isSectionViolation) {
					violationMarkers.push(marker);
				} else {
					validMarkers.push(marker);
				}
			}
		}
	}

	// Fallback: If AST parsing failed, extract markers directly from content
	if (!hasValidAST && hasInlineMarkersInExample) {
		const contentLines = exampleContent.split('\n');
		const LINE_NUMBER_OFFSET = 1;
		for (let lineIndex = 0; lineIndex < contentLines.length; lineIndex++) {
			const line = contentLines[lineIndex];
			if (line === undefined || line.length === MIN_DESCRIPTION_LENGTH)
				continue;

			const isViolationMarker = line.includes('// ❌');
			const isValidMarker = line.includes('// ✅');

			if (isViolationMarker || isValidMarker) {
				// Extract description from marker
				const markerMatch = /\/\/\s*[❌✅]\s*(.+)$/.exec(line);
				const rawDescription = markerMatch?.[FIRST_MATCH_GROUP_INDEX];
				const descriptionText =
					rawDescription !== undefined ? rawDescription.trim() : '';
				const description =
					descriptionText.length > MIN_DESCRIPTION_LENGTH
						? `Inline ${isViolationMarker ? 'violation' : 'valid'} marker: ${descriptionText}`
						: `Inline ${isViolationMarker ? 'violation' : 'valid'} marker // ${isViolationMarker ? '❌' : '✅'}`;

				const marker: ViolationMarker = {
					description,
					index: isViolationMarker
						? violationMarkers.length
						: validMarkers.length,
					isViolation: isViolationMarker,
					lineNumber: lineIndex + LINE_NUMBER_OFFSET,
				};

				if (isViolationMarker) {
					violationMarkers.push(marker);
				} else {
					validMarkers.push(marker);
				}
			}
		}
	}

	return { validMarkers, violationMarkers };
}
