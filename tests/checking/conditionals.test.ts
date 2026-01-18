/**
 * @file
 * Unit tests for conditional coverage strategies.
 */

import { describe, it, expect, vi } from 'vitest';
import {
	checkConditionPart,
	conditionalCheckers,
} from '../../src/xpath/checkConditionalStrategies.js';
import type { Conditional } from '../../src/types/index.js';

describe('conditionalCheckers', () => {
	describe('comparison', () => {
		it('should use checkComparisonCoverage for comparison type', () => {
			const conditional = {
				expression: '@BeginLine != @EndLine',
				position: 0,
				type: 'comparison',
			} as const satisfies Readonly<Conditional>;
			const content = `
// BeginLine: 1
// EndLine: 5
public class Test {}`;

			const checker = conditionalCheckers.comparison;
			expect(checker).toBeDefined();

			const result = checker(conditional, content);
			expect(result.success).toBe(true);
		});
	});

	describe('and_operator', () => {
		it('should return failure when expression is empty', () => {
			const conditional = {
				expression: '',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, 'some content');

			expect(result.success).toBe(false);
			expect(result.message).toBe('No expression to check');
		});

		it('should detect final keyword in AND condition', () => {
			const conditional = {
				expression: '@Final = true()',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'private final Integer value = 5;';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			expect(result.success).toBe(true);
			expect(result.message).toContain('is covered');
		});

		it('should detect static keyword in AND condition', () => {
			const conditional = {
				expression: '@Static = true()',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'public static void method() {}';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			expect(result.success).toBe(true);
			expect(result.message).toContain('is covered');
		});

		it('should return failure when final keyword is missing', () => {
			const conditional = {
				expression: '@Final = true()',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'private Integer value = 5;';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toContain("missing 'final' keyword");
		});

		it('should handle AND condition with @Final pattern and other condition', () => {
			const conditional = {
				expression: '@Final = true() and @Name = $var',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'private final Integer value = 5;';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// First part matches @Final pattern and returns early
			// But since expression contains "and", it gets split and checked per part
			// First part "@Final = true()" matches @Final pattern
			// Second part "@Name = $var" doesn't match @Final or @Static, goes to split path
			expect(result.success).toBe(true);
		});

		it('should handle AND condition with @Static pattern and other condition', () => {
			const conditional = {
				expression: '@Static = true() and @Name = $var',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'public static void method() {}';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// First part matches @Static pattern
			// Second part doesn't match @Final or @Static, goes to split path
			expect(result.success).toBe(true);
		});

		it('should split and check multiple AND conditions', () => {
			const conditional = {
				expression:
					'@FullMethodName = $var and .//MethodCallExpression',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'TestClass.method();';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			expect(result.success).toBe(true);
			expect(result.message).toContain('all');
		});

		it('should handle attribute pattern where regex exec returns null', () => {
			// Test to cover line 230: when attrMatch is null
			const part = '@Test = $var';
			const content = 'some content';

			// Mock RegExp.prototype.exec to return null for the attribute regex
			// eslint-disable-next-line @typescript-eslint/unbound-method -- Testing with bound method mock
			const originalExec = RegExp.prototype.exec;
			let callCount = 0;
			RegExp.prototype.exec = vi.fn(function (
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- this parameter cannot be made readonly
				this: RegExp,
				str: Readonly<string>,
			) {
				callCount++;
				// Return null for the attrRegex call (second exec call)
				if (callCount === 2 && this.source === '@(\\w+)') {
					return null;
				}
				return originalExec.call(this, str);
			});

			try {
				const result = checkConditionPart(part, content);
				// Should handle gracefully when attrMatch is null
				expect(result).toBe(false);
			} finally {
				RegExp.prototype.exec = originalExec;
			}
		});

		it('should handle attribute pattern where capture group is undefined', () => {
			// Test to cover line 234: when attrName is undefined
			const part = '@Test = $var';
			const content = 'some content';

			// Mock RegExp.prototype.exec to return array without capture group (index 1)
			// eslint-disable-next-line @typescript-eslint/unbound-method -- Testing with bound method mock
			const originalExec = RegExp.prototype.exec;
			let callCount = 0;
			RegExp.prototype.exec = vi.fn(function (
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- this parameter cannot be made readonly
				this: RegExp,
				str: Readonly<string>,
			) {
				callCount++;
				// Return array without index 1 for attrRegex (second exec call)
				if (callCount === 2 && this.source === '@(\\w+)') {
					// Create array that matches but doesn't have index 1
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Test mock requires type assertion
					const mockArray: RegExpExecArray = [
						'@Test',
					] as RegExpExecArray;
					// Remove index 1 to make it undefined
					delete (mockArray as Record<number, string>)[1];
					return mockArray;
				}
				return originalExec.call(this, str);
			});

			try {
				const result = checkConditionPart(part, content);
				// Should handle gracefully when attrName is undefined
				expect(result).toBe(false);
			} finally {
				RegExp.prototype.exec = originalExec;
			}
		});

		it('should handle node type pattern where regex exec returns null', () => {
			// Test to cover line 267: when nodeTypeMatch is null
			const conditional = {
				expression: './/TestNode and @Name = $var',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'some content';
			const checker = conditionalCheckers.and_operator;

			// Mock RegExp.prototype.exec to return null for node type regex
			// eslint-disable-next-line @typescript-eslint/unbound-method -- Testing with bound method mock
			const originalExec = RegExp.prototype.exec;
			RegExp.prototype.exec = vi.fn(function (
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- this parameter cannot be made readonly
				this: RegExp,
				str: Readonly<string>,
			) {
				// Return null for nodeTypeRegex
				if (this.source === '\\.?\\/\\/([A-Z][a-zA-Z]*)') {
					return null;
				}
				return originalExec.call(this, str);
			});

			try {
				const result = checker(conditional, content);
				// Should handle gracefully when nodeTypeMatch is null
				expect(result.success).toBe(false);
			} finally {
				RegExp.prototype.exec = originalExec;
			}
		});

		it('should handle node type pattern where capture group is undefined', () => {
			// Test to cover line 267: when nodeType is undefined
			const conditional = {
				expression: './/TestNode and @Name = $var',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'some content';
			const checker = conditionalCheckers.and_operator;

			// Mock RegExp.prototype.exec to return array without capture group (index 1)
			// eslint-disable-next-line @typescript-eslint/unbound-method -- Testing with bound method mock
			const originalExec = RegExp.prototype.exec;
			RegExp.prototype.exec = vi.fn(function (
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- this parameter cannot be made readonly
				this: RegExp,
				str: Readonly<string>,
			) {
				// Return array without index 1 for nodeTypeRegex
				if (this.source === '\\.?\\/\\/([A-Z][a-zA-Z]*)') {
					// Create array-like object that matches but doesn't have index 1
					const mockArray: RegExpExecArray = Object.assign(
						['.//TestNode'],
						{
							index: 0,
							input: str,
							groups: undefined,
						},
					);
					// Ensure index 1 is explicitly undefined (not just missing)
					Object.defineProperty(mockArray, '1', {
						value: undefined,
						configurable: true,
						enumerable: true,
						writable: true,
					});
					return mockArray;
				}
				return originalExec.call(this, str);
			});

			try {
				const result = checker(conditional, content);
				// Should handle gracefully when nodeType is undefined
				expect(result.success).toBe(false);
			} finally {
				RegExp.prototype.exec = originalExec;
			}
		});

		it('should handle MethodName attribute in checkConditionPart', () => {
			const conditional = {
				expression: '@MethodName = $var and @FullMethodName = $var2',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'MyClass.myMethod();';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// splitCombinedAndConditions splits into ["@MethodName = $var", "@FullMethodName = $var2"]
			// checkConditionPart for "@MethodName = $var" matches attrPattern, extracts "MethodName"
			// Then checks /\w+\s*\(/.test(content) which matches "myMethod();"
			// checkConditionPart for "@FullMethodName = $var2" matches attrPattern, extracts "FullMethodName"
			// Then checks /\w+\.\w+\s*\(/.test(content) which matches "MyClass.myMethod();"
			expect(result.success).toBe(true);
		});

		it('should handle generic node type patterns in checkConditionPart', () => {
			const conditional = {
				expression:
					'.//VariableDeclaration and .//MethodCallExpression',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'Integer variabledeclaration = 5; method();';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// splitCombinedAndConditions splits into [".//VariableDeclaration", ".//MethodCallExpression"]
			// checkConditionPart for ".//VariableDeclaration" matches nodeTypePattern
			// Extracts "VariableDeclaration", then checks contentLower.includes("variabledeclaration")
			// checkConditionPart for ".//MethodCallExpression" matches nodeTypePattern
			// Extracts "MethodCallExpression", then checks /\w+\s*\(/.test(content)
			expect(result.success).toBe(true);
		});

		it('should handle newlistliteralexpression pattern in checkConditionPart', () => {
			const conditional = {
				expression: '@Type = "List" and newlistliteralexpression',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'List<Integer> values = new List<Integer>();';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// splitCombinedAndConditions splits into ['@Type = "List"', 'newlistliteralexpression']
			// checkConditionPart for '@Type = "List"' matches attrPattern, extracts quotedValue "List"
			// checkConditionPart for "newlistliteralexpression" (lowercase) matches partLower.includes check
			// Then checks /new\s+List\s*[<\(]/.test(contentLower)
			// Note: regex expects "List" (capital L) but contentLower has "list" (lowercase)
			// The regex won't match lowercase, so this test should fail unless we fix the content
			// Actually, the regex is case-sensitive, so it needs "List" in the original content
			expect(result.success).toBe(true);
		});

		it('should handle generic keyword check in checkConditionPart', () => {
			const conditional = {
				expression: '@Name = $var and @Type = $var2',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String name = "test";';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// Generic keyword check splits on operators and looks for keywords
			// After filtering, should find keywords from the expression
			expect(result.success).toBe(true);
		});

		it('should handle generic keyword check when no attr or node type patterns match', () => {
			const conditional = {
				expression: 'someExpression and anotherExpression',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content =
				'String someExpression = "value"; Integer anotherExpression = 5;';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// When part doesn't match attrPattern or nodeTypePattern,
			// falls through to generic keyword check which splits on operators
			// and looks for keywords like "someExpression" and "anotherExpression"
			expect(result.success).toBe(true);
		});

		it('should handle generic keyword check filtering out operators and special chars', () => {
			const conditional = {
				expression: 'expression = value and test != null',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String expression = "value"; Integer test = null;';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// Generic keyword check splits on [=<>!()\[\]\/\.@\$]+
			// Filters out empty strings, @ attributes, and operators (and, or, not)
			// Looks for remaining keywords like "expression", "value", "test", "null"
			expect(result.success).toBe(true);
		});

		it('should handle AND conditions with quotes', () => {
			const conditional = {
				expression: '@Name = "test" and @Type = "String"',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String test = "test";';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			expect(result.success).toBe(true);
		});

		it('should handle splitCombinedAndConditions with quotes containing and', () => {
			const conditional = {
				expression: '@Name = "test and value" and @Type = "String"',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String test = "test and value";';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// splitCombinedAndConditions should not split on "and" inside quotes
			expect(result.success).toBe(true);
		});

		it('should handle splitCombinedAndConditions with parentheses', () => {
			const conditional = {
				expression: '(@Name = $var) and (@Type = "String")',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String name = "test";';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// splitCombinedAndConditions should not split on "and" inside parentheses
			expect(result.success).toBe(true);
		});

		it('should handle single condition path when no split needed', () => {
			const conditional = {
				expression: '@Name = testValue',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String testValue = "test";';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// When no "and" keyword found, splitCombinedAndConditions returns [expression]
			// parts.length < 2, so falls through to single condition path
			// Single condition splits on [=<>!()\[\]]+ giving ["@Name", " ", "testValue"]
			// Filters out "@Name" (starts with @), leaving ["testValue"]
			// Checks if content includes "testValue"
			expect(result.success).toBe(true);
		});

		it('should handle splitCombinedAndConditions with empty trimmed parts', () => {
			const conditional = {
				expression: '   and @Name = testValue',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String testValue = "test";';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// splitCombinedAndConditions splits on "and"
			// First part "   " trims to empty string, so trimmed.length === 0, doesn't get added (line 68 false branch)
			// Second part "@Name = testValue" gets added
			// parts.length === 1, so falls through to single condition path
			// Single condition path splits "@Name = testValue" and looks for "testValue"
			expect(result.success).toBe(true);
		});

		it('should handle splitCombinedAndConditions returning empty parts array', () => {
			const conditional = {
				expression: '   and   ',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String name = "test";';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// splitCombinedAndConditions splits on "and"
			// First part "   " trims to empty, doesn't get added (line 68 false branch)
			// Second part "   " trims to empty, doesn't get added (line 81 false branch)
			// parts.length === 0, so returns [expression] as fallback (line 85 false branch)
			// Then falls through to single condition path with expression = "   and   "
			expect(result.success).toBe(false);
		});

		it('should return failure when static keyword is missing', () => {
			const conditional = {
				expression: '@Static = true()',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'public void method() {}';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// Covers line 228 false branch (hasStatic ? MIN_REQUIRED_COUNT : MIN_COUNT)
			// and line 234 false branch (hasStatic ? ... : ...)
			expect(result.success).toBe(false);
			expect(result.message).toContain("missing 'static' keyword");
			expect(result.evidence[0]?.count).toBe(0);
		});

		it('should handle AND conditions with parentheses', () => {
			const conditional = {
				expression: '(@Name = $var) and (@Type = "String")',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String name = "test";';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			expect(result.success).toBe(true);
		});

		it('should return failure when some parts are not covered', () => {
			const conditional = {
				expression:
					'@FullMethodName = $var and .//NewListLiteralExpression',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'TestClass.method();';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toContain('not fully covered');
		});

		it('should handle single AND condition with generic keyword check', () => {
			const conditional = {
				expression: '@Name = "test"',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'String test = "test";';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// The code splits on [=<>!()\[\]]+ which gives ["@Name", " ", "\"test\""]
			// After trim and filter: ["\"test\""] (includes quotes)
			// So it looks for "\"test\"" keyword in content (with quotes)
			expect(result.success).toBe(true);
		});

		it('should return failure for single condition when keywords not found', () => {
			const conditional = {
				expression: '@Name = "missing"',
				position: 0,
				type: 'and',
			} as const satisfies Readonly<Conditional>;
			const content = 'public class Test {}';
			const checker = conditionalCheckers.and_operator;
			const result = checker(conditional, content);

			// "missing" keyword not found in content
			expect(result.success).toBe(false);
		});
	});

	describe('not_condition', () => {
		it('should return failure when expression is empty', () => {
			const conditional = {
				expression: '',
				position: 0,
				type: 'not',
			} as const satisfies Readonly<Conditional>;
			const checker = conditionalCheckers.not_condition;
			const result = checker(conditional, 'some content');

			expect(result.success).toBe(false);
			expect(result.message).toBe('No expression to check');
		});

		it('should detect static final field declarations', () => {
			const conditional = {
				expression: 'not(ancestor::Field[@Static and @Final])',
				position: 0,
				type: 'not',
			} as const satisfies Readonly<Conditional>;
			const content = 'private static final Integer VALUE = 5;';
			const checker = conditionalCheckers.not_condition;
			const result = checker(conditional, content);

			expect(result.success).toBe(true);
			expect(result.message).toContain('static final fields found');
		});

		it('should return failure when static final fields are missing', () => {
			const conditional = {
				expression: 'not(ancestor::Field[@Static and @Final])',
				position: 0,
				type: 'not',
			} as const satisfies Readonly<Conditional>;
			const content = 'private Integer value = 5;';
			const checker = conditionalCheckers.not_condition;
			const result = checker(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toContain(
				'missing static final field declarations',
			);
		});

		it('should handle generic NOT condition with keywords', () => {
			const conditional = {
				expression: 'not(ancestor::Method)',
				position: 0,
				type: 'not',
			} as const satisfies Readonly<Conditional>;
			const content = 'public void method() {}';
			const checker = conditionalCheckers.not_condition;
			const result = checker(conditional, content);

			// The code splits on [=<>!()\[\]:]+ which gives ["not", "ancestor", "Method"]
			// After filtering out "ancestor" and "not": ["Method"]
			// The code looks for "method" (from Method.toLowerCase()) in content
			expect(result.success).toBe(true);
		});

		it('should return failure when keywords not found in generic NOT condition', () => {
			const conditional = {
				expression: 'not(@SomeAttribute)',
				position: 0,
				type: 'not',
			} as const satisfies Readonly<Conditional>;
			const content = 'public class Test {}';
			const checker = conditionalCheckers.not_condition;
			const result = checker(conditional, content);

			// After filtering out @SomeAttribute and "not", no keywords remain
			expect(result.success).toBe(false);
		});
	});

	describe('or_branch', () => {
		it('should return not implemented message', () => {
			const conditional = {
				expression: '@Visibility = "public" or @Visibility = "global"',
				position: 0,
				type: 'or',
			} as const satisfies Readonly<Conditional>;
			const checker = conditionalCheckers.or_branch;
			const result = checker(conditional, 'some content');

			expect(result.success).toBe(false);
			expect(result.message).toBe(
				'Or branch coverage check not implemented',
			);
		});
	});

	describe('if_condition', () => {
		it('should return not implemented message', () => {
			const conditional = {
				expression: 'if (@Static) then @Final else true()',
				position: 0,
				type: 'if_condition',
			} as const satisfies Readonly<Conditional>;
			const checker = conditionalCheckers.if_condition;
			const result = checker(conditional, 'some content');

			expect(result.success).toBe(false);
			expect(result.message).toBe(
				'If condition coverage check not implemented',
			);
		});
	});

	describe('quantified', () => {
		it('should return not implemented message', () => {
			const conditional = {
				expression: 'some $x in //Method satisfies @Static',
				position: 0,
				type: 'quantified',
			} as const satisfies Readonly<Conditional>;
			const checker = conditionalCheckers.quantified;
			const result = checker(conditional, 'some content');

			expect(result.success).toBe(false);
			expect(result.message).toBe(
				'Quantified condition coverage check not implemented',
			);
		});
	});

	describe('boolean_function', () => {
		it('should return not implemented message', () => {
			const conditional = {
				expression: 'contains(@Name, "test")',
				position: 0,
				type: 'boolean_function',
			} as const satisfies Readonly<Conditional>;
			const checker = conditionalCheckers.boolean_function;
			const result = checker(conditional, 'some content');

			expect(result.success).toBe(false);
			expect(result.message).toBe(
				'Boolean function coverage check not implemented',
			);
		});
	});
});
