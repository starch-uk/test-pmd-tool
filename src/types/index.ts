/**
 * @file
 * TypeScript type definitions for the PMD Rule Tester.
 */
/* eslint-disable import/group-exports -- Type definitions must be exported individually */
export interface XPathAnalysis {
	nodeTypes: string[];
	operators: string[];
	attributes: string[];
	conditionals: Conditional[];
	hasUnions: boolean;
	hasLetExpressions: boolean;
	patterns: string[];
}

export interface Conditional {
	type: string;
	expression: string;
	position: number;
}

export interface HardcodedValueIssue {
	type: 'array' | 'attribute' | 'number';
	value: string;
	recommendation: string;
	severity: 'error' | 'warning';
}

export interface CoverageResult {
	success: boolean;
	message: string;
	evidence: CoverageEvidence[];
	details: CoverageDetail[];
}

export interface CoverageEvidence {
	type: 'valid' | 'violation';
	count: number;
	required: number;
	description: string;
}

export interface CoverageDetail {
	exampleIndex: number;
	lineNumber: number;
	lineText: string;
	type: 'valid' | 'violation';
	violationIndex?: number;
	markerType: 'combined' | 'inline' | 'section';
}

export interface ViolationMarker {
	lineNumber: number;
	description: string;
	isViolation: boolean;
	index: number;
	sectionIndex?: number;
}

export interface ExampleData {
	content: string;
	exampleIndex: number;
	violations: string[];
	valids: string[];
	violationMarkers: ViolationMarker[];
	validMarkers: ViolationMarker[];
}

export interface RuleMetadata {
	description: string | null | undefined;
	message: string | null | undefined;
	ruleName: string | null | undefined;
	xpath: string | null | undefined;
}

export interface TestFileResult {
	filePath: string;
	hasViolations: boolean;
	hasValids: boolean;
	violationCount: number;
	validCount: number;
}

export interface PMDResult {
	violations: Violation[];
}

export interface Violation {
	line: number;
	column: number;
	message: string;
	rule: string;
	priority: number;
}

export interface TestResult {
	success: boolean;
	violations: Violation[];
	valids: Violation[];
	message: string;
	duration?: number;
}

export interface XPathCoverageResult {
	coverage: CoverageResult[];
	overallSuccess: boolean;
	uncoveredBranches: string[];
}

export interface TestCaseResult {
	exampleIndex: number;
	testType: 'valid' | 'violation';
	passed: boolean;
	lineNumber?: number;
	description: string;
}

export interface OverallTestResults {
	success: boolean;
	testResults: TestResult[];
	examplesTested: number;
	examplesPassed: number;
	totalViolations: number;
	ruleTriggersViolations: boolean;
	xpathCoverage: XPathCoverageResult;
	hardcodedValues: HardcodedValueIssue[];
	detailedTestResults?: TestCaseResult[];
}

export interface CLIArguments {
	ruleFile: string;
	verbose?: boolean;
	output?: string;
}

export interface FileOperationResult<T = void> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface ValidationResult {
	passed: boolean;
	issues: string[];
	warnings: string[];
}

export interface BranchCombination {
	type: 'valid' | 'violation';
	violationIndex?: number;
	sectionIndex?: number;
	signature: string;
	examples: number[];
}

export interface BranchTrackingResult {
	combinations: BranchCombination[];
	redundant: BranchCombination[];
	coverage: number;
}
