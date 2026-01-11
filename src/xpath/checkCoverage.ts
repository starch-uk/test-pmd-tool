/**
 * @file
 * XPath coverage checking module. Checks if XPath components are covered in examples.
 */
import { readFileSync } from 'fs';
import type {
	CoverageResult,
	CoverageEvidence,
	ExampleData,
	XPathCoverageResult,
} from '../types/index.js';
import { analyzeXPath } from './analyzeXPath.js';

const MIN_COUNT = 0;
const NOT_FOUND_INDEX = -1;
const LINE_OFFSET = 1;

/**
 * Options for node type coverage checking.
 */
interface NodeTypeCoverageOptions {
	ruleFilePath?: Readonly<string>;
	xpath?: Readonly<string>;
}

/**
 * Find line number for a node type in the XPath within the XML file.
 * @param ruleFilePath - Path to the rule XML file.
 * @param xpath - XPath expression.
 * @param nodeType - Node type to find.
 * @returns Line number where node type appears, or null if not found.
 */
function findNodeTypeLineNumber(
	ruleFilePath: Readonly<string>,
	xpath: Readonly<string>,
	nodeType: Readonly<string>,
): number | null {
	try {
		const content = readFileSync(ruleFilePath, 'utf-8');
		const lines = content.split('\n');

		// Find the line containing the XPath value element
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Check if this line contains the XPath and the node type
			const hasXPath = line.includes('xpath');
			const hasValue = line.includes('value');
			const hasNodeType = line.includes(nodeType);
			if (hasXPath && hasValue && hasNodeType) {
				return i + LINE_OFFSET;
			}
		}

		// If not found in a single line, search for the XPath section and then the node type
		let inXPathSection = false;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.includes('<property') && line.includes('name="xpath"')) {
				inXPathSection = true;
			}
			if (inXPathSection && line.includes(nodeType)) {
				return i + LINE_OFFSET;
			}
			if (inXPathSection && line.includes('</property>')) {
				inXPathSection = false;
			}
		}

		// Fallback: find position in XPath string and estimate line
		const xpathIndex = xpath.indexOf(nodeType);
		if (xpathIndex !== NOT_FOUND_INDEX) {
			// Find the value element and count lines
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].includes('<value>')) {
					// Count newlines in XPath up to the node type position
					const xpathBeforeNodeType = xpath.substring(
						MIN_COUNT,
						xpathIndex,
					);
					const newlineMatches = xpathBeforeNodeType.match(/\n/g);
					// match() returns null if no match, or array if match found
					// Use 0 if no matches found (null case)
					const newlineCount = newlineMatches
						? newlineMatches.length
						: MIN_COUNT;
					return i + LINE_OFFSET + newlineCount;
				}
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Check if node types from XPath are present in example content.
 * @param nodeTypes - Node types to check.
 * @param content - Example content to search.
 * @param options - Optional options for line number tracking.
 * @returns Coverage evidence.
 */
function checkNodeTypeCoverage(
	nodeTypes: readonly string[],
	content: Readonly<string>,
	options?: Readonly<NodeTypeCoverageOptions>,
): CoverageEvidence {
	const lowerContent = content.toLowerCase();
	const foundNodeTypes: string[] = [];
	const missingNodeTypes: string[] = [];

	for (const nodeType of nodeTypes) {
		// Simple heuristic: check if keywords related to node type appear in content
		const nodeTypeLower = nodeType.toLowerCase();
		if (lowerContent.includes(nodeTypeLower)) {
			foundNodeTypes.push(nodeType);
		} else {
			missingNodeTypes.push(nodeType);
		}
	}

	// For missing items, add line numbers if available
	const missingList =
		missingNodeTypes.length > MIN_COUNT
			? missingNodeTypes
					.map((item) => {
						if (options !== undefined) {
							// When options is provided from checkXPathCoverage, both ruleFilePath and xpath
							// are always defined together (they're set together in checkXPathCoverage)
							// nodeTypeOptions is only created when both hasRuleFilePath && hasXpathValue are true
							const ruleFilePathValue = options.ruleFilePath;
							const xpathValue = options.xpath;
							// Both are guaranteed to be defined and non-empty when options is provided
							// (nodeTypeOptions is only created when both hasRuleFilePath && hasXpathValue are true at line 417)
							// The redundant check is removed to avoid unreachable branches
							/* eslint-disable @typescript-eslint/no-non-null-assertion */
							// Both are guaranteed when options is defined (see checkXPathCoverage line 417-419)
							const lineNumber = findNodeTypeLineNumber(
								ruleFilePathValue!,
								xpathValue!,
								item,
							);
							/* eslint-enable @typescript-eslint/no-non-null-assertion */
							return lineNumber !== null
								? ` - Line ${String(lineNumber)}: ${item}`
								: ` - ${item}`;
						}
						return ` - ${item}`;
					})
					.join('\n')
			: '';

	const missingText =
		missingNodeTypes.length > MIN_COUNT ? `Missing:\n${missingList}` : '';

	// Only include description if there are items to show
	// For node types, only show Missing section (Found is empty when count is 0)
	const description = missingText.length > MIN_COUNT ? missingText : '';

	return {
		count: foundNodeTypes.length,
		description,
		required: nodeTypes.length,
		type: 'violation',
	};
}

