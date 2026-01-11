import { describe, it, expect } from 'vitest';
import { checkDuplicates } from '../../../../src/tester/quality/checkDuplicates.js';
import type { ExampleData } from '../../../../src/types/index.js';

describe('checkDuplicates', () => {
	it('should return passed when fewer than 2 examples', () => {
		const examples: ExampleData[] = [
			{
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: ['public class Test {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
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

	it('should detect duplicate violation patterns', () => {
		const examples: ExampleData[] = [
			{
				exampleIndex: 1,
				content: 'public class Test1 {}',
				violations: ['public class MyClass {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
			},
			{
				exampleIndex: 2,
				content: 'public class Test2 {}',
				violations: ['public class MyClass {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
			},
		];

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('Duplicate violation pattern');
		expect(result.warnings[0]).toContain('found in examples: 1, 2');
	});

	it('should detect duplicate valid patterns', () => {
		const examples: ExampleData[] = [
			{
				exampleIndex: 1,
				content: 'public class Test1 {}',
				violations: [],
				valids: ['private int value;'],
				violationMarkers: [],
				validMarkers: [{ lineNumber: 1, description: 'Valid', isViolation: false, index: 0 }],
			},
			{
				exampleIndex: 2,
				content: 'public class Test2 {}',
				violations: [],
				valids: ['private int value;'],
				violationMarkers: [],
				validMarkers: [{ lineNumber: 1, description: 'Valid', isViolation: false, index: 0 }],
			},
		];

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('Duplicate valid pattern');
		expect(result.warnings[0]).toContain('found in examples: 1, 2');
	});

	it('should not warn for short patterns', () => {
		const examples: ExampleData[] = [
			{
				exampleIndex: 1,
				content: 'int x;',
				violations: ['int x;'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
			},
			{
				exampleIndex: 2,
				content: 'int y;',
				violations: ['int x;'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
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
				exampleIndex: 1,
				content: 'public class Test1 {}',
				violations: ['public class MyClass {}', 'private void method() {}'],
				valids: [],
				violationMarkers: [
					{ lineNumber: 1, description: 'Test1', isViolation: true, index: 0 },
					{ lineNumber: 2, description: 'Test2', isViolation: true, index: 1 },
				],
				validMarkers: [],
			},
			{
				exampleIndex: 2,
				content: 'public class Test2 {}',
				violations: ['public class MyClass {}', 'private void method() {}'],
				valids: [],
				violationMarkers: [
					{ lineNumber: 1, description: 'Test1', isViolation: true, index: 0 },
					{ lineNumber: 2, description: 'Test2', isViolation: true, index: 1 },
				],
				validMarkers: [],
			},
			{
				exampleIndex: 3,
				content: 'public class Test3 {}',
				violations: ['public class MyClass {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test1', isViolation: true, index: 0 }],
				validMarkers: [],
			},
		];

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(2); // Two patterns duplicated
	});

	it('should normalize whitespace when comparing patterns', () => {
		const examples: ExampleData[] = [
			{
				exampleIndex: 1,
				content: 'public class Test1 {}',
				violations: ['public    class   MyClass   {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
			},
			{
				exampleIndex: 2,
				content: 'public class Test2 {}',
				violations: ['public class MyClass {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
			},
		];

		const result = checkDuplicates(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('Duplicate violation pattern');
	});
});