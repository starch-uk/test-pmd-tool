/**
 * @file
 * Unit tests for extractHardcodedValues.
 */
import { describe, it, expect } from 'vitest';
import { extractHardcodedValues } from '../../src/xpath/extractHardcodedValues.js';

describe('extractHardcodedValues', () => {
	it('should return empty array for empty XPath', () => {
		expect(extractHardcodedValues('')).toEqual([]);
	});

	it('should extract strings and numbers outside let', () => {
		const xpath = `//Method[@Name="hardcoded" and @Count=42 and @Other='x']`;
		expect(extractHardcodedValues(xpath)).toEqual([
			{
				position: xpath.indexOf('"hardcoded"'),
				type: 'string',
				value: '"hardcoded"',
			},
			{ position: xpath.indexOf("'x'"), type: 'string', value: "'x'" },
			{ position: xpath.indexOf('42'), type: 'number', value: '42' },
		]);
	});

	it('should skip empty strings', () => {
		const xpath = `//X[@A='' and @B=\"\"]`;
		expect(extractHardcodedValues(xpath)).toEqual([]);
	});

	it('should exclude strings and numbers inside let declarations', () => {
		const xpath = `let $name := "hardcoded", $n := 42 return //Method[@Name=$name and @Count=$n]`;
		expect(extractHardcodedValues(xpath)).toEqual([]);
	});

	it('should detect let range using return keyword', () => {
		const xpath = `let $x := "a" return //X[@A=$x]`;
		expect(extractHardcodedValues(xpath)).toEqual([]);
	});

	it('should ignore quoted values inside parenthesized let expressions', () => {
		const xpath = `let $ops := ("a", "b") return //X[@Op=$ops]`;
		expect(extractHardcodedValues(xpath)).toEqual([]);
	});

	it('should still flag values after return even when let exists', () => {
		const xpath = `let $x := 2 return //X[@A="hardcoded" and @B=42]`;
		const values = extractHardcodedValues(xpath);
		const extracted: string[] = [];
		for (const value of values) {
			extracted.push(value.value);
		}
		expect(extracted).toEqual(['"hardcoded"', '42']);
	});

	it('should ignore 0 and 1 and include other numbers', () => {
		const xpath = `//X[@A=0 and @B=1 and @C=2 and @D=09]`;
		const values = extractHardcodedValues(xpath);
		const extracted: string[] = [];
		for (const value of values) {
			extracted.push(value.value);
		}
		expect(extracted).toEqual(['2', '09']);
	});

	it('should handle let without return by treating everything as outside let', () => {
		const xpath = `let $x := "a" //X[@A="b" and @N=2]`;
		const values = extractHardcodedValues(xpath);
		const extracted: string[] = [];
		for (const value of values) {
			extracted.push(value.value);
		}
		expect(extracted).toEqual(['"a"', '"b"', '2']);
	});
});
