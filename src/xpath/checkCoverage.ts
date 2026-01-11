/**
 * @file
 * XPath coverage checking module. Checks if XPath components are covered in examples.
 */
import type {
	CoverageResult,
	CoverageEvidence,
	ExampleData,
	XPathCoverageResult,
} from '../types/index.js';
import { analyzeXPath } from './analyzeXPath.js';

const MIN_COUNT = 0;
const MIN_REQUIRED_NODE_TYPES = 1;
const MIN_REQUIRED_CONDITIONALS = 1;
const MIN_REQUIRED_ATTRIBUTES = 1;
const MIN_REQUIRED_OPERATORS = 1;

/**
 * Check if node types from XPath are present in example content.
 * @param nodeTypes - Node types to check.
 * @param content - Example content to search.
 * @returns Coverage evidence.
 */
function checkNodeTypeCoverage(
	nodeTypes: readonly string[],
	content: Readonly<string>,
): CoverageEvidence {
	const lowerContent = content.toLowerCase();
	const foundNodeTypes: string[] = [];

	for (const nodeType of nodeTypes) {
		// Simple heuristic: check if keywords related to node type appear in content
		const nodeTypeLower = nodeType.toLowerCase();
		if (lowerContent.includes(nodeTypeLower)) {
			foundNodeTypes.push(nodeType);
		}
	}

	return {
		count: foundNodeTypes.length,
		description: `Node types covered: ${foundNodeTypes.join(', ') || 'none'}`,
		required: nodeTypes.length,
		type: 'violation',
	};
}

/**
 * Check if conditionals from XPath are covered in example content.
 * @param conditionals - Conditionals to check.
 * @param content - Example content to search.
 * @returns Coverage evidence.
 */
function checkConditionalCoverage(
	conditionals: readonly Readonly<{ expression: string; type: string }>[],
	content: Readonly<string>,
): CoverageEvidence {
	const lowerContent = content.toLowerCase();
	let coveredCount = MIN_COUNT;

	for (const conditional of conditionals) {
		const exprLower = conditional.expression.toLowerCase();
		// Check if conditional expression keywords appear in content
		if (lowerContent.includes(exprLower) || lowerContent.includes('if')) {
			coveredCount++;
		}
	}

	return {
		count: coveredCount,
		description: `Conditionals covered: ${String(coveredCount)}/${String(conditionals.length)}`,
		required: conditionals.length,
		type: 'violation',
	};
}

/**
 * Check if attributes from XPath are covered in example content.
 * @param attributes - Attributes to check.
 * @param content - Example content to search.
 * @returns Coverage evidence.
 */
function checkAttributeCoverage(
	attributes: readonly string[],
	content: Readonly<string>,
): CoverageEvidence {
	const lowerContent = content.toLowerCase();
	const foundAttributes: string[] = [];

	for (const attr of attributes) {
		const attrLower = attr.toLowerCase();
		if (lowerContent.includes(attrLower)) {
			foundAttributes.push(attr);
		}
	}

	return {
		count: foundAttributes.length,
		description: `Attributes covered: ${foundAttributes.join(', ') || 'none'}`,
		required: attributes.length,
		type: 'violation',
	};
}

/**
 * Check if operators from XPath are covered in example content.
 * @param operators - Operators to check.
 * @param content - Example content to search.
 * @returns Coverage evidence.
 */
function checkOperatorCoverage(
	operators: readonly string[],
	content: Readonly<string>,
): CoverageEvidence {
	const lowerContent = content.toLowerCase();
	let coveredCount = MIN_COUNT;

	for (const op of operators) {
		const opLower = op.toLowerCase();
		if (lowerContent.includes(opLower)) {
			coveredCount++;
		}
	}

	return {
		count: coveredCount,
		description: `Operators covered: ${String(coveredCount)}/${String(operators.length)}`,
		required: operators.length,
		type: 'violation',
	};
}

/**
 * Check XPath coverage across all examples.
 * @param xpath - XPath expression to analyze.
 * @param examples - Examples to check coverage against.
 * @returns XPath coverage result.
 */
export function checkXPathCoverage(
	xpath: Readonly<string> | null | undefined,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- ExampleData is already readonly in the array
	examples: readonly ExampleData[],
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
	const allContent = examples
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for map
		.map((ex) => ex.content)
		.join('\n')
		.toLowerCase();

	const coverageResults: CoverageResult[] = [];
	const uncoveredBranches: string[] = [];

	// Check node types coverage
	if (analysis.nodeTypes.length > MIN_COUNT) {
		const nodeTypeEvidence = checkNodeTypeCoverage(
			analysis.nodeTypes,
			allContent,
		);
		const nodeTypeSuccess =
			nodeTypeEvidence.count >= MIN_REQUIRED_NODE_TYPES;
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
		const conditionalEvidence = checkConditionalCoverage(
			analysis.conditionals,
			allContent,
		);
		const conditionalSuccess =
			conditionalEvidence.count >= MIN_REQUIRED_CONDITIONALS;
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
		const attributeEvidence = checkAttributeCoverage(
			analysis.attributes,
			allContent,
		);
		const attributeSuccess =
			attributeEvidence.count >= MIN_REQUIRED_ATTRIBUTES;
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
		const operatorEvidence = checkOperatorCoverage(
			analysis.operators,
			allContent,
		);
		const operatorSuccess =
			operatorEvidence.count >= MIN_REQUIRED_OPERATORS;
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
		overallSuccess,
		uncoveredBranches,
	};
}
