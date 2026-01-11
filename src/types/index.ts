/**
 * TypeScript type definitions for the PMD Rule Tester
 */

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
	type: 'attribute' | 'number' | 'array';
	value: string;
	recommendation: string;
	severity: 'warning' | 'error';
}

export interface CoverageResult {
	success: boolean;
	message: string;
	evidence: CoverageEvidence[];
	details: CoverageDetail[];
}

export interface CoverageEvidence {
	type: 'violation' | 'valid';
	count: number;
	required: number;
	description: string;
}

export interface CoverageDetail {
	exampleIndex: number;
	lineNumber: number;
	lineText: string;
	type: 'violation' | 'valid';
	violationIndex?: number;
	markerType: 'inline' | 'section' | 'combined';
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
	violations: string[];
	valids: string[];
	violationMarkers: ViolationMarker[];
	validMarkers: ViolationMarker[];
}

export interface RuleMetadata {
	ruleName: string | null | undefined;
	message: string | null | undefined;
	description: string | null | undefined;
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

export interface OverallTestResults {
	success: boolean;
	testResults: TestResult[];
	examplesTested: number;
	examplesPassed: number;
	totalViolations: number;
	ruleTriggersViolations: boolean;
	xpathCoverage: XPathCoverageResult;
	hardcodedValues: HardcodedValueIssue[];
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
	type: 'violation' | 'valid';
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
