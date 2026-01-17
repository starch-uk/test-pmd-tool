/**
 * @file
 * Unit tests for findNodeTypeLineNumber function edge cases.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkXPathCoverage } from '../../../src/xpath/checkCoverage.js';
import type { ExampleData } from '../../../src/types/index.js';

// Mock analyzeXPath
vi.mock('../../../src/xpath/analyzeXPath.js', () => ({
	analyzeXPath: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

import { analyzeXPath } from '../../../src/xpath/analyzeXPath.js';

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedAnalyzeXPath = vi.mocked(analyzeXPath);

describe('findNodeTypeLineNumber edge cases', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
	});

	it('should handle newlineMatches null case when no newlines in XPath substring', () => {
		// Test newlineMatches is null when match() returns null
		// This happens when xpathBeforeNodeType has no newlines
		// To trigger this, we need:
		// 1. Node type not found in single line (forces fallback)
		// 2. Node type not found in XPath section (forces fallback)
		// 3. Node type found in XPath string (xpathIndex !== NOT_FOUND_INDEX)
		// 4. XPath substring before node type has no newlines (newlineMatches is null)
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['SomeNodeType'],
			operators: [],
			patterns: [],
		});

		// XML where node type is NOT in a single line and NOT in XPath section
		// This forces the fallback path
		// XPath has no newlines before the node type, so newlineMatches will be null
		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//OtherNode[@Attr="value"]</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'public class Test {}',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		// XPath with node type at start (no newlines before it) - triggers fallback
		// Node type 'SomeNodeType' is not in XML, so findNodeTypeLineNumber will use fallback
		const xpath = '//SomeNodeType[@Attr="value"]';
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		// Should complete without errors and handle newlineMatches null case
		expect(result).toBeDefined();
		expect(result.coverage).toBeDefined();
		// Should have coverage result for node types
		expect(result.coverage.length).toBeGreaterThan(0);
		// Should have missing node types (SomeNodeType not found in content)
		const nodeTypeResult = result.coverage.find(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for Array.prototype.find
			(c) => c.message.includes('Node types:'),
		);
		expect(nodeTypeResult).toBeDefined();
		// Should have line number in description (from findNodeTypeLineNumber)
		expect(nodeTypeResult?.evidence[0]?.description).toContain('Line');
	});
});
