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
 * Parse integer attribute from XML node.
 * @param attrValue - Attribute value or null.
 * @param defaultValue - Default value if attribute is missing or empty.
 * @returns Parsed integer value.
 */
function parseIntAttribute(
	attrValue: Readonly<string | null>,
	defaultValue: Readonly<number>,
): number {
	const hasValue = attrValue !== null && attrValue.length > MIN_STRING_LENGTH;
	return parseInt(hasValue ? attrValue : String(defaultValue), RADIX);
}

/**
 * Parse string attribute from XML node.
 * @param attrValue - Attribute value or null.
 * @param defaultValue - Default value if attribute is missing or empty.
 * @returns String value.
 */
function parseStringAttribute(
	attrValue: Readonly<string | null>,
	defaultValue: Readonly<string>,
): string {
	const hasValue = attrValue !== null && attrValue.length > MIN_STRING_LENGTH;
	return hasValue ? attrValue : defaultValue;
}

/**
 * Extract message from violation node.
 * Prefers message attribute, then textContent, then default.
 * @param messageAttr - Message attribute value.
 * @param textContent - Text content of violation node.
 * @returns Message string.
 */
function extractViolationMessage(
	messageAttr: Readonly<string | null>,
	textContent: Readonly<string>,
): string {
	const hasMessageAttr =
		messageAttr !== null && messageAttr.length > MIN_STRING_LENGTH;
	return hasMessageAttr ? messageAttr : textContent;
}

/**
 * Parse a single violation node into a Violation object.
 * @param violationNode - XML violation node element.
 * @returns Parsed violation object.
 */
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Element interface is not readonly by design
function parseViolationNode(violationNode: Readonly<Element>): Violation {
	const beginlineAttr = violationNode.getAttribute('beginline');
	const begincolumnAttr = violationNode.getAttribute('begincolumn');
	const priorityAttr = violationNode.getAttribute('priority');
	const ruleAttr = violationNode.getAttribute('rule');
	const messageAttr = violationNode.getAttribute('message');
	const rawTextContent = violationNode.textContent;
	const trimmedText = rawTextContent.trim();
	const hasTextContent = trimmedText.length > MIN_TEXT_LENGTH;
	const textContent = hasTextContent ? trimmedText : DEFAULT_MESSAGE;

	const line = parseIntAttribute(beginlineAttr, DEFAULT_LINE);
	const column = parseIntAttribute(begincolumnAttr, DEFAULT_COLUMN);
	const priority = parseIntAttribute(
		priorityAttr,
		Number.parseInt(DEFAULT_PRIORITY, RADIX),
	);
	const rule = parseStringAttribute(ruleAttr, DEFAULT_MESSAGE);
	const message = extractViolationMessage(messageAttr, textContent);

	return {
		column,
		line,
		message,
		priority,
		rule,
	};
}

/**
 * Parse PMD XML output and extract violation information.
 * @param xmlOutput - Raw XML output from PMD CLI.
 * @returns Array of violation objects.
 */
export function parseViolations(xmlOutput: Readonly<string>): Violation[] {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlOutput, 'text/xml');
	const violations: Violation[] = [];
	const fileNodes = Array.from(doc.getElementsByTagName('file'));

	for (const fileNode of fileNodes) {
		const violationNodes = Array.from(
			fileNode.getElementsByTagName('violation'),
		);

		for (const violationNode of violationNodes) {
			const violation = parseViolationNode(violationNode);
			violations.push(violation);
		}
	}

	return violations;
}
