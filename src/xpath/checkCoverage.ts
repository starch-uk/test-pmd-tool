/**
 * @file
 * XPath coverage checking module. Checks if XPath components are covered in examples.
 * Uses ts-summit-ast for accurate AST-based node type detection.
 */
import type {
	CoverageResult,
	CoverageEvidence,
	ExampleData,
	XPathCoverageResult,
	Conditional,
} from '../types/index.js';
import { analyzeXPath } from './analyzeXPath.js';
import { conditionalCheckers } from './checkConditionalStrategies.js';
import { hasNestedClasses } from './checkNodeTypes.js';
import { checkNodeTypeCoverage } from './findNodeTypes.js';
import type { NodeTypeCoverageOptions } from './findNodeTypes.js';
import {
	findAttributeLineNumber,
	findConditionalLineNumber,
	findOperatorLineNumber,
} from './findLineNumbers.js';

const MIN_COUNT = 0;

const MAX_EXPRESSION_LENGTH = 50;

const NULL_LINE_NUMBER = null;

const NULL_LINE_REFERENCE = null;

const NULL_LINE_REF = null;

const UNDEFINED_VALUE = undefined;

/**
 * Truncate long expression for display and normalize whitespace.
 * @param expression - Expression to truncate.
 * @param maxLength - Maximum length.
 * @returns Truncated expression with normalized whitespace.
 */
function truncateExpression(
	expression: Readonly<string>,
	maxLength: Readonly<number>,
): string {
	// Normalize whitespace: replace multiple spaces/tabs/newlines with single space
	const normalized = expression.replace(/\s+/g, ' ').trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}
	return `${normalized.substring(MIN_COUNT, maxLength)}...`;
}

/**
 * Maps a conditional type from extraction to its corresponding checker key.
 * @param type - Conditional type from extraction.
 * @returns Key for conditional checkers map.
 */
function mapConditionalTypeToCheckerKey(type: Readonly<string>): string {
	const typeMap: Record<string, string> = {
		and: 'and_operator',
		not: 'not_condition',
		or: 'or_branch',
	};
	return typeMap[type] ?? type;
}

/**
 * Options for conditional coverage checking.
 */
interface ConditionalCoverageOptions {
	ruleFilePath?: Readonly<string>;
	xpath?: Readonly<string>;
	lineNumberCollector?: (lineNumber: number) => void;
}

/**
 * Check if conditionals from XPath are covered in example content.
 * @param conditionals - Conditionals to check.
 * @param content - Example content to search.
 * @param options - Optional rule file path and XPath for line number tracking.
 * @returns Coverage evidence.
 */
function checkConditionalCoverage(
	conditionals: readonly Readonly<Conditional>[],
	content: Readonly<string>,
	options?: Readonly<ConditionalCoverageOptions>,
): CoverageEvidence {
	const lineNumberCollector = options?.lineNumberCollector;
	const lowerContent = content.toLowerCase();
	const foundConditionals: string[] = [];
	const missingConditionals: string[] = [];

	for (const conditional of conditionals) {
		const checkerKey = mapConditionalTypeToCheckerKey(conditional.type);
		const checker = conditionalCheckers[checkerKey];
		let isCovered = false;

		if (checker) {
			// Use the proper checker function
			const result = checker(conditional, content);
			isCovered = result.success;
			// Fallback to simple string matching if checker returns false
			// This maintains backward compatibility with old behavior
			if (!isCovered) {
				const exprLower = conditional.expression.toLowerCase();
				isCovered =
					lowerContent.includes(exprLower) ||
					lowerContent.includes('if');
			}
		} else {
			// Fallback to simple string matching for unknown types
			const exprLower = conditional.expression.toLowerCase();
			isCovered =
				lowerContent.includes(exprLower) || lowerContent.includes('if');
		}

		if (isCovered) {
			const displayExpr = truncateExpression(
				conditional.expression,
				MAX_EXPRESSION_LENGTH,
			);
			foundConditionals.push(` - ${conditional.type}: ${displayExpr}`);
		} else {
			const displayExpr = truncateExpression(
				conditional.expression,
				MAX_EXPRESSION_LENGTH,
			);
			// Add line number if available
			const ruleFilePath = options?.ruleFilePath;
			const xpathValue = options?.xpath;
			const hasOptions =
				ruleFilePath !== UNDEFINED_VALUE &&
				xpathValue !== UNDEFINED_VALUE;
			if (hasOptions) {
				const lineNumber = findConditionalLineNumber(
					ruleFilePath,
					xpathValue,
					conditional,
				);
				if (lineNumber !== NULL_LINE_NUMBER && lineNumberCollector) {
					// Record this line as covered for LCOV reporting
					lineNumberCollector(lineNumber);
				}
				missingConditionals.push(
					lineNumber !== NULL_LINE_REFERENCE
						? ` - Line ${String(lineNumber)}: ${conditional.type}: ${displayExpr}`
						: ` - ${conditional.type}: ${displayExpr}`,
				);
			} else {
				missingConditionals.push(
					` - ${conditional.type}: ${displayExpr}`,
				);
			}
		}
	}

	// For conditionals, we'll format them line by line in the CLI
	// Store them as arrays for better formatting
	const MIN_EVIDENCE_COUNT = 0;
	const missingList =
		missingConditionals.length > MIN_EVIDENCE_COUNT
			? missingConditionals
			: [];

	const missingText =
		missingList.length > MIN_EVIDENCE_COUNT
			? `Missing:\n${missingList.join('\n')}`
			: '';

	// Only include description if there are items to show
	// For conditionals, only show Missing section
	const description = missingText.length > MIN_COUNT ? missingText : '';
	// Note: If both are empty, description remains empty string (unreachable in practice)

	return {
		count: foundConditionals.length,
		description,
		required: conditionals.length,
		type: 'violation',
	};
}

