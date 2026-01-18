/**
 * @file
 * Unit tests for checkRuleMetadata function.
 */
import { describe, it } from 'vitest';
import { checkRuleMetadata } from '../../../src/tester/checkRuleMetadata.js';
import {
	expectPassedWithNoIssues,
	expectPassedWithNoIssuesOnly,
	expectFailed,
	expectIssue,
	expectIssueCount,
	expectWarning,
	expectWarningCount,
} from '../helpers/assertions.js';
import {
	createRuleMetadata,
	createValidRuleMetadata,
} from '../helpers/fixtures.js';

describe('checkRuleMetadata', () => {
	it('should pass when all required fields are present and valid', () => {
		const metadata = createValidRuleMetadata();
		const result = checkRuleMetadata(metadata);

		expectPassedWithNoIssues(result);
	});

	it('should error when rule name is missing', () => {
		const metadata = createRuleMetadata({ ruleName: null });
		const result = checkRuleMetadata(metadata);

		expectFailed(result);
		expectIssue(result, 'Rule name is missing');
	});

	it('should error when rule message is missing', () => {
		const metadata = createRuleMetadata({ message: null });
		const result = checkRuleMetadata(metadata);

		expectFailed(result);
		expectIssue(result, 'Rule message is missing');
	});

	it('should error when XPath is missing', () => {
		const metadata = createRuleMetadata({ xpath: null });
		const result = checkRuleMetadata(metadata);

		expectFailed(result);
		expectIssue(result, 'Rule XPath expression is missing');
	});

	it('should warn when rule name is too short', () => {
		const metadata = createRuleMetadata({ ruleName: 'A' });
		const result = checkRuleMetadata(metadata);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(
			result,
			'Rule name is very short (less than 3 characters)',
		);
	});

	it('should warn when rule message is too short', () => {
		const metadata = createRuleMetadata({ message: 'Short' });
		const result = checkRuleMetadata(metadata);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(
			result,
			'Rule message is very short (less than 10 characters)',
		);
	});

	it('should warn when rule description is too short', () => {
		const metadata = createRuleMetadata({ description: 'Short' });
		const result = checkRuleMetadata(metadata);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(
			result,
			'Rule description is very short (less than 20 characters)',
		);
	});

	it('should warn when description is missing', () => {
		const metadata = createRuleMetadata({ description: null });
		const result = checkRuleMetadata(metadata);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(result, 'Rule description is missing (recommended)');
	});

	it('should warn when XPath contains hardcoded values', () => {
		const hardcodedXPaths = [
			'//Method[position()=5]',
			'//Method[@Name="hardcodedValue"]',
			"//Method[@Name='hardcodedValue']",
		];

		for (const xpath of hardcodedXPaths) {
			const metadata = createRuleMetadata({ xpath });
			const result = checkRuleMetadata(metadata);

			expectPassedWithNoIssuesOnly(result);
			expectWarning(
				result,
				'XPath contains hardcoded values that should be parameterized',
			);
		}
	});

	it('should handle multiple issues and warnings', () => {
		const metadata = createRuleMetadata({
			description: 'Short',
			message: 'Hi',
			ruleName: 'A',
			xpath: '//Method[position()=5]',
		});

		const result = checkRuleMetadata(metadata);

		expectPassedWithNoIssuesOnly(result);
		expectWarningCount(result, 4);
		expectWarning(
			result,
			'Rule name is very short (less than 3 characters)',
		);
		expectWarning(
			result,
			'Rule message is very short (less than 10 characters)',
		);
		expectWarning(
			result,
			'Rule description is very short (less than 20 characters)',
		);
		expectWarning(
			result,
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should handle null/undefined fields gracefully', () => {
		const metadata = createRuleMetadata({
			description: undefined,
			message: undefined,
			ruleName: undefined,
			xpath: undefined,
		});

		const result = checkRuleMetadata(metadata);

		expectFailed(result);
		expectIssueCount(result, 3);
		expectWarningCount(result, 1);
		expectIssue(result, 'Rule name is missing');
		expectIssue(result, 'Rule message is missing');
		expectIssue(result, 'Rule XPath expression is missing');
		expectWarning(result, 'Rule description is missing (recommended)');
	});
});
