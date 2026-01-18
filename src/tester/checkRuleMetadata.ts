/**
 * @file
 * Rule metadata validation for PMD rules.
 */
import type { RuleMetadata, ValidationResult } from '../types/index.js';

const MIN_RULE_NAME_LENGTH = 3;
const MIN_MESSAGE_LENGTH = 10;
const MIN_DESCRIPTION_LENGTH = 20;
const MIN_HARDCODED_STRING_LENGTH = 4;
const MIN_ERROR_COUNT = 0;
const MIN_MATCH_COUNT = 0;

/**
 * Check if XPath contains hardcoded values.
 * @param xpath - XPath expression to check.
 * @returns True if hardcoded values are found.
 */
function containsHardcodedValues(xpath: string): boolean {
	// Check for hardcoded numbers (except common values like 0, 1)
	const hardcodedNumbers = xpath.match(/\b[2-9]\d*\b/g);
	if (
		hardcodedNumbers !== null &&
		hardcodedNumbers.length > MIN_MATCH_COUNT
	) {
		return true;
	}

	// Check for hardcoded strings (both single and double quotes)
	const hardcodedStrings = xpath.match(/["'][^"']*["']/g);
	const hasLongHardcodedStrings = hardcodedStrings?.some(
		(str) => str.length > MIN_HARDCODED_STRING_LENGTH,
	);
	if (hasLongHardcodedStrings === true) {
		return true;
	}

	return false;
}

/**
 * Check rule metadata for quality issues.
 * @param metadata - Rule metadata to validate.
 * @returns Validation result with errors and warnings.
 */
export function checkRuleMetadata(
	metadata: Readonly<RuleMetadata>,
): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required fields
	if (
		metadata.ruleName === null ||
		metadata.ruleName === undefined ||
		metadata.ruleName === ''
	) {
		errors.push('Rule name is missing');
	}

	if (
		metadata.message === null ||
		metadata.message === undefined ||
		metadata.message === ''
	) {
		errors.push('Rule message is missing');
	}

	if (
		metadata.description === null ||
		metadata.description === undefined ||
		metadata.description === ''
	) {
		warnings.push('Rule description is missing (recommended)');
	}

	if (
		metadata.xpath === null ||
		metadata.xpath === undefined ||
		metadata.xpath === ''
	) {
		errors.push('Rule XPath expression is missing');
	}

	// Check field quality
	if (
		metadata.ruleName !== null &&
		metadata.ruleName !== undefined &&
		metadata.ruleName.length < MIN_RULE_NAME_LENGTH
	) {
		const minLengthStr = String(MIN_RULE_NAME_LENGTH);
		warnings.push(
			`Rule name is very short (less than ${minLengthStr} characters)`,
		);
	}

	if (
		metadata.message !== null &&
		metadata.message !== undefined &&
		metadata.message.length < MIN_MESSAGE_LENGTH
	) {
		const minLengthStr = String(MIN_MESSAGE_LENGTH);
		warnings.push(
			`Rule message is very short (less than ${minLengthStr} characters)`,
		);
	}

	if (
		metadata.description !== null &&
		metadata.description !== undefined &&
		metadata.description.length < MIN_DESCRIPTION_LENGTH
	) {
		const minLengthStr = String(MIN_DESCRIPTION_LENGTH);
		warnings.push(
			`Rule description is very short (less than ${minLengthStr} characters)`,
		);
	}

	// Check for hardcoded values in XPath
	const xpathValue = metadata.xpath;
	const hasXPath =
		xpathValue !== null && xpathValue !== undefined && xpathValue !== '';
	if (hasXPath && containsHardcodedValues(xpathValue)) {
		warnings.push(
			'XPath contains hardcoded values that should be parameterized',
		);
	}

	return {
		issues: errors,
		passed: errors.length === MIN_ERROR_COUNT,
		warnings,
	};
}
