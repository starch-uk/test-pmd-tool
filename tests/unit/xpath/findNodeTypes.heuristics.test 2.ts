/**
 * @file
 * Coverage tests for heuristic branches in findNodeTypes.
 */
import { describe, expect, it } from 'vitest';
import { checkNodeTypeCoverage } from '../../../src/xpath/findNodeTypes.js';

describe('findNodeTypes heuristic fallback', () => {
	it('counts UserClass as covered when nested class pattern is present', () => {
		const content = `
public class Outer {
  public class Inner {
    public void m() {}
  }
}
`;
		const result = checkNodeTypeCoverage(['UserClass'], content);
		expect(result.count).toBe(1);
		expect(result.required).toBe(1);
	});
});