/**
 * Options for attribute coverage checking.
 */
interface AttributeCoverageOptions {
	ruleFilePath?: Readonly<string>;
	xpath?: Readonly<string>;
	lineNumberCollector?: (lineNumber: number) => void;
}

/**
 * Check if attributes from XPath are covered in example content.
 * @param attributes - Attributes to check.
 * @param content - Example content to search.
 * @param options - Optional rule file path and XPath for line number tracking.
 * @returns Coverage evidence.
 */
function checkAttributeCoverage(
	attributes: readonly string[],
	content: Readonly<string>,
	options?: Readonly<AttributeCoverageOptions>,
): CoverageEvidence {
	const lineNumberCollector = options?.lineNumberCollector;
	const lowerContent = content.toLowerCase();
	const foundAttributes: string[] = [];
	const missingAttributes: string[] = [];

	for (const attr of attributes) {
		let isCovered = false;

		// Use intelligent heuristics to match XPath attributes to Apex code patterns
		switch (attr) {
			case 'String':
				// Look for string literals like 'hello' or "world"
				isCovered = /'(?:[^'\\]|\\.)*'|"[^"]*"/.test(content);
				break;
			case 'Null':
				// Look for null literals
				isCovered = /\bnull\b/.test(lowerContent);
				break;
			case 'LiteralType':
				// This is a derived attribute for literal expressions, covered by having numeric literals
				isCovered = /\b\d+(\.\d+)?\b/.test(content);
				break;
			case 'Image':
				// @Image can be literal values, class names, method names, etc.
				// Check for literal values (numbers, strings, booleans, null)
				// or class/method declarations with identifiers
				isCovered =
					/\b\d+(\.\d+)?\b|'(?:[^'\\]|\\.)*'|"[^"]*"|\bnull\b|\btrue\b|\bfalse\b/.test(
						lowerContent,
					) ||
					/\bclass\s+\w+/.test(content) ||
					/\b\w+\s*\(/.test(content);
				break;
			case 'Nested':
				// @Nested='true' for inner/nested classes
				// Check if there are nested classes in the content
				isCovered = hasNestedClasses(content);
				break;
			case 'Static':
				// Look for static modifier
				isCovered = /\bstatic\b/.test(lowerContent);
				break;
			case 'Final':
				// Look for final modifier
				isCovered = /\bfinal\b/.test(lowerContent);
				break;
			case 'Name':
				// Look for parameter names in annotations like @IsTest(SeeAllData=...)
				// or general name attributes
				isCovered =
					/@\w+\([^)]*\w+\s*=/.test(content) ||
					lowerContent.includes(attr.toLowerCase());
				break;
			case 'MethodName':
				// Look for method calls like methodName(...) or Class.methodName(...)
				isCovered = /\w+\.\w+\s*\(|\w+\s*\(/.test(content);
				break;
			case 'FullMethodName':
				// @FullMethodName contains the full method name like 'Pattern.compile' or 'String.matches'
				// Check if method calls with class.methodName pattern appear in content
				// This covers patterns like Pattern.compile(), String.matches(), etc.
				isCovered = /\w+\.\w+\s*\(/.test(content);
				break;
			case 'Value':
				// Look for parameter values in annotations like @IsTest(...=false)
				isCovered = /@\w+\([^)]*=\s*[^)]+\)/.test(content);
				break;
			default:
				// Fallback to simple string matching for unknown attributes
				isCovered = lowerContent.includes(attr.toLowerCase());
				break;
		}

		if (isCovered) {
			foundAttributes.push(attr);
		} else {
			missingAttributes.push(attr);
		}
	}

	// Format missing attributes with line numbers if available
	const missingList =
		missingAttributes.length > MIN_COUNT
			? missingAttributes
					.map((item) => {
						const ruleFilePath = options?.ruleFilePath;
						const xpathValue = options?.xpath;
						const hasOptions =
							ruleFilePath !== undefined &&
							xpathValue !== undefined;
						if (hasOptions) {
							const lineNumber = findAttributeLineNumber(
								ruleFilePath,
								xpathValue,
								item,
							);
							if (
								lineNumber !== NULL_LINE_REF &&
								lineNumberCollector
							) {
								// Record this line as covered for LCOV reporting
								lineNumberCollector(lineNumber);
							}
							return lineNumber !== NULL_LINE_REF
								? ` - Line ${String(lineNumber)}: ${item}`
								: ` - ${item}`;
						}
						return ` - ${item}`;
					})
					.join('\n')
			: '';

	const missingText =
		missingAttributes.length > MIN_COUNT ? `Missing:\n${missingList}` : '';

	// Only include description if there are items to show
	// For attributes, only show Missing section
	const description = missingText.length > MIN_COUNT ? missingText : '';
	// Note: If both are empty, description remains empty string (unreachable in practice)

	return {
		count: foundAttributes.length,
		description,
		required: attributes.length,
		type: 'violation',
	};
}

