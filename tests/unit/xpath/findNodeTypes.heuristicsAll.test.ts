/**
 * @file
 * Covers heuristic node-type detection branches used when AST parsing fails.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/parser/apexParser.js', () => ({
	isValidParseResult: vi.fn(() => false),
	parseApexCode: vi.fn(() => ({
		ast: undefined,
		errors: [{ message: 'no ast', severity: 'error' }],
		isUsable: false,
		partialSuccess: false,
	})),
}));

import { checkNodeTypeCoverage } from '../../../src/xpath/findNodeTypes.js';

describe('findNodeTypes heuristic coverage', () => {
	it('covers multiple heuristic branches in one pass', () => {
		const content = `
@IsTest
public class Outer {
  public class Inner { }
  public void m() { doThing(); }
  public void doThing() {}
}
`;
		const result = checkNodeTypeCoverage(
			[
				'StandardCondition',
				'Class',
				'Method',
				'UserClass',
				'MethodCallExpression',
				'Annotation',
				'AnnotationParameter',
			],
			content,
		);

		expect(result.count).toBe(result.required);
	});
});
