/**
 * @file
 * Unit tests for extractLetVariables.
 */
import { describe, it, expect } from 'vitest';
import { extractLetVariables } from '../../../../src/xpath/extractors/extractLetVariables.js';

describe('extractLetVariables', () => {
	it('should return empty array for empty XPath', () => {
		expect(extractLetVariables('')).toEqual([]);
	});

	it('should return empty array when no let statement exists', () => {
		expect(extractLetVariables('//Method')).toEqual([]);
	});

	it('should return empty array when let has no return', () => {
		expect(extractLetVariables("let $x := 'a'")).toEqual([]);
	});

	it('should extract a single variable using := assignment', () => {
		const xpath = "let $x := 'a' return //Method[@Name=$x]";
		expect(extractLetVariables(xpath)).toEqual([
			{ name: '$x', value: "'a'" },
		]);
	});

	it('should ignore malformed declarations without assignment', () => {
		const xpath = `let $x return //X`;
		expect(extractLetVariables(xpath)).toEqual([]);
	});

	it('should extract a single variable using = assignment', () => {
		const xpath = 'let $n = 2 return //Method[@Count=$n]';
		expect(extractLetVariables(xpath)).toEqual([
			{ name: '$n', value: '2' },
		]);
	});

	it('should extract multiple variables across newlines and commas', () => {
		const xpath = `let $a := 'x',
$b := 42
return //Method[@A=$a and @B=$b]`;
		expect(extractLetVariables(xpath)).toEqual([
			{ name: '$a', value: "'x'" },
			{ name: '$b', value: '42' },
		]);
	});

	it('should split variables when a new $ starts without commas', () => {
		const xpath = `let $a := 1 $b := 2 return //X[@A=$a and @B=$b]`;
		expect(extractLetVariables(xpath)).toEqual([
			{ name: '$a', value: '1' },
			{ name: '$b', value: '2' },
		]);
	});

	it('should handle trailing comma without extra variable', () => {
		const xpath = `let $a := 1, return //X[@A=$a]`;
		expect(extractLetVariables(xpath)).toEqual([
			{ name: '$a', value: '1' },
		]);
	});

	it('should not split variable values on commas inside parentheses', () => {
		const xpath = `let $ops := ('+=', '-=', '*='), $x := 1 return //X[@Op=$ops]`;
		expect(extractLetVariables(xpath)).toEqual([
			{ name: '$ops', value: "('+=', '-=', '*=')" },
			{ name: '$x', value: '1' },
		]);
	});

	it('should not split variable values on commas inside quotes', () => {
		const xpath = `let $s := 'a,b,c', $n := 2 return //X[@S=$s]`;
		expect(extractLetVariables(xpath)).toEqual([
			{ name: '$s', value: "'a,b,c'" },
			{ name: '$n', value: '2' },
		]);
	});
});
