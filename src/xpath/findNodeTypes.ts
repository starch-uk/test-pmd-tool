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
const MIN_LINE_LENGTH = 0;

/**
 * Options for node type coverage checking.
 */
interface NodeTypeCoverageOptions {
	ruleFilePath?: Readonly<string>;
	xpath?: Readonly<string>;
	lineNumberCollector?: (lineNumber: number) => void;
}

/**
 * Prepare example content for parsing by ts-summit-ast.
 * @param content - Example content.
 * @returns Wrapper decision and wrapped content to parse.
 * - If the content is a full class (allowing leading comments), return as-is.
 * - Otherwise wrap it inside a class + method so fragments can be parsed.
 */
function wrapContentForApexParse(content: Readonly<string>): {
	readonly needsWrapper: boolean;
	readonly wrappedContent: string;
} {
	const trimmedContent = content.trim();
	const firstNonEmptyLine =
		trimmedContent
			.split('\n')
			.find((line) => line.trim().length > MIN_LINE_LENGTH) ?? '';
	const startsWithClassOnFirstLine =
		/^\s*(public\s+|private\s+|global\s+)?class\s+\w+/.test(
			firstNonEmptyLine,
		);
	const startsWithClassAfterLeadingComments =
		/^(?:\s*\/\/[^\n]*\n|\s*\n)*\s*(public\s+|private\s+|global\s+)?class\s+\w+/m.test(
			trimmedContent,
		);

	if (startsWithClassOnFirstLine || startsWithClassAfterLeadingComments) {
		return { needsWrapper: false, wrappedContent: trimmedContent };
	}

	const lines = trimmedContent.split('\n');
	const normalizedLines = lines.map((line) => line.trimStart());
	const indentedContent = normalizedLines.join('\n\t\t');
	return {
		needsWrapper: true,
		wrappedContent: `public class WrapperClass {\n\tpublic void wrapperMethod() {\n\t\t${indentedContent}\n\t}\n}`,
	};
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
	// Guard against nodes without kind property
	if (typeof node !== 'object' || !('kind' in node)) {
		return false;
	}

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

	const { wrappedContent } = wrapContentForApexParse(content);
	const parseResult = parseApexCode(wrappedContent);

	// Guard against undefined AST
	const { ast } = parseResult;
	if (!ast) {
		// Heuristic fallback for known node types when AST parsing fails
		let heuristicCoveredCount = 0;
		for (const nodeType of nodeTypes) {
			if (nodeType === 'StandardCondition') {
				heuristicCoveredCount++;
				continue;
			}
			if (nodeType === 'Class') {
				const hasClassKeyword = /\bclass\s+\w+/.test(content);
				if (hasClassKeyword) heuristicCoveredCount++;
				continue;
			}
			if (nodeType === 'Method') {
				const hasMethodSignature =
					/\b(public|private|global)\s+(static\s+)?\w+\s+\w+\s*\(/.test(
						content,
					);
				if (hasMethodSignature) heuristicCoveredCount++;
				continue;
			}
			if (nodeType === 'UserClass') {
				const hasNested =
					/\bclass\s+\w+[\s\S]*\{[\s\S]*\bclass\s+\w+[\s\S]*\}/.test(
						content,
					);
				if (hasNested) heuristicCoveredCount++;
				continue;
			}
			if (nodeType === 'MethodCallExpression') {
				const hasCall = /\b\w+\.\w+\s*\(|\b\w+\s*\(/.test(content);
				if (hasCall) heuristicCoveredCount++;
				continue;
			}
			if (
				nodeType === 'Annotation' ||
				nodeType === 'AnnotationParameter'
			) {
				const hasAnnotation = /@\w+/.test(content);
				if (hasAnnotation) heuristicCoveredCount++;
				continue;
			}
		}

		if (heuristicCoveredCount > MIN_COUNT) {
			return {
				count: heuristicCoveredCount,
				description:
					'Node types covered by heuristic fallback (AST parse failed)',
				required: nodeTypes.length,
				type: 'violation',
			};
		}

		const missingList = nodeTypes.map((t) => ` - ${t}`).join('\n');
		if (options !== undefined) {
			const ruleFilePathValue = options.ruleFilePath;
			const xpathValue = options.xpath;
			const hasRuleFilePath =
				ruleFilePathValue !== undefined &&
				ruleFilePathValue.length > MIN_COUNT;
			const hasXpathValue =
				xpathValue !== undefined && xpathValue.length > MIN_COUNT;
			if (hasRuleFilePath && hasXpathValue) {
				const withLines = nodeTypes
					.map((t) => {
						const lineNumber = findNodeTypeLineNumber(
							ruleFilePathValue,
							xpathValue,
							t,
						);
						if (lineNumber !== null && lineNumberCollector) {
							lineNumberCollector(lineNumber);
						}
						return lineNumber !== null
							? ` - Line ${String(lineNumber)}: ${t}`
							: ` - ${t}`;
					})
					.join('\n');
				return {
					count: MIN_COUNT,
					description: `Missing:\n${withLines}`,
					required: nodeTypes.length,
					type: 'violation',
				};
			}
		}
		return {
			count: MIN_COUNT,
			description: `Missing:\n${missingList}`,
			required: nodeTypes.length,
			type: 'violation',
		};
	}

	for (const nodeType of nodeTypes) {
		// Special handling for StandardCondition - skip as it's an internal node
		const isStandardCondition = nodeType === 'StandardCondition';
		let isCovered = false;

		if (isStandardCondition) {
			isCovered = true;
		} else if (nodeType === 'UserClass') {
			// UserClass coverage is about class declarations (including nested/inner classes)
			// Use a simple structural check that avoids depending on exact AST kind names.
			isCovered =
				/\bclass\s+\w+[\s\S]*\{[\s\S]*\bclass\s+\w+[\s\S]*\}/.test(
					content,
				);
		} else {
			// Use AST to check if node type exists
			isCovered = findNodeTypeInAST(ast, nodeType);
			if (!isCovered && nodeType === 'Method') {
				isCovered =
					/\b(public|private|global)\s+(static\s+)?\w+\s+\w+\s*\(/.test(
						content,
					);
			}
			if (!isCovered && nodeType === 'Class') {
				isCovered = /\bclass\s+\w+/.test(content);
			}
			if (!isCovered && nodeType === 'MethodCallExpression') {
				// Fallback heuristic: method call syntax in content
				isCovered = /\b\w+\.\w+\s*\(|\b\w+\s*\(/.test(content);
			}
			if (
				!isCovered &&
				(nodeType === 'Annotation' ||
					nodeType === 'AnnotationParameter')
			) {
				isCovered = /@\w+/.test(content);
			}
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
	const description = missingText;

	return {
		count: foundNodeTypes.length,
		description,
		required: nodeTypes.length,
		type: 'violation',
	};
}

/**
 * Check node type coverage across multiple examples by combining their contents.
 * @param nodeTypes - Node types to check.
 * @param exampleContents - Example contents to search.
 * @param options - Optional options for line number tracking.
 * @returns Coverage evidence.
 */
function checkNodeTypeCoverageAcrossExamples(
	nodeTypes: readonly string[],
	exampleContents: readonly Readonly<string>[],
	options?: Readonly<NodeTypeCoverageOptions>,
): CoverageEvidence {
	const combined = exampleContents.join('\n');
	return checkNodeTypeCoverage(nodeTypes, combined, options);
}

export {
	type NodeTypeCoverageOptions,
	checkNodeTypeCoverageAcrossExamples,
	checkNodeTypeCoverage,
	findNodeTypeInAST,
};
