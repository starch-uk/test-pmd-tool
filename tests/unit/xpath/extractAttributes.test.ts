import { describe, it, expect } from 'vitest';
import { extractAttributes } from '../../../src/xpath/extractors/extractAttributes.js';

describe('extractAttributes', () => {
	it('should extract @AttributeName patterns', () => {
		const xpath = '//Method[@BeginLine and @EndLine]';
		const result = extractAttributes(xpath);

		expect(result).toEqual(['BeginLine', 'EndLine']);
	});

	it('should exclude @Op from results', () => {
		const xpath = "//BinaryExpression[@Op='+' and @Left='variable']";
		const result = extractAttributes(xpath);

		expect(result).toEqual(['Left']);
		expect(result).not.toContain('Op');
	});

	it('should handle different attribute formats', () => {
		const xpath = "//Method[@Name='test' and @Visibility='public']";
		const result = extractAttributes(xpath);

		expect(result).toEqual(['Name', 'Visibility']);
	});

	it('should deduplicate attributes', () => {
		const xpath = "//Method[@Name='test']//Field[@Name='field']";
		const result = extractAttributes(xpath);

		expect(result).toEqual(['Name']);
	});

	it('should handle attributes in complex predicates', () => {
		const xpath = '//Class[//Method[@BeginLine > @EndLine]]//Field[@Type]';
		const result = extractAttributes(xpath);

		expect(result).toEqual(['BeginLine', 'EndLine', 'Type']);
	});

	it('should handle empty xpath', () => {
		const result = extractAttributes('');
		expect(result).toHaveLength(0);
	});

	it('should handle xpath without attributes', () => {
		const xpath = '//Method//Field';
		const result = extractAttributes(xpath);

		expect(result).toHaveLength(0);
	});

	it('should handle malformed attribute patterns', () => {
		const xpath = '//Method[@ and @Name]';
		const result = extractAttributes(xpath);

		expect(result).toEqual(['Name']);
	});

	it('should extract various standard attributes', () => {
		const xpath =
			'//Method[@Image and @BeginLine and @EndLine and @Column]';
		const result = extractAttributes(xpath);

		expect(result).toEqual(['Image', 'BeginLine', 'EndLine', 'Column']);
	});
});
