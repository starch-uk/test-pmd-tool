/**
 * @file
 * Unit tests for checkRuleMetadata function.
 */
import { describe, it, expect } from 'vitest';
import { checkRuleMetadata } from '../../../../src/tester/quality/checkRuleMetadata.js';
import type { RuleMetadata } from '../../../../src/types/index.js';

describe('checkRuleMetadata', () => {
	it('should pass when all required fields are present and valid', () => {
		const metadata: RuleMetadata = {
			description:
				'This is a detailed description of the rule that meets the minimum length requirement',
			message: 'This is a comprehensive test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it('should error when rule name is missing', () => {
		const metadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: null,
			xpath: '//Method',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('Rule name is missing');
	});

	it('should error when rule message is missing', () => {
		const metadata: RuleMetadata = {
			description: 'Test description',
			message: null,
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('Rule message is missing');
	});

	it('should error when XPath is missing', () => {
		const metadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: null,
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('Rule XPath expression is missing');
	});

	it('should warn when rule name is too short', () => {
		const metadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'A',
			xpath: '//Method',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain(
			'Rule name is very short (less than 3 characters)',
		);
	});

	it('should warn when rule message is too short', () => {
		const metadata: RuleMetadata = {
			description: 'Test description',
			message: 'Short',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain(
			'Rule message is very short (less than 10 characters)',
		);
	});

	it('should warn when rule description is too short', () => {
		const metadata: RuleMetadata = {
			description: 'Short',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain(
			'Rule description is very short (less than 20 characters)',
		);
	});

	it('should warn when description is missing', () => {
		const metadata: RuleMetadata = {
			description: null,
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain(
			'Rule description is missing (recommended)',
		);
	});

	it('should warn when XPath contains hardcoded values (numbers)', () => {
		const metadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method[position()=5]',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain(
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should warn when XPath contains hardcoded values (strings)', () => {
		const metadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method[@Name="hardcodedValue"]',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain(
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should warn when XPath contains hardcoded values (single quotes)', () => {
		const metadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "//Method[@Name='hardcodedValue']",
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain(
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should warn for hardcoded strings', () => {
		const metadata: RuleMetadata = {
			description: 'This is a sufficiently long description for the test',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method[@Name="hardcoded"]',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('hardcoded values');
	});

	it('should warn for hardcoded numbers', () => {
		const metadata: RuleMetadata = {
			description: 'This is a sufficiently long description for the test',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method[position()=5]',
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('hardcoded values');
	});

	it('should handle multiple issues and warnings', () => {
		const metadata: RuleMetadata = {
			description: 'Short', // Too short
			message: 'Hi', // Too short
			ruleName: 'A', // Too short
			xpath: '//Method[position()=5]', // Hardcoded number
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0); // No missing required fields
		expect(result.warnings).toHaveLength(4);
		expect(result.warnings).toContain(
			'Rule name is very short (less than 3 characters)',
		);
		expect(result.warnings).toContain(
			'Rule message is very short (less than 10 characters)',
		);
		expect(result.warnings).toContain(
			'Rule description is very short (less than 20 characters)',
		);
		expect(result.warnings).toContain(
			'XPath contains hardcoded values that should be parameterized',
		);
	});

	it('should handle null/undefined fields gracefully', () => {
		const metadata: RuleMetadata = {
			description: undefined,
			message: undefined,
			ruleName: undefined,
			xpath: undefined,
		};

		const result = checkRuleMetadata(metadata);

		expect(result.passed).toBe(false);
		expect(result.issues).toHaveLength(3); // ruleName, message, xpath missing
		expect(result.warnings).toHaveLength(1); // description missing
		expect(result.issues).toContain('Rule name is missing');
		expect(result.issues).toContain('Rule message is missing');
		expect(result.issues).toContain('Rule XPath expression is missing');
		expect(result.warnings).toContain(
			'Rule description is missing (recommended)',
		);
	});
});
