/**
 * @file
 * Unit tests for runQualityChecks function.
 */
import { describe, it, expect } from 'vitest';
import { runQualityChecks } from '../../../src/tester/qualityChecks.js';

describe('runQualityChecks', () => {
	it('should return passed when all checks pass', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = {
			description:
				'A comprehensive test rule description that is long enough',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method[@Name="test"]',
		};

		const examples = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Test violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(2);
		expect(result.warnings).toContain('Example 1 has no valid markers');
		expect(result.warnings).toContain(
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should return issues for missing rule metadata', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = {
			description: null,
			message: null,
			ruleName: null,
			xpath: null,
		};

		const examples = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('Rule name is missing');
		expect(result.issues).toContain('Rule message is missing');
		expect(result.issues).toContain('Rule XPath expression is missing');
		expect(result.issues).toContain('Example 1 contains no code');
	});

	it('should return warnings for short description', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = {
			description: 'Short',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Test',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

		expect(result.passed).toBe(true);
		expect(result.warnings).toContain(
			'Rule description is very short (less than 20 characters)',
		);
	});

	it('should return warnings for hardcoded values in XPath', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = {
			description: 'A comprehensive test rule description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method[@Name="hardcoded"]',
		};

		const examples = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Test',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

		expect(result.passed).toBe(true);
		expect(result.warnings).toContain(
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should return issues when no examples provided', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = {
			description: 'A comprehensive test rule description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = runQualityChecks(ruleFilePath, ruleMetadata, []);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('No examples found in rule');
	});

	it('should aggregate issues and warnings from all checks', () => {
		const ruleFilePath = 'test.xml';
		const ruleMetadata = {
			description: 'Short',
			message: 'Test message',
			ruleName: null,
			xpath: '//Method[@Name="hardcoded"]',
		};

		const examples = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = runQualityChecks(ruleFilePath, ruleMetadata, examples);

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
