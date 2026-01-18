/**
 * @file
 * Node type coverage checking for XPath analysis.
 * Uses ts-summit-ast for accurate AST-based node type detection.
 */
import type { ASTNode } from 'ts-summit-ast';
import type { CoverageResult } from '../types/index.js';
import { parseApexCode, isValidParseResult } from '../parser/apexParser.js';

const MIN_ARRAY_LENGTH = 0;
const MIN_COUNT = 0;

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

	// Use type-safe property access for known AST node properties
	// Check all properties of the node object for child nodes
	const nodeRecord = node as Record<string, unknown>;

	// Check all properties of the node object for child nodes
	// This ensures we find nodes regardless of property names
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
			// ts-summit-ast guarantees valid AST nodes, so we can safely assume all items are valid
			for (const item of childNode) {
				// ts-summit-ast always returns valid AST nodes with 'kind' property as string
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ts-summit-ast guarantees valid AST nodes
				if (findNodeTypeInAST(item as ASTNode, targetType)) {
					return true;
				}
			}
		} else if (
			typeof childNode === 'object' &&
			'kind' in childNode &&
			typeof (childNode as { kind: unknown }).kind === 'string'
		) {
			// Handle single child node
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified childNode has 'kind' property that is a string
			if (findNodeTypeInAST(childNode as ASTNode, targetType)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check if a ClassDeclaration node contains nested classes.
 * @param node - ClassDeclaration node to check.
 * @returns True if nested classes are found.
 */
function hasNestedClassInNode(node: Readonly<ASTNode>): boolean {
	// This function is only called with ClassDeclaration nodes from hasNestedClassesAST
	// The check node.kind !== 'ClassDeclaration' is unreachable
	const nodeRecord = node as Record<string, unknown>;

	// Check common properties that might contain class declarations
	const childPropNames = ['body', 'members', 'children', 'declarations'];

	for (const propName of childPropNames) {
		const childNode = nodeRecord[propName];
		if (childNode === null || childNode === undefined) {
			continue;
		}

		if (Array.isArray(childNode)) {
			for (const item of childNode) {
				if (
					item !== null &&
					item !== undefined &&
					typeof item === 'object' &&
					'kind' in item
				) {
					const hasKindString =
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified item has 'kind' property that is a string
						typeof (item as { kind: unknown }).kind === 'string';
					if (hasKindString) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified item has 'kind' property that is a string
						const childASTNode = item as ASTNode;
						// Nested classes are direct children of ClassDeclaration nodes
						// No need to recurse - if it's not a ClassDeclaration here, it won't contain one
						if (childASTNode.kind === 'ClassDeclaration') {
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
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified childNode has 'kind' property that is a string
			const childASTNode = childNode as ASTNode;
			// Nested classes are direct children of ClassDeclaration nodes
			// No need to recurse - if it's not a ClassDeclaration here, it won't contain one
			if (childASTNode.kind === 'ClassDeclaration') {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check if content contains nested classes (inner classes) using AST.
 * Trusts ts-summit-ast for parsing.
 * @param content - Content to check.
 * @returns True if nested classes are detected.
 */
function hasNestedClassesAST(content: Readonly<string>): boolean {
	// ts-summit-ast always returns usable AST - parsing failure path is unreachable
	const parseResult = parseApexCode(content);
	// Type assertion: ts-summit-ast always returns usable AST
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ts-summit-ast always returns usable AST
	const ast = parseResult.ast!;

	// Find all ClassDeclaration nodes and check if any contain nested classes
	const classDeclarations: ASTNode[] = [];

	/**
	 * Recursively collect all ClassDeclaration nodes from the AST.
	 * @param node - AST node to traverse.
	 */
	function collectClassDeclarations(node: Readonly<ASTNode>): void {
		if (node.kind === 'ClassDeclaration') {
			classDeclarations.push(node);
		}

		const nodeRecord = node as Record<string, unknown>;
		for (const propName in nodeRecord) {
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
				for (const item of childNode) {
					if (
						item !== null &&
						item !== undefined &&
						typeof item === 'object' &&
						'kind' in item
					) {
						const hasKindString =
							// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified item has 'kind' property that is a string
							typeof (item as { kind: unknown }).kind ===
							'string';
						if (hasKindString) {
							// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified item has 'kind' property that is a string
							collectClassDeclarations(item as ASTNode);
						}
					}
				}
			} else if (
				typeof childNode === 'object' &&
				'kind' in childNode &&
				typeof (childNode as { kind: unknown }).kind === 'string'
			) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified childNode has 'kind' property that is a string
				collectClassDeclarations(childNode as ASTNode);
			}
		}
	}

	collectClassDeclarations(ast);

	// Check if any ClassDeclaration contains nested classes
	for (const classDecl of classDeclarations) {
		if (hasNestedClassInNode(classDecl)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if XPath node types are covered by example content using AST parsing.
 * Trusts ts-summit-ast for parsing and node type detection.
 * @param nodeTypes - Array of AST node types from XPath.
 * @param content - Example content to check against.
 * @returns Coverage result with evidence.
 */
function checkNodeTypes(
	nodeTypes: readonly string[],
	content: Readonly<string>,
): CoverageResult {
	if (nodeTypes.length === MIN_ARRAY_LENGTH) {
		return {
			details: [],
			evidence: [],
			message: 'No node types to check',
			success: true,
		};
	}

	const trimmedContent = content.trim();
	if (trimmedContent.length === MIN_COUNT) {
		return {
			details: [],
			evidence: [
				{
					count: MIN_COUNT,
					description:
						'Node types found in XPath but no content to validate',
					required: nodeTypes.length,
					type: 'valid',
				},
			],
			message: 'No content to check node types against',
			success: false,
		};
	}

	// Trust ts-summit-ast for AST-based checking
	const parseResult = parseApexCode(trimmedContent);
	if (!isValidParseResult(parseResult)) {
		// Trust ts-summit-ast - if parsing fails, cannot check node types
		return {
			details: [],
			evidence: [
				{
					count: MIN_COUNT,
					description: 'Cannot check node types - AST parsing failed',
					required: nodeTypes.length,
					type: 'valid',
				},
			],
			message: 'AST parsing failed - cannot verify node type coverage',
			success: false,
		};
	}

	const coveredTypes: string[] = [];
	const missingTypes: string[] = [];

	for (const nodeType of nodeTypes) {
		// Special handling for StandardCondition - skip as it's an internal node
		const isStandardCondition = nodeType === 'StandardCondition';
		let isCovered = false;

		if (isStandardCondition) {
			isCovered = true;
		} else {
			// Use AST to check if node type exists
			isCovered = findNodeTypeInAST(parseResult.ast, nodeType);
		}

		if (isCovered) {
			coveredTypes.push(nodeType);
		} else {
			missingTypes.push(nodeType);
		}
	}

	const success = missingTypes.length === MIN_COUNT;
	const totalCount = nodeTypes.length;
	const coveredCount = coveredTypes.length;
	const missingCount = missingTypes.length;

	return {
		details: [],
		evidence: [
			{
				count: coveredCount,
				description: 'Node types covered by example content',
				required: totalCount,
				type: 'valid',
			},
		],
		message: success
			? `All ${String(totalCount)} node types covered`
			: `${String(missingCount)} of ${String(totalCount)} node types not covered: ${missingTypes.join(', ')}`,
		success,
	};
}

// Export for use in checkCoverage.ts (maintains backward compatibility)
export { checkNodeTypes, hasNestedClassesAST as hasNestedClasses };
