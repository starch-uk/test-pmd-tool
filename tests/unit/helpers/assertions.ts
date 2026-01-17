/**
 * @file
 * Common assertion helpers for unit tests.
 * Reduces duplication and improves test readability.
 */
/* eslint-disable import/group-exports -- Helper functions must be exported individually */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Test helpers accept mutable test data */
import { expect } from 'vitest';
import type { ValidationResult } from '../../../src/types/index.js';

/**
 * Asserts that a validation result passed with no issues or warnings.
 * @param result - The validation result to check.
 */
export function expectPassedWithNoIssues(result: ValidationResult): void {
	expect(result.passed).toBe(true);
	expect(result.issues).toHaveLength(0);
	expect(result.warnings).toHaveLength(0);
}

/**
 * Asserts that a validation result passed with no issues (warnings may exist).
 * @param result - The validation result to check.
 */
export function expectPassedWithNoIssuesOnly(result: ValidationResult): void {
	expect(result.passed).toBe(true);
	expect(result.issues).toHaveLength(0);
}

/**
 * Asserts that a validation result passed (issues and warnings may exist).
 * @param result - The validation result to check.
 */
export function expectPassed(result: ValidationResult): void {
	expect(result.passed).toBe(true);
}

/**
 * Asserts that a validation result failed.
 * @param result - The validation result to check.
 */
export function expectFailed(result: ValidationResult): void {
	expect(result.passed).toBe(false);
}

/**
 * Asserts that a validation result has no issues.
 * @param result - The validation result to check.
 */
export function expectNoIssues(result: ValidationResult): void {
	expect(result.issues).toHaveLength(0);
}

/**
 * Asserts that a validation result has no warnings.
 * @param result - The validation result to check.
 */
export function expectNoWarnings(result: ValidationResult): void {
	expect(result.warnings).toHaveLength(0);
}

/**
 * Asserts that a validation result has a specific number of issues.
 * @param result - The validation result to check.
 * @param count - The expected number of issues.
 */
export function expectIssueCount(
	result: ValidationResult,
	count: number,
): void {
	expect(result.issues).toHaveLength(count);
}

/**
 * Asserts that a validation result has a specific number of warnings.
 * @param result - The validation result to check.
 * @param count - The expected number of warnings.
 */
export function expectWarningCount(
	result: ValidationResult,
	count: number,
): void {
	expect(result.warnings).toHaveLength(count);
}

/**
 * Asserts that a validation result contains a specific issue.
 * @param result - The validation result to check.
 * @param issue - The issue message to look for.
 */
export function expectIssue(result: ValidationResult, issue: string): void {
	expect(result.issues).toContain(issue);
}

/**
 * Asserts that a validation result contains a specific warning.
 * @param result - The validation result to check.
 * @param warning - The warning message to look for.
 */
export function expectWarning(result: ValidationResult, warning: string): void {
	expect(result.warnings).toContain(warning);
}

/**
 * Asserts that a validation result contains a warning that includes the given text.
 * @param result - The validation result to check.
 * @param text - The text to search for in warnings.
 */
export function expectWarningContaining(
	result: ValidationResult,
	text: string,
): void {
	expect(result.warnings.some((w) => w.includes(text))).toBe(true);
}
