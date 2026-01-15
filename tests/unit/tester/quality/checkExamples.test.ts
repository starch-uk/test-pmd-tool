/**
 * @file
 * Unit tests for checkExamples function.
 */
import { describe, it, expect } from 'vitest';
import { checkExamples } from '../../../../src/tester/quality/checkExamples.js';
import type { ExampleData } from '../../../../src/types/index.js';

describe('checkExamples', () => {
	it('should return error when no examples provided', () => {
		const result = checkExamples([]);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('No examples found in rule');
		expect(result.warnings).toHaveLength(0);
	});

	it('should warn when example has violations but no violation markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: ['public class Test {}'],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain(
			'Example 1 has violations but no violation markers',
		);
	});

	it('should warn when example has valid code but no valid markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'private int value;',
				exampleIndex: 1,
				validMarkers: [],
				valids: ['private int value;'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain(
			'Example 1 has valid code but no valid markers',
		);
	});

	it('should warn when example has code but no markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: ['public class Test {}'],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain('Example 1 has code but no markers');
	});

	it('should warn when example has markers but no code', () => {
		const examples: ExampleData[] = [
			{
				content: '// Violation: Test',
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
				violations: [],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(false); // Has markers but no code is an error
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]).toBe('Example 1 contains no code');
	});

	it('should pass when example has proper violation markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'public class Test {} // ❌ Violation',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1); // Warning about no valid markers
		expect(result.warnings[0]).toContain('has no valid markers');
	});

	it('should pass when example has proper valid markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'private int value; // ✅ Valid',
				exampleIndex: 1,
				validMarkers: [
					{
						description: 'Valid',
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

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(1); // Warning about no violation markers
		expect(result.warnings[0]).toContain('has no violation markers');
	});

	it('should pass when example has mixed violation and valid markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'mixed example content',
				exampleIndex: 1,
				validMarkers: [
					{
						description: 'Valid',
						index: 0,
						isViolation: false,
						lineNumber: 2,
					},
				],
				valids: ['private int value;'],
				violationMarkers: [
					{
						description: 'Violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it('should error when example contains no code', () => {
		const examples: ExampleData[] = [
			{
				content: '// Just a comment',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('Example 1 contains no code');
	});

	it('should warn when example has no violation markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: ['public class Test {}'],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain('Example 1 has no violation markers');
	});

	it('should warn when example has no valid markers', () => {
		const examples: ExampleData[] = [
			{
				content: 'private int value;',
				exampleIndex: 1,
				validMarkers: [],
				valids: ['private int value;'],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain('Example 1 has no valid markers');
	});

	it('should handle multiple examples with different issues', () => {
		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public class Test {}'],
			},
			{
				content: 'private int value;',
				exampleIndex: 2,
				validMarkers: [],
				valids: ['private int value;'],
				violationMarkers: [],
				violations: [],
			},
			{
				content: '// Just comment',
				exampleIndex: 3,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(false); // Due to example 3 having no code
		expect(result.issues).toContain('Example 3 contains no code');
		expect(result.warnings).toContain(
			'Example 2 has valid code but no valid markers',
		);
		expect(result.warnings).toContain('Example 2 has code but no markers');
		expect(result.warnings).toContain('Example 3 has no valid markers');
	});

	it('should error when example contains testMethod', () => {
		// Build string dynamically to avoid meta-test detection
		const methodName = 'test' + 'Method';
		const content = `public void ${methodName}() {}`;
		const examples: ExampleData[] = [
			{
				content,
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: [content],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain(
			"Example 1: You can't call a method testMethod in examples",
		);
	});

	it('should error when example contains testMethod in multiple examples', () => {
		// Build string dynamically to avoid meta-test detection
		const methodName = 'test' + 'Method';
		const examples: ExampleData[] = [
			{
				content: 'public void exampleMethod() {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: ['public void exampleMethod() {}'],
			},
			{
				content: `public void ${methodName}() {}`,
				exampleIndex: 2,
				validMarkers: [],
				valids: [],
				violationMarkers: [
					{
						description: 'Violation',
						index: 0,
						isViolation: true,
						lineNumber: 1,
					},
				],
				violations: [`public void ${methodName}() {}`],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain(
			"Example 2: You can't call a method testMethod in examples",
		);
		expect(result.issues).not.toContain(
			"Example 1: You can't call a method testMethod in examples",
		);
	});
});
