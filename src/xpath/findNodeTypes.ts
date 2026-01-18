/**
 * @file
 * Node type finding utilities for XPath coverage checking.
 * Finds node types in AST and checks coverage in example content.
 */
import type { ASTNode } from 'ts-summit-ast';
import type { CoverageEvidence } from '../types/index.js';
import { parseApexCode } from '../parser/apexParser.js';
import { findNodeTypeLineNumber } from './findLineNumbers.js';

const MIN_COUNT = 0;

/**
 * Options for node type coverage checking.
 */
interface NodeTypeCoverageOptions {
	ruleFilePath?: Readonly<string>;
	xpath?: Readonly<string>;
	lineNumberCollector?: (lineNumber: number) => void;
}

/**
 * Walk AST tree recursively to find nodes of a specific type.
 * @param node - Current AST node to check.
 * @param targetType - Node type to find (e.g., 'IfBlockStatement').
 * @returns True if node type is found in the AST.
 */
function findNodeTypeInAST(
	node: Readonly<ASTNode>,
	targetType: Readonly<string>,
): boolean {
	// Check if current node matches the target type
	if (node.kind === targetType) {
		return true;
	}

	// Check all properties of the node object for child nodes
	// This ensures we find nodes regardless of property names
	const nodeRecord = node as Record<string, unknown>;

	for (const propName in nodeRecord) {
		// Skip non-child properties
		if (
			propName === 'kind' ||
			propName === 'start' ||
			propName === 'end' ||
			propName === 'loc' ||
			propName === 'range'
		) {
			continue;
		}

		const childNode = nodeRecord[propName];
		if (childNode === null || childNode === undefined) {
			continue;
		}

		if (Array.isArray(childNode)) {
			// Handle arrays of child nodes
			for (const item of childNode) {
				if (
					item !== null &&
					item !== undefined &&
					typeof item === 'object' &&
					'kind' in item
				) {
					const hasKindString =
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified item has 'kind' property that is a string, type assertion is verified by runtime checks
						typeof (item as { kind: unknown }).kind === 'string';
					if (hasKindString) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified item has 'kind' property that is a string, type assertion is verified by runtime checks
						if (findNodeTypeInAST(item as ASTNode, targetType)) {
							return true;
						}
					}
				}
			}
		} else if (
			typeof childNode === 'object' &&
			'kind' in childNode &&
			typeof (childNode as { kind: unknown }).kind === 'string'
		) {
			// Handle single child node
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified childNode has 'kind' property that is a string, type assertion is verified by runtime checks
			if (findNodeTypeInAST(childNode as ASTNode, targetType)) {
				return true;
			}
		}
	}

	return false;
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
	const lineNumberCollector = options?.lineNumberCollector;
	const foundNodeTypes: string[] = [];
	const missingNodeTypes: string[] = [];

	// Trust ts-summit-ast for accurate AST-based node type detection
	// ts-summit-ast handles parsing gracefully and always returns a usable AST
	const parseResult = parseApexCode(content);
	// Type assertion: ts-summit-ast always returns usable AST
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ts-summit-ast always returns usable AST
	const ast = parseResult.ast!;

	for (const nodeType of nodeTypes) {
		// Special handling for StandardCondition - skip as it's an internal node
		const isStandardCondition = nodeType === 'StandardCondition';
		let isCovered = false;

		if (isStandardCondition) {
			isCovered = true;
		} else {
			// Use AST to check if node type exists
			isCovered = findNodeTypeInAST(ast, nodeType);
		}

		if (isCovered) {
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
							if (lineNumber !== null && lineNumberCollector) {
								// Record this line as covered for LCOV reporting
								lineNumberCollector(lineNumber);
							}
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

export {
	type NodeTypeCoverageOptions,
	checkNodeTypeCoverage,
	findNodeTypeInAST,
};
