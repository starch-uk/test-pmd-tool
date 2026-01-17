/**
 * @file
 * Test helpers for common test patterns and assertions.
 * Reduces duplication and improves test maintainability.
 */
/* eslint-disable import/group-exports -- Helper functions must be exported individually */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Test helpers accept mutable test data */
import { expect } from 'vitest';
import type {
	Conditional,
	CoverageResult,
	ExampleData,
	XPathAnalysis,
	XPathCoverageResult,
} from '../../../src/types/index.js';

/**
 * Options for creating mock XPath analysis results.
 */
export interface MockXPathAnalysisOptions {
	attributes?: string[];
	conditionals?: Conditional[];
	hasLetExpressions?: boolean;
	hasUnions?: boolean;
	nodeTypes?: string[];
	operators?: string[];
	patterns?: string[];
}

/**
 * Creates a mock XPath analysis result with sensible defaults.
 * @param options - Options to customize the analysis result.
 * @returns A complete XPathAnalysis object with specified options and defaults.
 */
export function createMockXPathAnalysis(
	options: MockXPathAnalysisOptions = {},
): XPathAnalysis {
	return {
		attributes: options.attributes ?? [],
		conditionals: options.conditionals ?? [],
		hasLetExpressions: options.hasLetExpressions ?? false,
		hasUnions: options.hasUnions ?? false,
		nodeTypes: options.nodeTypes ?? [],
		operators: options.operators ?? [],
		patterns: options.patterns ?? [],
	};
}

/**
 * Options for creating XML rule file content.
 */
export interface MockXmlContentOptions {
	ruleName?: string;
	xpath?: string;
	xpathOnSameLine?: boolean;
	hasCdata?: boolean;
}

/**
 * Creates mock XML rule file content with sensible defaults.
 * @param options - Options to customize the XML content.
 * @returns XML string with specified options.
 */
