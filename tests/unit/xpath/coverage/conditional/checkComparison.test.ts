/**
 * @file
 * Unit tests for comparison conditional coverage checking.
 */
import { describe, it, expect } from 'vitest';
import { checkComparisonCoverage } from '../../../../../src/xpath/coverage/conditional/checkComparison.js';
import type { Conditional } from '../../../../../src/types/index.js';

describe('checkComparisonCoverage', () => {
	it('should return false for empty expression', () => {
		const conditional: Conditional = {
			expression: '',
			position: 0,
			type: 'comparison',
		};
		const content = 'some content';

		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(false);
		expect(result.message).toBe('No expression to check');
	});

	it('should return false when no attributes found in expression', () => {
		const conditional: Conditional = {
			expression: 'Value = 5',
			position: 0,
			type: 'comparison',
		};
		const content = 'some content';

		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(false);
		expect(result.message).toBe('No attributes found in comparison');
	});

	it('should detect comparison when attributes have different values in content', () => {
		const conditional: Conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		};
		const content = '// BeginLine: 5\n// EndLine: 10';

		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(true);
		expect(result.message).toContain('demonstrated');
	});

	it('should return false when attributes do not have different values', () => {
		const conditional: Conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		};
		const content = 'some content without attribute values';

		const result = checkComparisonCoverage(conditional, content);

		expect(result.success).toBe(false);
		expect(result.message).toContain('not demonstrated');
	});

	it('should handle single attribute in comparison', () => {
		const conditional: Conditional = {
			expression: '@Value = 5',
			position: 0,
			type: 'comparison',
		};
		const content = '// Value: 5';

		const result = checkComparisonCoverage(conditional, content);

		// Single attribute won't have "different values", so should return false
		expect(result.success).toBe(false);
	});

	it('should handle multiple attributes with same values', () => {
		const conditional: Conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		};
		const content = '// BeginLine: 5\n// EndLine: 5';

		const result = checkComparisonCoverage(conditional, content);

		// Same values means no comparison demonstrated
		expect(result.success).toBe(false);
	});

	it('should handle attribute value extraction with trim', () => {
		const conditional: Conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		};
		const content = '// BeginLine:  10  \n// EndLine: 20';

		const result = checkComparisonCoverage(conditional, content);

		// Should handle whitespace in values
		expect(result.success).toBe(true);
	});

	it('should handle attribute value extraction edge cases', () => {
		const conditional: Conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		};
		const content = '// BeginLine: 5\n// EndLine: 10\n// BeginLine: 15';

		const result = checkComparisonCoverage(conditional, content);

		// Multiple values for same attribute should be handled
		expect(result.success).toBe(true);
	});

	it('should handle multiple matches for same attribute', () => {
		const conditional: Conditional = {
			expression: '@BeginLine != @EndLine',
			position: 0,
			type: 'comparison',
		};
		// Multiple matches for BeginLine
		const content = '// BeginLine: 5\n// BeginLine: 10\n// EndLine: 20';

		const result = checkComparisonCoverage(conditional, content);

		// Should extract all values and detect comparison
		expect(result.success).toBe(true);
	});
});
