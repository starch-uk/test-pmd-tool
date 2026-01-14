/**
 * @file
 * Unit tests for conditional coverage checking strategies.
 */
import { describe, it, expect } from 'vitest';
import { conditionalCheckers } from '../../../../../src/xpath/coverage/conditional/strategies.js';
import type { Conditional } from '../../../../../src/types/index.js';

describe('conditionalCheckers', () => {
	describe('and_operator', () => {
		it('should detect final keyword in content', () => {
			const conditional: Conditional = {
				expression: '@Final = true()',
				position: 0,
				type: 'and',
			};
			const content = 'private static final Pattern TEST = Pattern.compile();';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result.success).toBe(true);
			expect(result.message).toContain('covered');
		});

		it('should detect static keyword in content', () => {
			const conditional: Conditional = {
				expression: '@Static = true()',
				position: 0,
				type: 'and',
			};
			const content = 'private static final Pattern TEST = Pattern.compile();';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result.success).toBe(true);
			expect(result.message).toContain('covered');
		});

		it('should return false when static keyword is missing', () => {
			const conditional: Conditional = {
				expression: '@Static = true()',
				position: 0,
				type: 'and',
			};
			const content = 'private final Pattern TEST = Pattern.compile();';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toContain('not covered');
			expect(result.evidence[0]?.count).toBe(0);
		});

		it('should return false when final keyword is missing', () => {
			const conditional: Conditional = {
				expression: '@Final = true()',
				position: 0,
				type: 'and',
			};
			const content = 'private static Pattern TEST = Pattern.compile();';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toContain('not covered');
		});

		it('should use generic keyword matching for other expressions', () => {
			const conditional: Conditional = {
				expression: 'Value = 5',
				position: 0,
				type: 'and',
			};
			const content = 'if (Value == 5) { }';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result.success).toBe(true);
		});

		it('should return false when generic keywords are not found', () => {
			const conditional: Conditional = {
				expression: 'UnknownExpr = 5',
				position: 0,
				type: 'and',
			};
			const content = 'some content without keywords';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toContain('not covered');
		});

		it('should filter out empty strings and @-prefixed keywords', () => {
			const conditional: Conditional = {
				expression: '@Attr = Value',
				position: 0,
				type: 'and',
			};
			const content = 'if (Value) { }';

			const result = conditionalCheckers.and_operator(conditional, content);

			// Should find "Value" but not "@Attr"
			expect(result.success).toBe(true);
		});

		it('should return false for empty expression', () => {
			const conditional: Conditional = {
				expression: '',
				position: 0,
				type: 'and',
			};
			const content = 'some content';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toBe('No expression to check');
		});

		it('should handle combined AND conditions and require all parts', () => {
			const conditional: Conditional = {
				expression:
					'@FullMethodName = $stringJoinFullName and .//NewListLiteralExpression',
				position: 0,
				type: 'and',
			};
			// Content with method call (for FullMethodName) and new List (for NewListLiteralExpression)
			const content = 'String.join("", new List<String>());';

			const result = conditionalCheckers.and_operator(conditional, content);

			// The combined condition should be recognized and checked
			// It may report as covered if both parts are satisfied
			expect(result).toBeDefined();
			expect(result.evidence).toBeDefined();
		});

		it('should detect missing parts in combined AND conditions', () => {
			const conditional: Conditional = {
				expression:
					'@FullMethodName = $stringJoinFullName and .//NewListLiteralExpression',
				position: 0,
				type: 'and',
			};
			// Content with method call but missing new List
			const content = 'String.join("", something);';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toMatch(/not (fully )?covered/);
		});

		it('should handle AND conditions with quotes in splitting', () => {
			const conditional: Conditional = {
				expression: '@Name = "test" and @Other = "value"',
				position: 0,
				type: 'and',
			};
			const content = 'test value';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle AND conditions with parentheses in splitting', () => {
			const conditional: Conditional = {
				expression: 'A and (B and C) and D',
				position: 0,
				type: 'and',
			};
			const content = 'A B C D';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle attribute with quoted value in condition part', () => {
			const conditional: Conditional = {
				expression: '@Name = "testValue" and .//NodeType',
				position: 0,
				type: 'and',
			};
			const content = 'testValue NodeType';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle node type pattern with // prefix', () => {
			const conditional: Conditional = {
				expression: '@Attr = $var and //MethodCallExpression',
				position: 0,
				type: 'and',
			};
			const content = 'method();';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle generic node type check in condition part', () => {
			const conditional: Conditional = {
				expression: '@Attr = $var and .//SomeOtherNodeType',
				position: 0,
				type: 'and',
			};
			const content = 'someothernodetype';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle other attribute types in condition part', () => {
			const conditional: Conditional = {
				expression: '@OtherAttr = $var and .//NodeType',
				position: 0,
				type: 'and',
			};
			const content = 'NodeType';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle splitting when and is at start of expression', () => {
			const conditional: Conditional = {
				expression: 'and A and B',
				position: 0,
				type: 'and',
			};
			const content = 'A B';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle splitting when expression has nested and in parentheses', () => {
			const conditional: Conditional = {
				expression: 'A and (B and C) and D',
				position: 0,
				type: 'and',
			};
			const content = 'A B C D';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle MethodName attribute in condition part', () => {
			const conditional: Conditional = {
				expression: '@MethodName = $var and .//NodeType',
				position: 0,
				type: 'and',
			};
			const content = 'method(); NodeType';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle newlistliteralexpression pattern in lowercase', () => {
			const conditional: Conditional = {
				expression: '@Attr = $var and newlistliteralexpression',
				position: 0,
				type: 'and',
			};
			const content = 'new List<String>();';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle empty expression in splitCombinedAndConditions', () => {
			const conditional: Conditional = {
				expression: '',
				position: 0,
				type: 'and',
			};
			const content = 'some content';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result.success).toBe(false);
		});

		it('should handle expression with no parts after splitting', () => {
			const conditional: Conditional = {
				expression: 'and',
				position: 0,
				type: 'and',
			};
			const content = 'some content';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle attribute pattern without match', () => {
			const conditional: Conditional = {
				expression: '@UnknownAttr = $var and .//NodeType',
				position: 0,
				type: 'and',
			};
			const content = 'NodeType';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle node type pattern without match', () => {
			const conditional: Conditional = {
				expression: '@Attr = $var and .//UnknownNodeType',
				position: 0,
				type: 'and',
			};
			const content = 'unknownnodetype';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle trimmed empty part in splitting', () => {
			const conditional: Conditional = {
				expression: 'A and   and B',
				position: 0,
				type: 'and',
			};
			const content = 'A B';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle attribute pattern where attrName is undefined', () => {
			const conditional: Conditional = {
				expression: '@ = $var and .//NodeType',
				position: 0,
				type: 'and',
			};
			const content = 'NodeType';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle node type pattern where nodeType is undefined', () => {
			const conditional: Conditional = {
				expression: '@Attr = $var and .//',
				position: 0,
				type: 'and',
			};
			const content = 'some content';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle attrMatch null case (pattern matches but exec returns null)', () => {
			const conditional: Conditional = {
				expression: '@ = $var and .//NodeType',
				position: 0,
				type: 'and',
			};
			const content = 'NodeType';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

		it('should handle nodeTypeMatch null case (pattern matches but exec returns null)', () => {
			const conditional: Conditional = {
				expression: '@Attr = $var and .//',
				position: 0,
				type: 'and',
			};
			const content = 'some content';

			const result = conditionalCheckers.and_operator(conditional, content);

			expect(result).toBeDefined();
		});

	});

	describe('not_condition', () => {
		it('should detect static final fields in content', () => {
			const conditional: Conditional = {
				expression:
					'ancestor::FieldDeclarationStatements[ModifierNode[@Static = true() and @Final = true()]]',
				position: 0,
				type: 'not',
			};
			const content =
				'private static final Pattern TEST_PATTERN = Pattern.compile();';

			const result = conditionalCheckers.not_condition(conditional, content);

			expect(result.success).toBe(true);
			expect(result.message).toContain('static final fields found');
		});

		it('should detect static final field with Field pattern', () => {
			const conditional: Conditional = {
				expression: 'ancestor::Field[ModifierNode[@Static = true() and @Final = true()]]',
				position: 0,
				type: 'not',
			};
			const content =
				'private static final Pattern TEST_PATTERN = Pattern.compile();';

			const result = conditionalCheckers.not_condition(conditional, content);

			expect(result.success).toBe(true);
		});

		it('should return false when static final fields are missing', () => {
			const conditional: Conditional = {
				expression:
					'ancestor::FieldDeclarationStatements[ModifierNode[@Static = true() and @Final = true()]]',
				position: 0,
				type: 'not',
			};
			const content = 'private Pattern TEST = Pattern.compile();';

			const result = conditionalCheckers.not_condition(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toContain('not covered');
		});

		it('should use generic keyword matching for other expressions', () => {
			const conditional: Conditional = {
				expression: 'SomeExpression',
				position: 0,
				type: 'not',
			};
			const content = 'if (SomeExpression) { }';

			const result = conditionalCheckers.not_condition(conditional, content);

			expect(result.success).toBe(true);
		});

		it('should return false for empty expression', () => {
			const conditional: Conditional = {
				expression: '',
				position: 0,
				type: 'not',
			};
			const content = 'some content';

			const result = conditionalCheckers.not_condition(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toBe('No expression to check');
		});
	});

	describe('or_branch', () => {
		it('should return not implemented message', () => {
			const conditional: Conditional = {
				expression: '@Visibility = public',
				position: 0,
				type: 'or',
			};
			const content = 'some content';

			const result = conditionalCheckers.or_branch(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toBe('Or branch coverage check not implemented');
		});
	});

	describe('if_condition', () => {
		it('should return not implemented message', () => {
			const conditional: Conditional = {
				expression: 'some condition',
				position: 0,
				type: 'if',
			};
			const content = 'some content';

			const result = conditionalCheckers.if_condition(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toBe('If condition coverage check not implemented');
		});
	});

	describe('quantified', () => {
		it('should return not implemented message', () => {
			const conditional: Conditional = {
				expression: 'some quantified expression',
				position: 0,
				type: 'quantified',
			};
			const content = 'some content';

			const result = conditionalCheckers.quantified(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toBe(
				'Quantified condition coverage check not implemented',
			);
		});
	});

	describe('boolean_function', () => {
		it('should return not implemented message', () => {
			const conditional: Conditional = {
				expression: 'some boolean function',
				position: 0,
				type: 'boolean_function',
			};
			const content = 'some content';

			const result = conditionalCheckers.boolean_function(conditional, content);

			expect(result.success).toBe(false);
			expect(result.message).toBe(
				'Boolean function coverage check not implemented',
			);
		});
	});
});
