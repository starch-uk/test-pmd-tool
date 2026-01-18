/**
 * @file
 * Unit tests for runQualityChecks function.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- Test fixtures return properly typed values */
import { describe, it, expect } from 'vitest';
import { runQualityChecks } from '../../src/tester/qualityChecks.js';
import {
	expectFailed,
	expectPassedWithNoIssuesOnly,
	expectIssue,
	expectWarning,
} from '../utils/assertions.js';
import {
	createExampleData,
	createRuleMetadata,
	createValidRuleMetadata,
	createViolationMarker,
} from '../utils/fixtures.js';

describe('runQualityChecks', () => {
	it('should return passed when all checks pass', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = createRuleMetadata({
			description:
				'A comprehensive test rule description that is long enough',
			xpath: '//Method[@Name="test"]',
		});

		const examples = [
			createExampleData({
				content: 'public class Test {}',
				violationMarkers: [
					createViolationMarker({ description: 'Test violation' }),
				],
				violations: ['public class Test {}'],
			}),
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

		expectPassedWithNoIssuesOnly(result);
		expect(result.warnings).toHaveLength(2);
		expectWarning(result, 'Example 1 has no valid markers');
		expectWarning(
			result,
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should return issues for missing rule metadata', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = createRuleMetadata({
			description: null,
			message: null,
			ruleName: null,
			xpath: null,
		});

		const examples = [
			createExampleData({
				content: 'public class Test {}',
				violations: ['public class Test {}'],
			}),
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

		expectFailed(result);
		expectIssue(result, 'Rule name is missing');
		expectIssue(result, 'Rule message is missing');
		expectIssue(result, 'Rule XPath expression is missing');
	});

	it('should return warnings for short description', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = createRuleMetadata({ description: 'Short' });

		const examples = [
			createExampleData({
				content: 'public class Test {}',
				violationMarkers: [
					createViolationMarker({ description: 'Test' }),
				],
				violations: ['public class Test {}'],
			}),
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(
			result,
			'Rule description is very short (less than 20 characters)',
		);
	});

	it('should return warnings for hardcoded values in XPath', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = createRuleMetadata({
			description: 'A comprehensive test rule description',
			xpath: '//Method[@Name="hardcoded"]',
		});

		const examples = [
			createExampleData({
				content: 'public class Test {}',
				violationMarkers: [
					createViolationMarker({ description: 'Test' }),
				],
				violations: ['public class Test {}'],
			}),
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(
			result,
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should return issues when no examples provided', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = createValidRuleMetadata();

		const result = runQualityChecks(ruleFilePath, ruleMetadata, []);

		expectFailed(result);
		expectIssue(result, 'No examples found in rule');
	});

	it('should aggregate issues and warnings from all checks', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = createRuleMetadata({
			description: 'Short',
			ruleName: null,
			xpath: '//Method[@Name="hardcoded"]',
		});

		const examples = [
			createExampleData({
				content: 'public class Test {}',
				violations: ['public class Test {}'],
			}),
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

		expectFailed(result);
		expectIssue(result, 'Rule name is missing');
		expectWarning(
			result,
			'Rule description is very short (less than 20 characters)',
		);
		expectWarning(
			result,
			'XPath contains hardcoded values that should be parameterized',
		);
	});
});
