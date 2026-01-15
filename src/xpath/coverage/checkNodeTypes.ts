/**
 * @file
 * Node type coverage checking for XPath analysis.
 */
import type { CoverageResult } from '../../types/index.js';

const MIN_ARRAY_LENGTH = 0;
const MIN_COUNT = 0;
const BRACE_DEPTH_ONE = 1;

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
		UserClass: ['class'], // UserClass nodes are inner/nested classes
		WhileLoopStatement: ['while'],
	};

	return keywordMap[nodeType] ?? [nodeType.toLowerCase()];
}

/**
 * Check if content contains nested classes (inner classes).
 * UserClass nodes are classes declared inside other classes.
 * @param content - Content to check.
 * @returns True if nested classes are detected.
 */
function hasNestedClasses(content: Readonly<string>): boolean {
	const lines = content.split('\n');
	let braceDepth = 0;
	let insideClass = false;
	const CLASS_PATTERN = /\bclass\s+\w+/;

	for (const line of lines) {
		const trimmed = line.trim();
		// Count braces to track nesting depth
		for (const char of line) {
			if (char === '{') {
				braceDepth++;
			} else if (char === '}') {
				braceDepth--;
				if (braceDepth === BRACE_DEPTH_ONE) {
					insideClass = false;
				}
			}
		}

		// Check if this line declares a class
		if (CLASS_PATTERN.test(trimmed)) {
			if (insideClass && braceDepth > BRACE_DEPTH_ONE) {
				// We found a class declaration inside another class
				return true;
			}
			insideClass = true;
		}
	}

	return false;
}

/**
 * Check if XPath node types are covered by example content.
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
		let isCovered = false;

		// Special handling for UserClass - must detect nested classes
		const isUserClass = nodeType === 'UserClass';
		if (isUserClass) {
			isCovered = hasNestedClasses(trimmedContent);
		} else {
			const keywords = getNodeTypeKeywords(nodeType);
			const contentLower = trimmedContent.toLowerCase();
			isCovered = keywords.some((keyword) =>
				contentLower.includes(keyword.toLowerCase()),
			);
		}

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

export { checkNodeTypes, hasNestedClasses };