/**
 * @file
 * Quality checks orchestration for PMD rule validation.
 */
import type {
	RuleMetadata,
	ExampleData,
	ValidationResult,
} from '../types/index.js';
import { checkRuleMetadata } from './quality/checkRuleMetadata.js';
import { checkExamples } from './quality/checkExamples.js';
import { checkDuplicates } from './quality/checkDuplicates.js';

const MIN_ISSUES_COUNT = 0;

/**
 * Main entry point for rule quality validation.
 * @param ruleMetadata - Rule metadata from XML.
 * @param examples - Array of parsed examples.
 * @returns Validation result with issues and warnings.
 */
export function runQualityChecks(
	ruleMetadata: Readonly<RuleMetadata>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array elements are accessed and iterated
	examples: readonly ExampleData[],
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
		issues: issues,
		passed: issues.length === MIN_ISSUES_COUNT,
		warnings: warnings,
	};
}