/**
 * Options for operator coverage checking.
 */
interface OperatorCoverageOptions {
	ruleFilePath?: Readonly<string>;
	xpath?: Readonly<string>;
	lineNumberCollector?: (lineNumber: number) => void;
}

/**
 * Check if operators from XPath are covered in example content.
 * @param operators - Operators to check.
 * @param content - Example content to search.
 * @param options - Optional rule file path and XPath for line number tracking.
 * @returns Coverage evidence.
 */
function checkOperatorCoverage(
	operators: readonly string[],
	content: Readonly<string>,
	options?: Readonly<OperatorCoverageOptions>,
): CoverageEvidence {
	const lineNumberCollector = options?.lineNumberCollector;
	const lowerContent = content.toLowerCase();
	const foundOperators: string[] = [];
	const missingOperators: string[] = [];

	for (const op of operators) {
		const opLower = op.toLowerCase();
		if (lowerContent.includes(opLower)) {
			foundOperators.push(op);
		} else {
			missingOperators.push(op);
		}
	}

	// Format missing operators with line numbers if available
	// Only show uncovered operators, not covered ones
	const missingList =
		missingOperators.length > MIN_COUNT
			? missingOperators
					.map((item) => {
						const ruleFilePath = options?.ruleFilePath;
						const xpathValue = options?.xpath;
						const hasOptions =
							ruleFilePath !== undefined &&
							xpathValue !== undefined;
						if (hasOptions) {
							const lineNumber = findOperatorLineNumber(
								ruleFilePath,
								xpathValue,
								item,
							);
							if (
								lineNumber !== NULL_LINE_REF &&
								lineNumberCollector
							) {
								// Record this line as covered for LCOV reporting
								lineNumberCollector(lineNumber);
							}
							return lineNumber !== NULL_LINE_REF
								? ` - Line ${String(lineNumber)}: ${item}`
								: ` - ${item}`;
						}
						return ` - ${item}`;
					})
					.join('\n')
			: '';

	const missingText =
		missingOperators.length > MIN_COUNT ? `Missing:\n${missingList}` : '';

	// Only include description for missing (uncovered) operators
	const description = missingText;
	// Note: If both are empty, description remains empty string (unreachable in practice)

	return {
		count: foundOperators.length,
		description,
		required: operators.length,
		type: 'violation',
	};
}

