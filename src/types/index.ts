/**
 * @file
 * TypeScript type definitions for the PMD Rule Tester.
 */
interface XPathAnalysis {
	nodeTypes: string[];
	operators: string[];
	attributes: string[];
	conditionals: Conditional[];
	hasUnions: boolean;
	hasLetExpressions: boolean;
	patterns: string[];
}

interface Conditional {
	type: string;
	expression: string;
	position: number;
}

interface HardcodedValueIssue {
	type: 'array' | 'attribute' | 'number';
	value: string;
	recommendation: string;
	severity: 'error' | 'warning';
}

interface CoverageResult {
	success: boolean;
	message: string;
	evidence: CoverageEvidence[];
	details: CoverageDetail[];
}

interface CoverageEvidence {
	type: 'valid' | 'violation';
	count: number;
	required: number;
	description: string;
}

interface CoverageDetail {
	exampleIndex: number;
	lineNumber: number;
	lineText: string;
	type: 'valid' | 'violation';
	violationIndex?: number;
	markerType: 'combined' | 'inline' | 'section';
}

interface ViolationMarker {
	lineNumber: number;
	description: string;
	isViolation: boolean;
	index: number;
	sectionIndex?: number;

	/**
	 * AST-based code span information (start/end line and column).
	 * Provides precise location for color coding and visualization.
	 */
	codeSpan?: {
		startLine: number;
		startColumn: number;
		endLine: number;
		endColumn: number;
	};

	/**
	 * AST node type that this marker applies to (e.g., 'MethodDeclaration', 'VariableDeclaration').
	 * Helps identify which code element is marked.
	 */
	astNodeType?: string;

	/**
	 * The actual code text that this marker applies to.
	 * Extracted from the source using AST location information.
	 */
	codeText?: string;
}

interface ExampleData {
	content: string;
	exampleIndex: number;
	violations: string[];
	valids: string[];
	violationMarkers: ViolationMarker[];
	validMarkers: ViolationMarker[];
}

interface RuleMetadata {
	description: string | null | undefined;
	message: string | null | undefined;
	ruleName: string | null | undefined;
	xpath: string | null | undefined;
}

interface TestFileResult {
	filePath: string;
	hasViolations: boolean;
	hasValids: boolean;
	violationCount: number;
	validCount: number;
	wrapperInfo?: {
		addedWrapperClass: boolean;
		wrapperClassName: string;
		addedWrapperMethod: boolean;
		wrapperMethodName: string;
		helperMethodNames: string[];
	};
}

interface PMDResult {
	violations: Violation[];
}

interface Violation {
	line: number;
	column: number;
	message: string;
	rule: string;
	priority: number;
}

interface TestResult {
	success: boolean;
	violations: Violation[];
	valids: Violation[];
	message: string;
	duration?: number;
}

interface XPathCoverageResult {
	coverage: CoverageResult[];
	overallSuccess: boolean;
	uncoveredBranches: string[];

	/**
	 * Line numbers in the XML file that are covered.
	 */
	coveredLineNumbers?: number[];
}

interface TestCaseResult {
	exampleIndex: number;
	testType: 'valid' | 'violation';
	passed: boolean;
	lineNumber?: number;
	description: string;
}

interface OverallTestResults {
	success: boolean;
	testResults: TestResult[];
	examplesTested: number;
	examplesPassed: number;
	totalViolations: number;
	ruleTriggersViolations: boolean;
	xpathCoverage: XPathCoverageResult;
	hardcodedValues: HardcodedValueIssue[];
	detailedTestResults?: TestCaseResult[];
	qualityChecks?: ValidationResult;
}

interface CLIArguments {
	ruleFile: string;
	verbose?: boolean;
	output?: string;
}

interface FileOperationResult<T = void> {
	success: boolean;
	data?: T;
	error?: string;
}

interface ValidationResult {
	passed: boolean;
	issues: string[];
	warnings: string[];
}

interface BranchCombination {
	type: 'valid' | 'violation';
	violationIndex?: number;
	sectionIndex?: number;
	signature: string;
	examples: number[];
}

interface BranchTrackingResult {
	combinations: BranchCombination[];
	redundant: BranchCombination[];
	coverage: number;
}

export type {
	XPathAnalysis,
	Conditional,
	HardcodedValueIssue,
	CoverageResult,
	CoverageEvidence,
	CoverageDetail,
	ViolationMarker,
	ExampleData,
	RuleMetadata,
	TestFileResult,
	PMDResult,
	Violation,
	TestResult,
	XPathCoverageResult,
	TestCaseResult,
	OverallTestResults,
	CLIArguments,
	FileOperationResult,
	ValidationResult,
	BranchCombination,
	BranchTrackingResult,
};