export function createMockXmlContent(
	options: MockXmlContentOptions = {},
): string {
	const ruleName = options.ruleName ?? 'TestRule';
	const xpath = options.xpath ?? '//Method';
	const hasCdata = options.hasCdata ?? false;
	const xpathOnSameLine = options.xpathOnSameLine ?? false;

	if (xpathOnSameLine) {
		return `<?xml version="1.0" encoding="UTF-8"?>
<rule name="${ruleName}">
  <properties>
    <property name="xpath" value="${xpath}"></property>
  </properties>
</rule>`;
	}

	if (hasCdata) {
		return `<?xml version="1.0" encoding="UTF-8"?>
<rule name="${ruleName}">
  <properties>
    <property name="xpath">
      <value>
        <![CDATA[
${xpath}
        ]]>
      </value>
    </property>
  </properties>
</rule>`;
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<rule name="${ruleName}">
  <properties>
    <property name="xpath">
      <value>${xpath}</value>
    </property>
  </properties>
</rule>`;
}

/**
 * Options for creating example data for coverage tests.
 */
export interface ExampleDataOptions {
	content?: string;
	exampleIndex?: number;
	validMarkers?: never[];
	valids?: never[];
	violationMarkers?: never[];
	violations?: never[];
}

/**
 * Creates example data for coverage tests with sensible defaults.
 * @param options - Options to customize the example data.
 * @returns ExampleData object with specified options and defaults.
 */
export function createExampleDataForCoverage(
	options: ExampleDataOptions = {},
): ExampleData {
	return {
		content: options.content ?? 'public class Test {}',
		exampleIndex: options.exampleIndex ?? 1,
		validMarkers: options.validMarkers ?? [],
		valids: options.valids ?? [],
		violationMarkers: options.violationMarkers ?? [],
		violations: options.violations ?? [],
	};
}

/**
 * Options for coverage result expectations.
 */
export interface CoverageExpectations {
	success?: boolean;
	hasLineInfo?: boolean;
	hasMissingItems?: boolean;
	missingItems?: string[];
	messageContains?: string[];
	coverageCount?: number;
}

/**
 * Asserts that a coverage result meets the specified expectations.
 * @param result - The coverage result to check.
 * @param expectations - The expectations to verify.
 */
export function expectCoverageResult(
	result: CoverageResult,
	expectations: CoverageExpectations,
): void {
	if (expectations.success !== undefined) {
		expect(result.success).toBe(expectations.success);
	}

	if (expectations.coverageCount !== undefined) {
		expect(result.evidence).toHaveLength(expectations.coverageCount);
	}

	if (expectations.hasLineInfo !== undefined) {
		const hasLineInfoValue = result.evidence.some((evidence) =>
			evidence.description.includes('Line'),
		);
		expect(hasLineInfoValue).toBe(expectations.hasLineInfo);
	}

	if (expectations.hasMissingItems !== undefined) {
		const hasMissing = result.evidence.some((evidence) =>
			evidence.description.includes('Missing:'),
		);
		expect(hasMissing).toBe(expectations.hasMissingItems);
	}

	if (expectations.missingItems !== undefined) {
		const allDescriptions = result.evidence
			.map((evidence) => evidence.description)
			.join(' ');
		for (const item of expectations.missingItems) {
			expect(allDescriptions).toContain(item);
		}
	}

	if (expectations.messageContains !== undefined) {
		for (const text of expectations.messageContains) {
			expect(result.message).toContain(text);
		}
	}
}

/**
 * Options for XPath coverage result expectations.
 */
export interface XPathCoverageExpectations {
	overallSuccess?: boolean;
	coverageCount?: number;
	uncoveredBranchesCount?: number;
	hasLineInfo?: boolean;
}

/**
 * Asserts that an XPath coverage result meets the specified expectations.
 * @param result - The XPath coverage result to check.
 * @param expectations - The expectations to verify.
 * @param expectations.overallSuccess - Expected overall success value.
 * @param expectations.coverageCount - Expected coverage count.
 * @param expectations.uncoveredBranchesCount - Expected uncovered branches count.
 * @param expectations.hasLineInfo - Whether line info should be present.
 */
export function expectXPathCoverageResult(
	result: XPathCoverageResult,
	expectations: XPathCoverageExpectations,
): void {
	if (expectations.overallSuccess !== undefined) {
		expect(result.overallSuccess).toBe(expectations.overallSuccess);
	}

	if (expectations.coverageCount !== undefined) {
		expect(result.coverage).toHaveLength(expectations.coverageCount);
	}

	if (expectations.uncoveredBranchesCount !== undefined) {
		expect(result.uncoveredBranches).toHaveLength(
			expectations.uncoveredBranchesCount,
		);
	}

	if (expectations.hasLineInfo !== undefined) {
		const hasLineInfoValue = result.coverage.some((coverageResult) =>
			coverageResult.evidence.some((evidence) =>
				evidence.description.includes('Line'),
			),
		);
		expect(hasLineInfoValue).toBe(expectations.hasLineInfo);
	}
}

/**
 * Checks if a string contains line number information.
 * @param description - The description string to check.
 * @returns True if the description contains line number information.
 */
export function hasLineInfo(description: string): boolean {
	return description.includes('Line ');
}

/**
 * Checks if a string contains missing items information.
 * @param description - The description string to check.
 * @returns True if the description contains missing items.
 */
export function hasMissingItems(description: string): boolean {
	return description.includes('Missing:');
}

/**
 * Extracts missing items from a description string.
 * @param description - The description string to parse.
 * @returns Array of missing item identifiers.
 */
export function extractMissingItems(description: string): string[] {
	if (!hasMissingItems(description)) {
		return [];
	}

	const missingSection = description
		.split('Missing:')[1]
		?.split('\n')[0]
		.trim();
	if (missingSection === undefined || missingSection.length === 0) {
		return [];
	}

	// Simple extraction - split by common delimiters
	return missingSection
		.split(/[,:]/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}