const MAX_EXPRESSION_LENGTH = 50;

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
	const foundConditionals: string[] = [];
	const missingConditionals: string[] = [];

	for (const conditional of conditionals) {
		const exprLower = conditional.expression.toLowerCase();
		// Check if conditional expression keywords appear in content
		if (lowerContent.includes(exprLower) || lowerContent.includes('if')) {
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
			missingConditionals.push(` - ${conditional.type}: ${displayExpr}`);
		}
	}

	// For conditionals, we'll format them line by line in the CLI
	// Store them as arrays for better formatting
	const foundList =
		foundConditionals.length > MIN_COUNT ? foundConditionals : [];
	const missingList =
		missingConditionals.length > MIN_COUNT ? missingConditionals : [];

	const foundText = foundList.length > MIN_COUNT ? foundList.join('\n') : '';
	const missingText =
		missingList.length > MIN_COUNT
			? `Missing:\n${missingList.join('\n')}`
			: '';

	// Format with "Covered:" prefix for conditionals
	const coveredText =
		foundText.length > MIN_COUNT ? `Covered:\n${foundText}` : '';

	// Only include description if there are items to show
	const hasCovered = coveredText.length > MIN_COUNT;
	const hasMissing = missingText.length > MIN_COUNT;
	let description = '';
	if (hasCovered) {
		description = hasMissing
			? `${coveredText}\n${missingText}`
			: coveredText;
	}
	if (!hasCovered && hasMissing) {
		description = missingText;
	}
	// Note: If both are empty, description remains empty string (unreachable in practice)

	return {
		count: foundConditionals.length,
		description,
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
	const missingAttributes: string[] = [];

	for (const attr of attributes) {
		const attrLower = attr.toLowerCase();
		if (lowerContent.includes(attrLower)) {
			foundAttributes.push(attr);
		} else {
			missingAttributes.push(attr);
		}
	}

	const foundList =
		foundAttributes.length > MIN_COUNT
			? foundAttributes.map((item) => ` - ${item}`).join('\n')
			: '';
	const missingList =
		missingAttributes.length > MIN_COUNT
			? missingAttributes.map((item) => ` - ${item}`).join('\n')
			: '';

	const foundText = foundList;
	const missingText =
		missingAttributes.length > MIN_COUNT ? `Missing:\n${missingList}` : '';

	// Only include description if there are items to show
	// For attributes, show found items directly (no "Found:" prefix) and missing items
	const hasFound = foundText.length > MIN_COUNT;
	const hasMissing = missingText.length > MIN_COUNT;
	let description = '';
	if (hasFound) {
		description = hasMissing ? `${foundText}\n${missingText}` : foundText;
	}
	if (!hasFound && hasMissing) {
		description = missingText;
	}
	// Note: If both are empty, description remains empty string (unreachable in practice)

	return {
		count: foundAttributes.length,
		description,
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

	const foundList =
		foundOperators.length > MIN_COUNT
			? foundOperators.map((item) => ` - ${item}`).join('\n')
			: '';
	const missingList =
		missingOperators.length > MIN_COUNT
			? missingOperators.map((item) => ` - ${item}`).join('\n')
			: '';

	const foundText = foundList;
	const missingText =
		missingOperators.length > MIN_COUNT ? `Missing:\n${missingList}` : '';

	// Only include description if there are items to show
	const hasFound = foundText.length > MIN_COUNT;
	const hasMissing = missingText.length > MIN_COUNT;
	let description = '';
	if (hasFound) {
		description = hasMissing ? `${foundText}\n${missingText}` : foundText;
	}
	if (!hasFound && hasMissing) {
		description = missingText;
	}
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
	const allContent = examples
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for map
		.map((ex) => ex.content)
		.join('\n')
		.toLowerCase();

	const coverageResults: CoverageResult[] = [];
	const uncoveredBranches: string[] = [];

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
				? { ruleFilePath: ruleFilePathValue, xpath: xpathValue }
				: undefined;
		const nodeTypeEvidence = checkNodeTypeCoverage(
			analysis.nodeTypes,
			allContent,
			nodeTypeOptions,
		);
		const nodeTypeSuccess =
			nodeTypeEvidence.count >= nodeTypeEvidence.required;
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
			conditionalEvidence.count >= conditionalEvidence.required;
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
		const operatorEvidence = checkOperatorCoverage(
			analysis.operators,
			allContent,
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
		overallSuccess,
		uncoveredBranches,
	};
}