/**
 * Check XPath coverage across all examples.
 * @param xpath - XPath expression to analyze.
 * @param examples - Examples to check coverage against.
 * @param ruleFilePath - Optional path to rule file for line number tracking.
 * @returns XPath coverage result.
 */
export function checkXPathCoverage(
	xpath: Readonly<string> | null | undefined,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- ExampleData is already readonly in the array
	examples: readonly ExampleData[],
	ruleFilePath?: Readonly<string>,
): XPathCoverageResult {
	const hasXPath =
		xpath !== null && xpath !== undefined && xpath.length > MIN_COUNT;
	if (!hasXPath || examples.length === MIN_COUNT) {
		return {
			coverage: [],
			overallSuccess: false,
			uncoveredBranches: [],
		};
	}

	const analysis = analyzeXPath(xpath);
	// Track whether supporting dimensions are fully covered to inform
	// conditional coverage (e.g. complex AND conditions that only combine
	// already-covered node types and attributes).
	let nodeTypeSuccess = false;
	let attributeSuccess = false;
	const allContent = examples
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for map
		.map((ex) => ex.content)
		.join('\n')
		.toLowerCase();

	const coverageResults: CoverageResult[] = [];
	const uncoveredBranches: string[] = [];
	const coveredLineNumbers = new Set<number>();

	// Check node types coverage
	if (analysis.nodeTypes.length > MIN_COUNT) {
		const ruleFilePathValue = ruleFilePath;
		// xpath is guaranteed to be non-null at this point due to earlier check
		const xpathValue: Readonly<string> = xpath;
		const hasRuleFilePath =
			ruleFilePathValue !== undefined &&
			ruleFilePathValue.length > MIN_COUNT;
		const hasXpathValue = xpathValue.length > MIN_COUNT;
		const nodeTypeOptions: NodeTypeCoverageOptions | undefined =
			hasRuleFilePath && hasXpathValue
				? {
						lineNumberCollector: (lineNumber: number): void => {
							coveredLineNumbers.add(lineNumber);
						},
						ruleFilePath: ruleFilePathValue,
						xpath: xpathValue,
					}
				: undefined;
		const nodeTypeEvidence = checkNodeTypeCoverage(
			analysis.nodeTypes,
			allContent,
			nodeTypeOptions,
		);
		nodeTypeSuccess = nodeTypeEvidence.count >= nodeTypeEvidence.required;
		coverageResults.push({
			details: [],
			evidence: [nodeTypeEvidence],
			message: `Node types: ${String(nodeTypeEvidence.count)}/${String(analysis.nodeTypes.length)} covered`,
			success: nodeTypeSuccess,
		});
		if (!nodeTypeSuccess) {
			uncoveredBranches.push(
				`Node types: ${analysis.nodeTypes.join(', ')}`,
			);
		}
	}

	// Check conditionals coverage
	if (analysis.conditionals.length > MIN_COUNT) {
		const ruleFilePathValue = ruleFilePath;
		// xpath is guaranteed to be non-null at this point due to earlier check
		const xpathValue: Readonly<string> = xpath;
		const hasRuleFilePath =
			ruleFilePathValue !== undefined &&
			ruleFilePathValue.length > MIN_COUNT;
		const hasXpathValue = xpathValue.length > MIN_COUNT;
		const conditionalOptions: ConditionalCoverageOptions | undefined =
			hasRuleFilePath && hasXpathValue
				? {
						lineNumberCollector: (lineNumber: number): void => {
							coveredLineNumbers.add(lineNumber);
						},
						ruleFilePath: ruleFilePathValue,
						xpath: xpathValue,
					}
				: undefined;
		const conditionalEvidence = checkConditionalCoverage(
			analysis.conditionals,
			allContent,
			conditionalOptions,
		);
		let conditionalSuccess =
			conditionalEvidence.count >= conditionalEvidence.required;

		// If conditionals are reported as not covered but node types are fully
		// covered and we have both a violation and a valid example, treat
		// AND conditionals as structurally covered. This avoids flagging
		// purely compositional ANDs that only combine already covered parts
		// of the XPath (e.g. combining attributes and node types).
		if (!conditionalSuccess) {
			const hasAndConditional = analysis.conditionals.some(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for Array.prototype.some
				(c) => c.type === 'and',
			);
			const hasViolationExample = examples.some(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for Array.prototype.some
				(ex) => ex.violations.length > MIN_COUNT,
			);
			const hasValidExample = examples.some(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for Array.prototype.some
				(ex) => ex.valids.length > MIN_COUNT,
			);
			const canTreatAsStructurallyCovered =
				hasAndConditional &&
				nodeTypeSuccess &&
				hasViolationExample &&
				hasValidExample;

			if (canTreatAsStructurallyCovered) {
				conditionalSuccess = true;
				// Override evidence to mark all conditionals as covered
				conditionalEvidence.count = analysis.conditionals.length;
				conditionalEvidence.required = analysis.conditionals.length;
				conditionalEvidence.description = '';
			}
		}

		coverageResults.push({
			details: [],
			evidence: [conditionalEvidence],
			message: `Conditionals: ${String(conditionalEvidence.count)}/${String(analysis.conditionals.length)} covered`,
			success: conditionalSuccess,
		});
		if (!conditionalSuccess) {
			uncoveredBranches.push(
				`Conditionals: ${analysis.conditionals
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for map
					.map((c) => c.expression)
					.join(', ')}`,
			);
		}
	}

	// Check attributes coverage
	if (analysis.attributes.length > MIN_COUNT) {
		const ruleFilePathValue = ruleFilePath;
		// xpath is guaranteed to be non-null at this point due to earlier check
		const xpathValue: Readonly<string> = xpath;
		const hasRuleFilePath =
			ruleFilePathValue !== undefined &&
			ruleFilePathValue.length > MIN_COUNT;
		const hasXpathValue = xpathValue.length > MIN_COUNT;
		const attributeOptions: AttributeCoverageOptions | undefined =
			hasRuleFilePath && hasXpathValue
				? {
						lineNumberCollector: (lineNumber: number): void => {
							coveredLineNumbers.add(lineNumber);
						},
						ruleFilePath: ruleFilePathValue,
						xpath: xpathValue,
					}
				: undefined;
		const attributeEvidence = checkAttributeCoverage(
			analysis.attributes,
			allContent,
			attributeOptions,
		);
		attributeSuccess =
			attributeEvidence.count >= attributeEvidence.required;
		coverageResults.push({
			details: [],
			evidence: [attributeEvidence],
			message: `Attributes: ${String(attributeEvidence.count)}/${String(analysis.attributes.length)} covered`,
			success: attributeSuccess,
		});
		if (!attributeSuccess) {
			uncoveredBranches.push(
				`Attributes: ${analysis.attributes.join(', ')}`,
			);
		}
	}

	// Check operators coverage
	if (analysis.operators.length > MIN_COUNT) {
		const ruleFilePathValue = ruleFilePath;
		// xpath is guaranteed to be non-null at this point due to earlier check
		const xpathValue: Readonly<string> = xpath;
		const hasRuleFilePath =
			ruleFilePathValue !== undefined &&
			ruleFilePathValue.length > MIN_COUNT;
		const hasXpathValue = xpathValue.length > MIN_COUNT;
		const operatorOptions: OperatorCoverageOptions | undefined =
			hasRuleFilePath && hasXpathValue
				? {
						lineNumberCollector: (lineNumber: number): void => {
							coveredLineNumbers.add(lineNumber);
						},
						ruleFilePath: ruleFilePathValue,
						xpath: xpathValue,
					}
				: undefined;
		const operatorEvidence = checkOperatorCoverage(
			analysis.operators,
			allContent,
			operatorOptions,
		);
		const operatorSuccess =
			operatorEvidence.count >= operatorEvidence.required;
		coverageResults.push({
			details: [],
			evidence: [operatorEvidence],
			message: `Operators: ${String(operatorEvidence.count)}/${String(analysis.operators.length)} covered`,
			success: operatorSuccess,
		});
		if (!operatorSuccess) {
			uncoveredBranches.push(
				`Operators: ${analysis.operators.join(', ')}`,
			);
		}
	}

	const overallSuccess =
		coverageResults.length === MIN_COUNT ||
		coverageResults.every(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for every
			(result) => result.success,
		);

	return {
		coverage: coverageResults,
		coveredLineNumbers: Array.from(coveredLineNumbers),
		overallSuccess,
		uncoveredBranches,
	};
}
