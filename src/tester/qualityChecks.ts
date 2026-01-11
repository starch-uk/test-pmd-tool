import { checkRuleMetadata } from './quality/checkRuleMetadata.js';
import { checkExamples } from './quality/checkExamples.js';
import { checkDuplicates } from './quality/checkDuplicates.js';
import type {
	RuleMetadata,
	ExampleData,
	ValidationResult,
} from '../types/index.js';

/**
 * Main entry point for rule quality validation
 * @param ruleMetadata - Rule metadata from XML
 * @param examples - Array of parsed examples
 * @returns Validation result with issues and warnings
 */
export function runQualityChecks(
	ruleMetadata: RuleMetadata,
	examples: ExampleData[],
): ValidationResult {
	const issues: string[] = [];
	const warnings: string[] = [];

	// Check rule metadata quality
	const metadataResult = checkRuleMetadata(ruleMetadata);
	issues.push(...metadataResult.issues);
	warnings.push(...metadataResult.warnings);

	// Check example quality
	const examplesResult = checkExamples(examples);
	issues.push(...examplesResult.issues);
	warnings.push(...examplesResult.warnings);

	// Check for duplicates
	const duplicatesResult = checkDuplicates(examples);
	issues.push(...duplicatesResult.issues);
	warnings.push(...duplicatesResult.warnings);

	return {
		passed: issues.length === 0,
		issues: issues,
		warnings: warnings,
	};
}
