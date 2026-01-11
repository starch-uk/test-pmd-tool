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
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: ['public class Test {}'],
				valids: [],
				violationMarkers: [],
				validMarkers: [],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain('Example 1 has violations but no violation markers');
	});

	it('should warn when example has valid code but no valid markers', () => {
		const examples: ExampleData[] = [
			{
				exampleIndex: 1,
				content: 'private int value;',
				violations: [],
				valids: ['private int value;'],
				violationMarkers: [],
				validMarkers: [],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.warnings).toContain('Example 1 has valid code but no valid markers');
	});

	it('should warn when example has code but no markers', () => {
		const examples: ExampleData[] = [
			{
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: ['public class Test {}'],
				valids: [],
				violationMarkers: [],
				validMarkers: [],
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
				exampleIndex: 1,
				content: '// Violation: Test',
				violations: [],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Test', isViolation: true, index: 0 }],
				validMarkers: [],
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
				exampleIndex: 1,
				content: 'public class Test {} // ❌ Violation',
				violations: ['public class Test {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Violation', isViolation: true, index: 0 }],
				validMarkers: [],
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
				exampleIndex: 1,
				content: 'private int value; // ✅ Valid',
				violations: [],
				valids: ['private int value;'],
				violationMarkers: [],
				validMarkers: [{ lineNumber: 1, description: 'Valid', isViolation: false, index: 0 }],
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
				exampleIndex: 1,
				content: 'mixed example content',
				violations: ['public class Test {}'],
				valids: ['private int value;'],
				violationMarkers: [{ lineNumber: 1, description: 'Violation', isViolation: true, index: 0 }],
				validMarkers: [{ lineNumber: 2, description: 'Valid', isViolation: false, index: 0 }],
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
				exampleIndex: 1,
				content: '// Just a comment',
				violations: [],
				valids: [],
				violationMarkers: [],
				validMarkers: [],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(false);
		expect(result.issues).toContain('Example 1 contains no code');
	});

	it('should warn when example has no violation markers', () => {
		const examples: ExampleData[] = [
			{
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: ['public class Test {}'],
				valids: [],
				violationMarkers: [],
				validMarkers: [],
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
				exampleIndex: 1,
				content: 'private int value;',
				violations: [],
				valids: ['private int value;'],
				violationMarkers: [],
				validMarkers: [],
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
				exampleIndex: 1,
				content: 'public class Test {}',
				violations: ['public class Test {}'],
				valids: [],
				violationMarkers: [{ lineNumber: 1, description: 'Violation', isViolation: true, index: 0 }],
				validMarkers: [],
			},
			{
				exampleIndex: 2,
				content: 'private int value;',
				violations: [],
				valids: ['private int value;'],
				violationMarkers: [],
				validMarkers: [],
			},
			{
				exampleIndex: 3,
				content: '// Just comment',
				violations: [],
				valids: [],
				violationMarkers: [],
				validMarkers: [],
			},
		];

		const result = checkExamples(examples);

		expect(result.passed).toBe(false); // Due to example 3 having no code
		expect(result.issues).toContain('Example 3 contains no code');
		expect(result.warnings).toContain('Example 2 has valid code but no valid markers');
		expect(result.warnings).toContain('Example 2 has code but no markers');
		expect(result.warnings).toContain('Example 3 has no valid markers');
	});
});