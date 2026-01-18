/**
 * @file
 * Common assertion helpers for unit tests.
 * Reduces duplication and improves test readability.
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- ValidationResult is properly typed, these are safe accesses */
import { expect } from 'vitest';
import type { ValidationResult } from '../../../src/types/index.js';

/**
 * Asserts that a validation result passed with no issues or warnings.
 * @param result - The validation result to check.
 */
function expectPassedWithNoIssues(result: Readonly<ValidationResult>): void {
	expect(result.passed).toBe(true);
	expect(result.issues).toHaveLength(0);
	expect(result.warnings).toHaveLength(0);
}

/**
 * Asserts that a validation result passed with no issues (warnings may exist).
 * @param result - The validation result to check.
 */
function expectPassedWithNoIssuesOnly(
	result: Readonly<ValidationResult>,
): void {
	expect(result.passed).toBe(true);
	expect(result.issues).toHaveLength(0);
}

/**
 * Asserts that a validation result passed (issues and warnings may exist).
 * @param result - The validation result to check.
 */
function expectPassed(result: Readonly<ValidationResult>): void {
	expect(result.passed).toBe(true);
}

/**
 * Asserts that a validation result failed.
 * @param result - The validation result to check.
 */
function expectFailed(result: Readonly<ValidationResult>): void {
	expect(result.passed).toBe(false);
}

/**
 * Asserts that a validation result has no issues.
 * @param result - The validation result to check.
 */
function expectNoIssues(result: Readonly<ValidationResult>): void {
	expect(result.issues).toHaveLength(0);
}

/**
 * Asserts that a validation result has no warnings.
 * @param result - The validation result to check.
 */
function expectNoWarnings(result: Readonly<ValidationResult>): void {
	expect(result.warnings).toHaveLength(0);
}

/**
 * Asserts that a validation result has a specific number of issues.
 * @param result - The validation result to check.
 * @param count - The expected number of issues.
 */
function expectIssueCount(
	result: Readonly<ValidationResult>,
	count: Readonly<number>,
): void {
	expect(result.issues).toHaveLength(count);
}

/**
 * Asserts that a validation result has a specific number of warnings.
 * @param result - The validation result to check.
 * @param count - The expected number of warnings.
 */
function expectWarningCount(
	result: Readonly<ValidationResult>,
	count: Readonly<number>,
): void {
	expect(result.warnings).toHaveLength(count);
}

/**
 * Asserts that a validation result contains a specific issue.
 * @param result - The validation result to check.
 * @param issue - The issue message to look for.
 */
function expectIssue(
	result: Readonly<ValidationResult>,
	issue: Readonly<string>,
): void {
	expect(result.issues).toContain(issue);
}

/**
 * Asserts that a validation result contains a specific warning.
 * @param result - The validation result to check.
 * @param warning - The warning message to look for.
 */
function expectWarning(
	result: Readonly<ValidationResult>,
	warning: Readonly<string>,
): void {
	expect(result.warnings).toContain(warning);
}

/**
 * Asserts that a validation result contains a warning that includes the given text.
 * @param result - The validation result to check.
 * @param text - The text to search for in warnings.
 */
function expectWarningContaining(
	result: Readonly<ValidationResult>,
	text: Readonly<string>,
): void {
	expect(result.warnings.some((w) => w.includes(text))).toBe(true);
}

export {
	expectFailed,
	expectIssue,
	expectIssueCount,
	expectNoIssues,
	expectNoWarnings,
	expectPassed,
	expectPassedWithNoIssues,
	expectPassedWithNoIssuesOnly,
	expectWarning,
	expectWarningContaining,
	expectWarningCount,
};
