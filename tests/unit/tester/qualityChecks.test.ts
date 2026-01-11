import { describe, it, expect } from 'vitest';
import { runQualityChecks } from '../../../src/tester/qualityChecks.js';

describe('runQualityChecks', () => {
	it('should return passed when all checks pass', () => {
		const ruleMetadata = {
			ruleName: 'TestRule',
			message: 'Test message',
			description:
				'A comprehensive test rule description that is long enough',
			xpath: '//Method[@Name="test"]',
		};

		const examples = [
			{
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: ['public class Test {}'],
				valids: [],
				violationMarkers: [
					{
						lineNumber: 1,
						description: 'Test violation',
						isViolation: true,
						index: 0,
					},
				],
				validMarkers: [],
			},
		];

		const result = runQualityChecks(ruleMetadata, examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(2);
		expect(result.warnings).toContain('Example 1 has no valid markers');
		expect(result.warnings).toContain('XPath contains hardcoded values that should be parameterized');
	});

	it('should return issues for missing rule metadata', () => {
		const ruleMetadata = {
			ruleName: null,
			message: null,
			description: null,
			xpath: null,
		};

		const examples = [
			{
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: [],
				valids: [],
				violationMarkers: [],
				validMarkers: [],
			},
		];

		const result = runQualityChecks(ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('Rule name is missing');
		expect(result.issues).toContain('Rule message is missing');
		expect(result.issues).toContain('Rule XPath expression is missing');
		expect(result.issues).toContain('Example 1 contains no code');
	});

	it('should return warnings for short description', () => {
		const ruleMetadata = {
			ruleName: 'TestRule',
			message: 'Test message',
			description: 'Short',
			xpath: '//Method',
		};

		const examples = [
			{
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: ['public class Test {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
			},
		];

		const result = runQualityChecks(ruleMetadata, examples);

		expect(result.passed).toBe(true);
		expect(result.warnings).toContain(
			'Rule description is very short (less than 20 characters)',
		);
	});

	it('should return warnings for hardcoded values in XPath', () => {
		const ruleMetadata = {
			ruleName: 'TestRule',
			message: 'Test message',
			description: 'A comprehensive test rule description',
			xpath: '//Method[@Name="hardcoded"]',
		};

		const examples = [
			{
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: ['public class Test {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
			},
		];

		const result = runQualityChecks(ruleMetadata, examples);

		expect(result.passed).toBe(true);
		expect(result.warnings).toContain(
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should return issues when no examples provided', () => {
		const ruleMetadata = {
			ruleName: 'TestRule',
			message: 'Test message',
			description: 'A comprehensive test rule description',
			xpath: '//Method',
		};

		const result = runQualityChecks(ruleMetadata, []);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('No examples found in rule');
	});

	it('should aggregate issues and warnings from all checks', () => {
		const ruleMetadata = {
			ruleName: null,
			message: 'Test message',
			description: 'Short',
			xpath: '//Method[@Name="hardcoded"]',
		};

		const examples = [
			{
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: [],
				valids: [],
				violationMarkers: [],
				validMarkers: [],
			},
		];

		const result = runQualityChecks(ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('Rule name is missing');
		expect(result.warnings).toContain(
			'Rule description is very short (less than 20 characters)',
		);
		expect(result.warnings).toContain(
			'XPath contains hardcoded values that should be parameterized',
		);
	});
});
