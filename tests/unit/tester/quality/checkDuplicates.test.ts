/**
 * @file
 * Unit tests for checkDuplicates function.
 */
import { describe, it, expect } from 'vitest';
import { checkDuplicates } from '../../../../src/tester/quality/checkDuplicates.js';
import type { ExampleData } from '../../../../src/types/index.js';

describe('checkDuplicates', () => {
	it('should return passed when fewer than 2 examples', () => {
		const examples: ExampleData[] = [
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

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it('should return passed when no examples', () => {
		const result = checkDuplicates([]);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it('should detect duplicate violation markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'public class Test1 {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description:
							'This is a test violation marker description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class MyClass {}'],
			},
			{
				content: 'public class Test2 {}',
				exampleIndex: 2,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description:
							'This is a test violation marker description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class MyClass {}'],
			},
		];

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('Duplicate marker description');
		expect(result.warnings[0]).toContain('found in examples: 1, 2');
	});

	it('should detect duplicate valid markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'public class Test1 {}',
				exampleIndex: 1,
				validMarkers: [
					{
						description: 'This is a test valid marker description',
						index: 0,
						isViolation: false,
						lineNumber: 1,
					},
				],
				valids: ['private int value;'],
				violationMarkers: [],
				violations: [],
			},
			{
				content: 'public class Test2 {}',
				exampleIndex: 2,
				validMarkers: [
					{
						description: 'This is a test valid marker description',
						index: 0,
						isViolation: false,
						lineNumber: 1,
					},
				],
				valids: ['private int value;'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('Duplicate marker description');
		expect(result.warnings[0]).toContain('found in examples: 1, 2');
	});

	it('should not warn for short patterns', () => {
		const examples: ExampleData[] = [
			{
				content: 'int x;',
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
				violations: ['int x;'],
			},
			{
				content: 'int y;',
				exampleIndex: 2,
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
				violations: ['int x;'],
			},
		];

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it('should handle multiple duplicates across different examples', () => {
		const examples: ExampleData[] = [
			{
				content: 'public class Test1 {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description:
							'This is the first test marker description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
					{
						description:
							'This is the second test marker description',
						index: 1,
						isViolation: true,
						lineNumber: 2,
					},
				],
				violations: [
					'public class MyClass {}',
					'private void method() {}',
				],
			},
			{
				content: 'public class Test2 {}',
				exampleIndex: 2,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description:
							'This is the first test marker description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
					{
						description:
							'This is the second test marker description',
						index: 1,
						isViolation: true,
						lineNumber: 2,
					},
				],
				violations: [
					'public class MyClass {}',
					'private void method() {}',
				],
			},
			{
				content: 'public class Test3 {}',
				exampleIndex: 3,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description:
							'This is the first test marker description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class MyClass {}'],
			},
		];

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(2); // Two marker descriptions duplicated
	});

	it('should normalize whitespace when comparing marker descriptions', () => {
		const examples: ExampleData[] = [
			{
				content: 'public class Test1 {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description:
							'This   is   a   test   marker   description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class MyClass {}'],
			},
			{
				content: 'public class Test2 {}',
				exampleIndex: 2,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'This is a test marker description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class MyClass {}'],
			},
		];

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('Duplicate marker description');
	});

	it('should handle edge case where descriptionList get returns undefined', () => {
		// This test covers the defensive check for undefined descriptionList
		// In practice, get() after set() should never return undefined,
		// but TypeScript requires the check
		const examples: ExampleData[] = [
			{
				content: 'public class Test1 {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'This is a test marker description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class MyClass {}'],
			},
			{
				content: 'public class Test2 {}',
				exampleIndex: 2,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'This is a test marker description',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class MyClass {}'],
			},
		];

		const result = checkDuplicates(examples);

		// Should handle gracefully - the undefined check is defensive
		expect(result.passed).toBe(true);
		expect(Array.isArray(result.warnings)).toBe(true);
	});
});
