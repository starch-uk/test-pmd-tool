import type { RuleMetadata, ValidationResult } from '../../types/index.js';

/**
 * Check rule metadata for quality issues
 * @param metadata - Rule metadata to validate
 * @returns Validation result with errors and warnings
 */
export function checkRuleMetadata(metadata: RuleMetadata): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required fields
	if (!metadata.ruleName) {
		errors.push('Rule name is missing');
	}

	if (!metadata.message) {
		errors.push('Rule message is missing');
	}

	if (!metadata.description) {
		warnings.push('Rule description is missing (recommended)');
	}

	if (!metadata.xpath) {
		errors.push('Rule XPath expression is missing');
	}

	// Check field quality
	if (metadata.ruleName && metadata.ruleName.length < 3) {
		warnings.push('Rule name is very short (less than 3 characters)');
	}

	if (metadata.message && metadata.message.length < 10) {
		warnings.push('Rule message is very short (less than 10 characters)');
	}

	if (metadata.description && metadata.description.length < 20) {
		warnings.push(
			'Rule description is very short (less than 20 characters)',
		);
	}

	// Check for hardcoded values in XPath
	if (metadata.xpath && containsHardcodedValues(metadata.xpath)) {
		warnings.push(
			'XPath contains hardcoded values that should be parameterized',
		);
	}

	return {
		passed: errors.length === 0,
		issues: errors,
		warnings,
	};
}

/**
 * Check if XPath contains hardcoded values
 */
function containsHardcodedValues(xpath: string): boolean {
	// Check for hardcoded numbers (except common values like 0, 1)
	const hardcodedNumbers = xpath.match(/\b[2-9]\d*\b/g);
	if (hardcodedNumbers && hardcodedNumbers.length > 0) {
		return true;
	}

	// Check for hardcoded strings (both single and double quotes)
	const hardcodedStrings = xpath.match(/["'][^"']*["']/g);
	if (hardcodedStrings && hardcodedStrings.some((str) => str.length > 4)) {
		return true;
	}

	return false;
}
