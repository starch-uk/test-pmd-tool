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
	if (typeof node !== 'object' || !('kind' in node)) {
		return false;
	}

	if (node.kind === targetType) {
		return true;
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
						typeof (item as { kind: unknown }).kind === 'string';
					if (hasKindString) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified item has 'kind' property that is a string
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
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Verified childNode has 'kind' property that is a string
			if (findNodeTypeInAST(childNode as ASTNode, targetType)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check whether a specific ClassDeclaration node has a nested ClassDeclaration.
 * @param node - ClassDeclaration node to inspect.
 * @returns True if a nested class is found.
 */
function hasNestedClassInNode(node: Readonly<ASTNode>): boolean {
	const nodeRecord = node as Record<string, unknown>;
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
			if (childASTNode.kind === 'ClassDeclaration') {
				return true;
			}
		}
	}

	return false;
}

/**
 * Determine whether the provided Apex content contains nested classes.
 * @param content - Apex content to parse and analyze.
 * @returns True if a ClassDeclaration contains another ClassDeclaration.
 */
function hasNestedClasses(content: Readonly<string>): boolean {
	const parseResult = parseApexCode(content);
	if (!isValidParseResult(parseResult)) {
		return false;
	}

	const { ast } = parseResult;
	const classDeclarations: ASTNode[] = [];

	/**
	 * Collect all ClassDeclaration nodes from the AST.
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

	for (const classDecl of classDeclarations) {
		if (hasNestedClassInNode(classDecl)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if XPath node types are covered by example content using AST parsing.
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

	const parseResult = parseApexCode(trimmedContent);
	if (!isValidParseResult(parseResult)) {
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
		const isStandardCondition = nodeType === 'StandardCondition';
		const isCovered = isStandardCondition
			? true
			: findNodeTypeInAST(parseResult.ast, nodeType);
		if (isCovered) {
			coveredTypes.push(nodeType);
		} else {
			missingTypes.push(nodeType);
		}
	}

	const success = missingTypes.length === MIN_COUNT;
	return {
		details: [],
		evidence: [
			{
				count: coveredTypes.length,
				description: 'Node types covered by example content',
				required: nodeTypes.length,
				type: 'valid',
			},
		],
		message: success
			? `All ${String(nodeTypes.length)} node types covered`
			: `${String(missingTypes.length)} of ${String(nodeTypes.length)} node types not covered: ${missingTypes.join(', ')}`,
		success,
	};
}

export { checkNodeTypes, hasNestedClasses };
