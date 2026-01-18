/**
 * @file
 * Unit tests for checkXPathCoverage function - conditional line-finding edge cases.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkXPathCoverage } from '../../src/xpath/checkCoverage.js';
import type { ExampleData } from '../../src/types/index.js';

// Mock analyzeXPath
vi.mock('../../../src/xpath/analyzeXPath.js', () => ({
	analyzeXPath: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

// Import mocked modules after all vi.mock() declarations
// Per VITEST.md, vi.mock() is hoisted, so imports get the mocked version
import * as analyzeXPathModule from '../../src/xpath/analyzeXPath.js';

const mockedReadFileSync = vi.mocked(readFileSync);
// Use vi.spyOn per VITEST.md "Spy on Export" pattern to get typed mock access

const mockedAnalyzeXPath = vi.spyOn(analyzeXPathModule, 'analyzeXPath');

describe('checkXPathCoverage - conditional edge cases', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
		mockedAnalyzeXPath.mockClear();
	});
	it('should handle conditional when xpathSectionStart is NOT_FOUND_INDEX', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Name = "test"',
					position: 5,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// XML without xpath property - triggers xpathSectionStart === NOT_FOUND_INDEX branch
		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="other">
      <value>something</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some unrelated content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name = "test"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		// Should still try fallback even without xpath section
		expect(description).not.toContain('Line ');
	});

	it('should handle conditional when xpathContentStart is last line (hasNextLine false)', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Name = "test"',
					position: 0,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// XML where <value> is on the last line - triggers hasNextLine = false branch
		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Name = "test"]</value>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some unrelated content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name = "test"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		// When xpathContentStart is the last line (hasNextLine = false),
		// line numbers may not be included in the description
	});

	it('should handle conditional when xpathSectionStart is NOT_FOUND_INDEX', () => {
		// Test when xpathSectionStart === NOT_FOUND_INDEX (property not found)
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Name = "test"',
					position: 10,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// XML without xpath property - triggers xpathSectionStart === NOT_FOUND_INDEX
		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="other">
      <value>something</value>
    </property>
  </properties>
</rule>`;
		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name = "test"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
	});

	it('should handle conditional when hasNextLine is false', () => {
		// Test when hasNextLine is false (nextLineIndex >= lines.length)
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Name = "test"',
					position: 0,
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// XML where <value> is the last line - triggers hasNextLine = false
		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Name = "test"]</value>`;
		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name = "test"]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage.length).toBeGreaterThan(0);
	});

	it('should handle conditional when no newlines before position (newlineMatches null)', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@UniqueAttr = "unique"',
					position: 0, // Position at start means no newlines before
					type: 'and',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// XML that doesn't contain the expression pattern, forcing fallback path
		// The search pattern would be "and @UniqueAttr = unique" which won't match
		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Name = "test"]</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some unrelated content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		// XPath with conditional at position 0 (no newlines before)
		// This ensures xpathBeforeConditional is empty string, match returns null
		const xpath = 'and @UniqueAttr = "unique" //Method[@Name = "test"]';
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('Line ');
	});

	it('should handle conditional type "not" (not "or" or "and")', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Name = "test"',
					position: 0,
					type: 'not', // Not "or" or "and", so searchPattern is just exprPattern
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		// XML that doesn't contain the expression, forcing fallback
		const mockXmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//Method[@Other]</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'some unrelated content',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const xpath = 'not(@Name = "test")';
		const result = checkXPathCoverage(xpath, examples, '/path/to/rule.xml');

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('@Name = "test"');
	});
});
