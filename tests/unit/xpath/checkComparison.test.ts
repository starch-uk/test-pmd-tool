/**
 * @file
 * Unit tests for checkComparisonCoverage function.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- Test object literals with "as const satisfies" require type assertions */
import { describe, it, expect } from 'vitest';
import { checkComparisonCoverage } from '../../../src/xpath/checkComparison.js';
import type { Conditional } from '../../../../../src/types/index.js';

describe('checkComparisonCoverage', () => {
	it('should return failure when expression is empty', () => {
		const conditional = {
			expression: '',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const result = checkComparisonCoverage(conditional, 'some content');

		expect(result.success).toBe(false);
		expect(result.message).toBe('No expression to check');
		expect(result.evidence).toHaveLength(0);
	});

	it('should return failure when no attributes found in expression', () => {
		const conditional = {
			expression: 'some expression without attributes',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const result = checkComparisonCoverage(conditional, 'some content');

		expect(result.success).toBe(false);
		expect(result.message).toBe('No attributes found in comparison');
		expect(result.evidence).toHaveLength(0);
	});

	it('should return failure when attributes found but no values in content', () => {
		const conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = 'public class Test {}';
		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(false);
		expect(result.message).toContain('not demonstrated');
		expect(result.evidence).toHaveLength(1);
		expect(result.evidence[0]?.count).toBe(0);
	});

	it('should return success when comparison is demonstrated with different attribute values', () => {
		const conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = `
public class Test {
    // BeginLine: 1
    private void method() {
        // EndLine: 5
    }
}`;
		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(true);
		expect(result.message).toContain('is demonstrated');
		expect(result.evidence).toHaveLength(1);
		expect(result.evidence[0]?.count).toBe(1);
	});

	it('should handle multiple attributes in comparison', () => {
		const conditional = {
			expression: '@BeginLine != @EndLine and @LineNumber > 0',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = `
// BeginLine: 1
public class Test {
    // EndLine: 10
    // LineNumber: 5
}`;
		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(true);
		expect(result.message).toContain('is demonstrated');
	});

	it('should handle attributes with different value formats', () => {
		const conditional = {
			expression: '@Name != @Type',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = `
// Name: testMethod
// Type: String
public class Test {}`;
		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(true);
		expect(result.message).toContain('is demonstrated');
	});

	it('should return failure when only one unique value found', () => {
		const conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = `
// BeginLine: 1
// EndLine: 1
public class Test {}`;
		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(false);
		expect(result.message).toContain('not demonstrated');
	});

	it('should handle case-insensitive attribute matching', () => {
		const conditional = {
			expression: '@beginline != @endline',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = `
// BeginLine: 1
// EndLine: 5
public class Test {}`;
		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(true);
		expect(result.message).toContain('is demonstrated');
	});

	it('should handle attributes with whitespace in values', () => {
		const conditional = {
			expression: '@Name != @Description',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = `
// Name: testMethod
// Description: test method description
public class Test {}`;
		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(true);
		expect(result.message).toContain('is demonstrated');
	});

	it('should extract attribute names correctly from complex expressions', () => {
		const conditional = {
			expression: '@BeginLine != @EndLine and @LineNumber = 5',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = `
// BeginLine: 1
// EndLine: 10
// LineNumber: 5
public class Test {}`;
		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(true);
	});

	it('should handle case where valueMatches is null in checkComparisonDemonstration', () => {
		const conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = 'public class Test {}';
		const result = checkComparisonCoverage(conditional, content);

		// When no matches found, attrValues remains empty, uniqueValues.size = 0
		expect(result.success).toBe(false);
		expect(result.message).toContain('not demonstrated');
	});

	it('should handle attributes with same values (not unique)', () => {
		const conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		} as const satisfies Readonly<Conditional>;
		const content = `
// BeginLine: 1
// EndLine: 1
public class Test {}`;
		const result = checkComparisonCoverage(conditional, content);

		// Same values mean uniqueValues.size = 1, which is not > MIN_UNIQUE_VALUES (1)
		// Actually MIN_UNIQUE_VALUES is 1, so size > 1 means we need at least 2 unique values
		expect(result.success).toBe(false);
	});
});
