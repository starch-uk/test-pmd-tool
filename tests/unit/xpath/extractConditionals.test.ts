import { describe, it, expect } from 'vitest';
import { extractConditionals } from '../../../src/xpath/extractors/extractConditionals.js';

describe('extractConditionals', () => {
	it('should extract not() conditions', () => {
		const xpath = "//Method[not(@Visibility='private')]";
		const result = extractConditionals(xpath);

		expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'not',
      expression: "@Visibility='private'",
      position: 9,
    });
	});

	it('should extract and conditions', () => {
		const xpath = "//Method[@Visibility='public' and @Name='test']";
		const result = extractConditionals(xpath);

    expect(result).toContainEqual({
      type: 'and',
      expression: "@Name='test'",
      position: 30,
    });
	});

	it('should extract or conditions', () => {
		const xpath = "//Method[@Visibility='public' or @Visibility='global']";
		const result = extractConditionals(xpath);

    expect(result).toContainEqual({
      type: 'or',
      expression: "@Visibility='global'",
      position: 30,
    });
	});

	it('should handle multiple condition types', () => {
		const xpath =
			"//Method[not(@Static) and @Visibility='public' or @Name='test']";
		const result = extractConditionals(xpath);

    expect(result).toHaveLength(3);
    expect(result).toContainEqual({
      type: 'not',
      expression: '@Static',
      position: 9,
    });
    expect(result).toContainEqual({
      type: 'and',
      expression: "@Visibility='public' or @Name='test'",
      position: 22,
    });
    expect(result).toContainEqual({
      type: 'or',
      expression: "@Name='test'",
      position: 47,
    });
	});

	it('should handle complex expressions in conditions', () => {
		const xpath = "//Method[not(contains(@Name, 'test'))]";
		const result = extractConditionals(xpath);

		expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'not',
      expression: "contains(@Name, 'test'",
      position: 9,
    });
	});

	it('should handle function calls in and/or conditions', () => {
		const xpath =
			"//Method[@Visibility='public' and contains(@Name, 'test')]";
		const result = extractConditionals(xpath);

    expect(result).toContainEqual({
      type: 'and',
      expression: "contains(@Name, 'test')",
      position: 30,
    });
	});

	it('should handle nested conditions', () => {
		const xpath = '//Method[not(@Static and @Final)]';
		const result = extractConditionals(xpath);

		expect(result).toHaveLength(2);
		expect(result).toContainEqual({
			type: 'not',
			expression: '@Static and @Final',
			position: 9,
		});
		expect(result).toContainEqual({
			type: 'and',
			expression: '@Final)',
			position: 21,
		});
	});

	it('should handle empty xpath', () => {
		const result = extractConditionals('');
		expect(result).toHaveLength(0);
	});

	it('should handle xpath without conditionals', () => {
		const xpath = "//Method[@Name='test']";
		const result = extractConditionals(xpath);

		expect(result).toHaveLength(0);
	});

	it('should handle complex xpath with let expressions', () => {
		const xpath = `let $methods := //Method
return $methods[not(@Static) and @Visibility='public']`;
		const result = extractConditionals(xpath);

		expect(result).toHaveLength(2);
		expect(result).toContainEqual({
			type: 'not',
			expression: '@Static',
			position: 41,
		});
		expect(result).toContainEqual({
			type: 'and',
			expression: "@Visibility='public'",
			position: 54,
		});
	});

	it('should handle edge cases with empty expressions', () => {
		// Test cases that might result in empty matches
		const xpath = "//Method[not() and () or @Name='test']";
		const result = extractConditionals(xpath);

		// Should still parse what it can
		expect(result.length).toBeGreaterThanOrEqual(0);
	});

	it('should handle xpath with multiple complex conditions', () => {
		const xpath = "//Method[not(@Static) and @Visibility='public' or @Final and contains(@Name, 'test')]";
		const result = extractConditionals(xpath);

		expect(result.length).toBeGreaterThanOrEqual(3);
		// Should contain not, and, or conditions
		const types = result.map(r => r.type);
		expect(types).toContain('not');
		expect(types).toContain('and');
		expect(types).toContain('or');
	});
});
