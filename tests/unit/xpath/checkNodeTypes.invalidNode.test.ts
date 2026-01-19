/**
 * @file
 * Covers the defensive branch in AST walking when a value is not an AST node.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/parser/apexParser.js', () => ({
	isValidParseResult: vi.fn(() => true),
	parseApexCode: vi.fn(() => ({
		ast: {
			kind: 'CompilationUnit',
			// Non-object child to hit `typeof node !== 'object'` guard in traversal.
			children: [123],
		},
		errors: [],
		isUsable: true,
		partialSuccess: false,
	})),
}));

import { checkNodeTypeCoverage } from '../../../src/xpath/findNodeTypes.js';

describe('checkNodeTypes defensive traversal', () => {
	it('does not throw when AST contains non-node values', () => {
		const result = checkNodeTypeCoverage(
			['CompilationUnit'],
			'public class X {}',
		);

		expect(result.required).toBe(1);
	});
});
