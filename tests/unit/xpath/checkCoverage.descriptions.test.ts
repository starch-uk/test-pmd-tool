/**
 * @file
 * Unit tests for checkXPathCoverage function - description formatting.
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

describe('checkXPathCoverage - descriptions', () => {
	beforeEach(() => {
		mockedReadFileSync.mockReset();
		mockedAnalyzeXPath.mockClear();
	});

	it('should handle conditional description with only missing items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Value = 5',
					position: 0,
					type: 'not',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'some content without the conditional',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('not(@Value = 5)', examples);

		expect(result.coverage).toHaveLength(1);
		expect(result.coverage[0]?.evidence[0]?.description).toContain(
			'Missing:',
		);
		expect(result.coverage[0]?.evidence[0]?.description).not.toContain(
			'Covered:',
		);
	});

	it('should handle attribute description with only found items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Name'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'name attribute',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage('//Method[@Name]', examples);

		expect(result.coverage).toHaveLength(1);
		// Attributes now only show Missing items, not found items
		// Since Name is found, description should be empty (no Missing section)
		const description = result.coverage[0]?.evidence[0]?.description;
		expect(description).not.toContain('Missing:');
		expect(description).not.toContain('Name');
	});

	it('should handle operator description with only found items (no description when all covered)', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['='],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'if (x = 5) { }',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage("//Method[@Name='test']", examples);

		expect(result.coverage).toHaveLength(1);
		// When all operators are covered, description should be empty (only show uncovered)
		expect(result.coverage[0]?.evidence[0]?.description).toBe('');
	});

	it('should handle conditional description with both covered and missing items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [
				{
					expression: '@Value = 5',
					position: 0,
					type: 'and',
				},
				{
					expression: '@Name = "test"',
					position: 10,
					type: 'or',
				},
			],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: '@value = 5',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Value = 5 or @Name = "test"]',
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description;
		// Conditionals now only show Missing items, not Covered items
		// The first conditional should be covered (contains "@value = 5") - not shown
		// The second conditional should be missing (doesn't contain "@name = "test"" and no "if") - shown
		expect(description).toContain('Missing:');
		expect(description).toContain('or:');
		expect(description).not.toContain('Covered:');
	});

	it('should handle attribute description with both found and missing items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: ['Name', 'Value'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});

		const examples: ExampleData[] = [
			{
				content: 'name attribute',
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Name and @Value]',
			examples,
		);

		expect(result.coverage).toHaveLength(1);
		// Attributes now only show Missing items, not found items
		// Name is found (not shown), Value is missing (shown)
		const description = result.coverage[0]?.evidence[0]?.description;
		expect(description).toContain('Missing:');
		expect(description).toContain('Value');
		expect(description).not.toContain('Name');
	});

	it('should handle operator description with both found and missing items', () => {
		mockedAnalyzeXPath.mockReturnValue({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: ['and'],
			patterns: [],
		});

		const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath" value="//Method[@Flag and @OtherFlag]"></property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXmlContent);

		const examples: ExampleData[] = [
			{
				content: 'if (flag) { }', // no textual "and" so operator is missing
				exampleIndex: 1,
				validMarkers: [],
				valids: [],
				violationMarkers: [],
				violations: [],
			},
		];

		const result = checkXPathCoverage(
			'//Method[@Flag and @OtherFlag]',
			examples,
			'/path/to/rule.xml',
		);

		expect(result.coverage).toHaveLength(1);
		const description = result.coverage[0]?.evidence[0]?.description ?? '';
		expect(description).toContain('Missing:');
		expect(description).toContain('and');
		expect(description).toContain('Line ');
	});
});
