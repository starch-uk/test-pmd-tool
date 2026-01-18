/**
 * @file
 * Test helpers for common test patterns and assertions.
 * Reduces duplication and improves test maintainability.
 */
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
 * Allows customization of XPath analysis data for testing purposes.
 */
interface MockXPathAnalysisOptions {
	readonly attributes?: readonly string[];
	readonly conditionals?: readonly Conditional[];
	readonly hasLetExpressions?: boolean;
	readonly hasUnions?: boolean;
	readonly nodeTypes?: readonly string[];
	readonly operators?: readonly string[];
	readonly patterns?: readonly string[];
}

/**
 * Creates a mock XPath analysis result with sensible defaults.
 * Generates a complete XPathAnalysis object for testing coverage checks.
 * @param options - Options to customize the analysis result.
 * @returns A complete XPathAnalysis object with specified options and defaults.
 * Exported for use in future tests.
 */
function createMockXPathAnalysis(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- False positive, options is already Readonly<>
	options: Readonly<MockXPathAnalysisOptions> = {},
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
 * Customizes various aspects of the generated XML for testing purposes.
 * Allows specification of rule name, XPath expression, and XML formatting options.
 */
interface MockXmlContentOptions {
	readonly ruleName?: string;
	readonly xpath?: string;
	readonly xpathOnSameLine?: boolean;
	readonly hasCdata?: boolean;
}

/**
 * Creates mock XML rule file content with sensible defaults.
 * Generates valid PMD rule XML for testing purposes.
 * @param options - Options to customize the XML content.
 * @returns XML string with specified options.
 */
function createMockXmlContent(
	options: Readonly<MockXmlContentOptions> = {},
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
interface ExampleDataOptions {
	readonly content?: string;
	readonly exampleIndex?: number;
	readonly validMarkers?: readonly never[];
	readonly valids?: readonly never[];
	readonly violationMarkers?: readonly never[];
	readonly violations?: readonly never[];
}

/**
 * Creates example data for coverage tests with sensible defaults.
 * @param options - Options to customize the example data.
 * @returns ExampleData object with specified options and defaults.
 * Exported for use in future tests.
 */
function createExampleDataForCoverage(
	options: Readonly<ExampleDataOptions> = {},
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
interface CoverageExpectations {
	readonly success?: boolean;
	readonly hasLineInfo?: boolean;
	readonly hasMissingItems?: boolean;
	readonly missingItems?: readonly string[];
	readonly messageContains?: readonly string[];
	readonly coverageCount?: number;
}

/**
 * Asserts that a coverage result meets the specified expectations.
 * @param result - The coverage result to check.
 * @param expectations - The expectations to verify.
 */
function expectCoverageResult(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- False positive, parameters are already Readonly<>
	result: Readonly<CoverageResult>,
	expectations: Readonly<CoverageExpectations>,
): void {
	if (expectations.success !== undefined) {
		expect(result.success).toBe(expectations.success);
	}

	if (expectations.coverageCount !== undefined) {
		expect(result.evidence).toHaveLength(expectations.coverageCount);
	}

	if (expectations.hasLineInfo !== undefined) {
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
		const hasLineInfoValue = result.evidence.some((evidence) =>
			evidence.description.includes('Line'),
		);
		expect(hasLineInfoValue).toBe(expectations.hasLineInfo);
	}

	if (expectations.hasMissingItems !== undefined) {
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
		const hasMissing = result.evidence.some((evidence) =>
			evidence.description.includes('Missing:'),
		);
		expect(hasMissing).toBe(expectations.hasMissingItems);
	}

	if (expectations.missingItems !== undefined) {
		const allDescriptions = result.evidence
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
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
interface XPathCoverageExpectations {
	readonly overallSuccess?: boolean;
	readonly coverageCount?: number;
	readonly uncoveredBranchesCount?: number;
	readonly hasLineInfo?: boolean;
}

/**
 * Asserts that an XPath coverage result meets the specified expectations.
 * @param result - The XPath coverage result to check.
 * @param expectations - The expectations to verify.
 * @param expectations.overallSuccess - Expected overall success value.
 * @param expectations.coverageCount - Expected coverage count.
 * @param expectations.uncoveredBranchesCount - Expected uncovered branches count.
 * @param expectations.hasLineInfo - Whether line info should be present.
 * Exported for use in future tests.
 */
function expectXPathCoverageResult(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- False positive, parameters are already Readonly<>
	result: Readonly<XPathCoverageResult>,
	expectations: Readonly<XPathCoverageExpectations>,
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
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
		const hasLineInfoValue = result.coverage.some((coverageResult) =>
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
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
function hasLineInfo(description: Readonly<string>): boolean {
	return description.includes('Line ');
}

/**
 * Checks if a string contains missing items information.
 * @param description - The description string to check.
 * @returns True if the description contains missing items.
 */
function hasMissingItems(description: Readonly<string>): boolean {
	return description.includes('Missing:');
}

/**
 * Extracts missing items from a description string.
 * @param description - The description string to parse.
 * @returns Array of missing item identifiers.
 */
function extractMissingItems(description: Readonly<string>): string[] {
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

export {
	createExampleDataForCoverage,
	createMockXmlContent,
	createMockXPathAnalysis,
	expectCoverageResult,
	expectXPathCoverageResult,
	extractMissingItems,
	hasLineInfo,
	hasMissingItems,
};

export type {
	CoverageExpectations,
	ExampleData,
	ExampleDataOptions,
	MockXmlContentOptions,
	MockXPathAnalysisOptions,
	XPathCoverageExpectations,
};
