/**
 * @file
 * Parses PMD XML output and extracts violation information for rule testing.
 */
import { DOMParser } from '@xmldom/xmldom';
import type { Violation } from '../types/index.js';

const DEFAULT_LINE = 0;
const DEFAULT_COLUMN = 0;
const DEFAULT_PRIORITY = '5';
const DEFAULT_MESSAGE = '';
const RADIX = 10;
const MIN_STRING_LENGTH = 0;
const MIN_TEXT_LENGTH = 0;

/**
 * Parse PMD XML output and extract violation information.
 * @param xmlOutput - Raw XML output from PMD CLI.
 * @returns Array of violation objects.
 */
export function parseViolations(xmlOutput: string): Violation[] {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlOutput, 'text/xml');
	const violations: Violation[] = [];

	// PMD XML format: <pmd><file><violation>...</violation></file></pmd>
	const fileNodes = Array.from(doc.getElementsByTagName('file'));

	for (const fileNode of fileNodes) {
		const violationNodes = Array.from(
			fileNode.getElementsByTagName('violation'),
		);

		for (const violationNode of violationNodes) {
			const beginlineAttr = violationNode.getAttribute('beginline');
			const begincolumnAttr = violationNode.getAttribute('begincolumn');
			const priorityAttr = violationNode.getAttribute('priority');
			const ruleAttr = violationNode.getAttribute('rule');
			const messageAttr = violationNode.getAttribute('message');
			const rawTextContent = violationNode.textContent;
			// xmldom always returns string (never null) for textContent
			const trimmedText = rawTextContent.trim();
			const hasTextContent = trimmedText.length > MIN_TEXT_LENGTH;
			const textContent = hasTextContent ? trimmedText : DEFAULT_MESSAGE;

			// Handle null or empty string attributes
			const hasBeginline =
				beginlineAttr !== null &&
				beginlineAttr.length > MIN_STRING_LENGTH;
			const line = parseInt(
				hasBeginline ? beginlineAttr : String(DEFAULT_LINE),
				RADIX,
			);

			const hasBegincolumn =
				begincolumnAttr !== null &&
				begincolumnAttr.length > MIN_STRING_LENGTH;
			const column = parseInt(
				hasBegincolumn ? begincolumnAttr : String(DEFAULT_COLUMN),
				RADIX,
			);

			// Prefer message attribute, then textContent, then default
			const hasMessageAttr =
				messageAttr !== null && messageAttr.length > MIN_STRING_LENGTH;
			// textContent is DEFAULT_MESSAGE when empty
			const message = hasMessageAttr ? messageAttr : textContent;

			const hasPriorityAttr =
				priorityAttr !== null &&
				priorityAttr.length > MIN_STRING_LENGTH;
			const priority = parseInt(
				hasPriorityAttr ? priorityAttr : DEFAULT_PRIORITY,
				RADIX,
			);

			const hasRuleAttr =
				ruleAttr !== null && ruleAttr.length > MIN_STRING_LENGTH;
			const rule = hasRuleAttr ? ruleAttr : DEFAULT_MESSAGE;

			const violation: Violation = {
				column,
				line,
				message,
				priority,
				rule,
			};

			violations.push(violation);
		}
	}

	return violations;
}
