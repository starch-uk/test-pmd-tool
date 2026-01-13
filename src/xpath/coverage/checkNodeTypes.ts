/**
 * @file
 * Node type coverage checking for XPath analysis.
 */
import type { CoverageResult } from '../../types/index.js';

const MIN_ARRAY_LENGTH = 0;
const MIN_COUNT = 0;

/**
 * Get keywords associated with a node type for coverage checking.
 * @param nodeType - AST node type name.
 * @returns Array of keywords to search for in content.
 */
function getNodeTypeKeywords(nodeType: Readonly<string>): string[] {
	const keywordMap: Record<string, string[]> = {
		ClassDeclaration: ['class'],
		DoWhileLoopStatement: ['do', 'while'],
		FieldDeclaration: ['field'],
		ForEachStatement: ['for', ':'],
		ForLoopStatement: ['for'],
		IfBlockStatement: ['if', 'else if'],
		InterfaceDeclaration: ['interface'],
		MethodCallExpression: ['('], // Method calls have parentheses
		PropertyDeclaration: ['property'],
		StandardCondition: [], // Skip - not directly represented in code
		SwitchStatement: ['switch'],
		TernaryExpression: ['?', ':'], // Ternary operator uses ? and :
		TryCatchFinallyBlockStatement: ['try', 'catch'],
		WhileLoopStatement: ['while'],
	};

	return keywordMap[nodeType] ?? [nodeType.toLowerCase()];
}

/**
 * Check if XPath node types are covered by example content.
 * @param nodeTypes - Array of AST node types from XPath.
 * @param content - Example content to check against.
 * @returns Coverage result with evidence.
 */
export function checkNodeTypes(
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
					description: 'Node types found in XPath but no content to validate',
					required: nodeTypes.length,
					type: 'valid',
				},
			],
			message: 'No content to check node types against',
			success: false,
		};
	}

	// Filter out node types that don't have direct code representation
	const checkableNodeTypes = nodeTypes.filter((nodeType) => {
		const keywords = getNodeTypeKeywords(nodeType);
		return keywords.length > MIN_ARRAY_LENGTH; // Skip node types with empty keyword arrays
	});

	if (checkableNodeTypes.length === MIN_ARRAY_LENGTH) {
		return {
			details: [],
			evidence: [],
			message: 'No checkable node types found',
			success: true,
		};
	}

	const coveredTypes: string[] = [];
	const missingTypes: string[] = [];

	for (const nodeType of checkableNodeTypes) {
		const keywords = getNodeTypeKeywords(nodeType);
		const contentLower = trimmedContent.toLowerCase();
		const isCovered = keywords.some((keyword) =>
			contentLower.includes(keyword.toLowerCase()),
		);

		if (isCovered) {
			coveredTypes.push(nodeType);
		} else {
			missingTypes.push(nodeType);
		}
	}

	const success = missingTypes.length === MIN_COUNT;
	const totalCount = checkableNodeTypes.length;
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