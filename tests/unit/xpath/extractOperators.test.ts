/**
 * @file
 * Unit tests for extractOperators function.
 */
import { describe, it, expect } from 'vitest';
import { extractOperators } from '../../../src/xpath/extractOperators.js';

describe('extractOperators', () => {
	it('should extract @Op attribute values', () => {
		const xpath =
			"//BinaryExpression[@Op='=='] | //BinaryExpression[@Op='!=']";
		const result = extractOperators(xpath);

		expect(result).toEqual(['==', '!=']);
	});

	it('should handle single quotes and double quotes', () => {
		const xpath =
			'//BinaryExpression[@Op=\'+\']//BinaryExpression[@Op="-"]';
		const result = extractOperators(xpath);

		expect(result).toEqual(['+', '-']);
	});

	it('should deduplicate operators', () => {
		const xpath =
			"//BinaryExpression[@Op='==']//BinaryExpression[@Op='==']";
		const result = extractOperators(xpath);

		expect(result).toEqual(['==']);
	});

	it('should extract multiple different operators', () => {
		const xpath = `//BinaryExpression[@Op='>'] |
//BinaryExpression[@Op='<'] |
//BinaryExpression[@Op='>='] |
//BinaryExpression[@Op='<=']`;
		const result = extractOperators(xpath);

		expect(result).toEqual(['>', '<', '>=', '<=']);
	});

	it('should handle complex operators', () => {
		const xpath =
			"//BinaryExpression[@Op='&&'] | //BinaryExpression[@Op='||']";
		const result = extractOperators(xpath);

		expect(result).toEqual(['&&', '||']);
	});

	it('should ignore non-@Op attributes', () => {
		const xpath =
			"//Method[@Name='test' and @Op='+']//Field[@Type='String']";
		const result = extractOperators(xpath);

		expect(result).toEqual(['+']);
	});

	it('should handle empty xpath', () => {
		const result = extractOperators('');
		expect(result).toHaveLength(0);
	});

	it('should handle xpath without operators', () => {
		const xpath = "//Method[@Name='test']//Field";
		const result = extractOperators(xpath);

		expect(result).toHaveLength(0);
	});

	it('should handle malformed @Op attributes', () => {
		const xpath = '//BinaryExpression[@Op=] | //BinaryExpression[@Op]';
		const result = extractOperators(xpath);

		expect(result).toHaveLength(0);
	});

	it('should handle @Op with special characters', () => {
		const xpath =
			"//BinaryExpression[@Op='->'] | //BinaryExpression[@Op='instanceof']";
		const result = extractOperators(xpath);

		expect(result).toEqual(['->', 'instanceof']);
	});

	it('should handle @Op in different contexts', () => {
		const xpath = `//BinaryExpression[@Op='+' and @Left='variable'] |
//AssignmentExpression[@Op='=']`;
		const result = extractOperators(xpath);

		expect(result).toEqual(['+', '=']);
	});

	it('should skip matches with undefined operator', () => {
		// Test with xpath that might produce matches without capture groups
		// This ensures the undefined check works correctly
		const xpath = '//BinaryExpression[@Op=]';
		const result = extractOperators(xpath);

		// Should handle gracefully without throwing
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(0);
	});
});
