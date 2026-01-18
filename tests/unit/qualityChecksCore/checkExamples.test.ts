/**
 * @file
 * Unit tests for checkExamples function.
 */
import { describe, it, expect } from 'vitest';
import { checkExamples } from '../../../src/tester/checkExamples.js';
import {
	expectFailed,
	expectPassedWithNoIssuesOnly,
	expectIssue,
	expectWarning,
	expectWarningCount,
} from '../helpers/assertions.js';
import {
	createExampleData,
	createViolationMarker,
	createValidMarker,
} from '../helpers/fixtures.js';

describe('checkExamples', () => {
	it('should return error when no examples provided', () => {
		const result = checkExamples([]);

		expectFailed(result);
		expectIssue(result, 'No examples found in rule');
		expect(result.warnings).toHaveLength(0);
	});

	it('should warn when example has violations but no violation markers', () => {
		const examples = [
			createExampleData({
				content: 'public class Test {}',
				violations: ['public class Test {}'],
			}),
		];

		const result = checkExamples(examples);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(
			result,
			'Example 1 has violations but no violation markers',
		);
	});

	it('should warn when example has valid code but no valid markers', () => {
		const examples = [
			createExampleData({
				content: 'private int value;',
				valids: ['private int value;'],
			}),
		];

		const result = checkExamples(examples);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(result, 'Example 1 has valid code but no valid markers');
	});

	it('should warn when example has code but no markers', () => {
		const examples = [
			createExampleData({
				content: 'public class Test {}',
				violations: ['public class Test {}'],
			}),
		];

		const result = checkExamples(examples);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(result, 'Example 1 has code but no markers');
	});

	it('should warn when example has markers but no code', () => {
		const examples = [
			createExampleData({
				content: '// Violation: Test',
				violationMarkers: [
					createViolationMarker({ description: 'Test' }),
				],
			}),
		];

		const result = checkExamples(examples);

		expectFailed(result);
		expectIssue(result, 'Example 1 contains no code');
	});

	it('should pass when example has proper violation markers', () => {
		const examples = [
			createExampleData({
				content: 'public class Test {} // ❌ Violation',
				violationMarkers: [
					createViolationMarker({ description: 'Violation' }),
				],
				violations: ['public class Test {}'],
			}),
		];

		const result = checkExamples(examples);

		expectPassedWithNoIssuesOnly(result);
		expectWarningCount(result, 1);
		expect(result.warnings[0]).toContain('has no valid markers');
	});

	it('should pass when example has proper valid markers', () => {
		const examples = [
			createExampleData({
				content: 'private int value; // ✅ Valid',
				validMarkers: [createValidMarker({ description: 'Valid' })],
				valids: ['private int value;'],
			}),
		];

		const result = checkExamples(examples);

		expectPassedWithNoIssuesOnly(result);
		expectWarningCount(result, 1);
		expect(result.warnings[0]).toContain('has no violation markers');
	});

	it('should pass when example has mixed violation and valid markers', () => {
		const examples = [
			createExampleData({
				content: 'mixed example content',
				validMarkers: [
					createValidMarker({ description: 'Valid', lineNumber: 2 }),
				],
				valids: ['private int value;'],
				violationMarkers: [
					createViolationMarker({ description: 'Violation' }),
				],
				violations: ['public class Test {}'],
			}),
		];

		const result = checkExamples(examples);

		expectPassedWithNoIssuesOnly(result);
		expect(result.warnings).toHaveLength(0);
	});

	it('should error when example contains no code', () => {
		const examples = [
			createExampleData({
				content: '// Just a comment',
			}),
		];

		const result = checkExamples(examples);

		expectFailed(result);
		expectIssue(result, 'Example 1 contains no code');
	});

	it('should warn when example has no violation markers', () => {
		const examples = [
			createExampleData({
				content: 'public class Test {}',
				violations: ['public class Test {}'],
			}),
		];

		const result = checkExamples(examples);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(result, 'Example 1 has no violation markers');
	});

	it('should warn when example has no valid markers', () => {
		const examples = [
			createExampleData({
				content: 'private int value;',
				valids: ['private int value;'],
			}),
		];

		const result = checkExamples(examples);

		expectPassedWithNoIssuesOnly(result);
		expectWarning(result, 'Example 1 has no valid markers');
	});

	it('should handle multiple examples with different issues', () => {
		const examples = [
			createExampleData({
				content: 'public class Test {}',
				exampleIndex: 1,
				violationMarkers: [
					createViolationMarker({ description: 'Violation' }),
				],
				violations: ['public class Test {}'],
			}),
			createExampleData({
				content: 'private int value;',
				exampleIndex: 2,
				valids: ['private int value;'],
			}),
			createExampleData({
				content: '// Just comment',
				exampleIndex: 3,
			}),
		];

		const result = checkExamples(examples);

		expectFailed(result);
		expectIssue(result, 'Example 3 contains no code');
		expectWarning(result, 'Example 2 has valid code but no valid markers');
		expectWarning(result, 'Example 2 has code but no markers');
		expectWarning(result, 'Example 3 has no valid markers');
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
