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
	Conditional,
} from '../types/index.js';
import { analyzeXPath } from './analyzeXPath.js';
import { conditionalCheckers } from './coverage/conditional/strategies.js';

const MIN_COUNT = 0;
const NOT_FOUND_INDEX = -1;
const LINE_OFFSET = 1;

/**
 * Options for node type coverage checking.
 */
interface NodeTypeCoverageOptions {
	ruleFilePath?: Readonly<string>;
	xpath?: Readonly<string>;
	lineNumberCollector?: (lineNumber: number) => void;
}

/**
 * Find line number for an attribute in the XPath within the XML file.
 * @param ruleFilePath - Path to the rule XML file.
 * @param xpath - XPath expression.
 * @param attribute - Attribute to find (e.g., "Image", "Nested").
 * @returns Line number where attribute appears, or null if not found.
 */
function findAttributeLineNumber(
	ruleFilePath: Readonly<string>,
	xpath: Readonly<string>,
	attribute: Readonly<string>,
): number | null {
	try {
		const content = readFileSync(ruleFilePath, 'utf-8');
		const lines = content.split('\n');

		// Search for @AttributeName pattern in XPath section
		const attributePattern = `@${attribute}`;

		// Find the line containing the XPath value element
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			// Check if this line contains the XPath and the attribute
			const hasXPath = line.includes('xpath');
			const hasValue = line.includes('value');
			const hasAttribute = line.includes(attributePattern);
			if (hasXPath && hasValue && hasAttribute) {
				return i + LINE_OFFSET;
			}
		}

		// If not found in a single line, search for the XPath section and then the attribute
		let inXPathSection = false;
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<property') && line.includes('name="xpath"')) {
				inXPathSection = true;
			}
			if (inXPathSection && line.includes(attributePattern)) {
				return i + LINE_OFFSET;
			}
			if (inXPathSection && line.includes('</property>')) {
				inXPathSection = false;
			}
		}

		// Fallback: find position in XPath string and estimate line
		const xpathIndex = xpath.indexOf(attributePattern);
		if (xpathIndex !== NOT_FOUND_INDEX) {
			// Find the value element and count lines
			for (let i = 0; i < lines.length; i++) {
				// split('\n') always returns a dense array, so lines[i] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
				const line = lines[i]!;
				if (line.includes('<value>')) {
					// Count newlines in XPath up to the attribute position
					const xpathBeforeAttribute = xpath.substring(
						MIN_COUNT,
						xpathIndex,
					);
					const newlineMatches = xpathBeforeAttribute.match(/\n/g);
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
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
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
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
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
				// split('\n') always returns a dense array, so lines[i] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
				const line = lines[i]!;
				if (line.includes('<value>')) {
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
	const lineNumberCollector = options?.lineNumberCollector;
	const lowerContent = content.toLowerCase();
	const foundNodeTypes: string[] = [];
	const missingNodeTypes: string[] = [];

	for (const nodeType of nodeTypes) {
		let isCovered = false;

		// Use intelligent heuristics to match AST node types to Apex code patterns
		switch (nodeType) {
			case 'BinaryExpression':
				// Look for binary operators like +, -, *, /, ==, !=, <, >, etc.
				isCovered = /[+\-*/=<>!&|]{1,2}/.test(content);
				break;
			case 'LiteralExpression':
				// Look for any literals: strings, numbers, booleans, null
				isCovered =
					/\b\d+(\.\d+)?\b|'(?:[^'\\]|\\.)*'|"[^"]*"|\bnull\b|\btrue\b|\bfalse\b/.test(
						lowerContent,
					);
				break;
			case 'ModifierNode':
				// Look for modifiers like static, final, public, private
				isCovered = /\b(static|final|public|private|protected)\b/.test(
					lowerContent,
				);
				break;
			case 'Annotation':
				// Look for @annotations
				isCovered = /@\w+/.test(content);
				break;
			case 'AnnotationParameter':
				// Look for annotation parameters like (key=value)
				isCovered = /@\w+\([^)]+\)/.test(content);
				break;
			case 'IfBlockStatement':
				// Look for if statements
				isCovered = /\bif\b/.test(lowerContent);
				break;
			case 'SwitchStatement':
				// Look for switch statements
				isCovered = /\bswitch\b/.test(lowerContent);
				break;
			case 'ForLoopStatement':
				// Look for for loops
				isCovered = /\bfor\s*\(/.test(lowerContent);
				break;
			case 'ForEachStatement':
				// Look for for-each loops (for (... : ...))
				isCovered = /\bfor\s*\([^:]+:[^)]+\)/.test(lowerContent);
				break;
			case 'WhileLoopStatement':
				// Look for while loops
				isCovered = /\bwhile\b/.test(lowerContent);
				break;
			case 'DoWhileLoopStatement':
				// Look for do-while loops
				isCovered = /\bdo\b/.test(lowerContent);
				break;
			case 'TernaryExpression':
				// Look for ternary expressions (condition ? true : false)
				isCovered = /\?\s*[^:]+\s*:\s*[^;]+/.test(content);
				break;
			case 'MethodCallExpression':
				// Look for method calls (anything with parentheses after a word)
				isCovered = /\w+\s*\(/.test(content);
				break;
			case 'StandardCondition':
				// Skip StandardCondition - it's an internal AST node not directly represented in code
				isCovered = true;
				break;
			default:
				// Fallback to simple string matching for unknown node types
				isCovered = lowerContent.includes(nodeType.toLowerCase());
				break;
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
 * Find line number for a conditional expression in the XPath within the XML file.
 * @param ruleFilePath - Path to the rule XML file.
 * @param xpath - XPath expression (trimmed).
 * @param conditional - Conditional to find.
 * @returns Line number where conditional appears, or null if not found.
 */
function findConditionalLineNumber(
	ruleFilePath: Readonly<string>,
	xpath: Readonly<string>,
	conditional: Readonly<Conditional>,
): number | null {
	try {
		const content = readFileSync(ruleFilePath, 'utf-8');
		const lines = content.split('\n');

		// Build search pattern from conditional expression
		// Normalize whitespace for matching (replace multiple spaces with single space)
		const exprPattern = conditional.expression.trim().replace(/\s+/g, ' ');
		// For 'or' and 'and' conditionals, include the operator in the search to be more specific
		// This helps distinguish nested conditionals (e.g., 'or' inside 'and')
		// Build search pattern: operator + expression
		const searchPattern =
			conditional.type === 'or' || conditional.type === 'and'
				? `${conditional.type} ${exprPattern}`
				: exprPattern;
		const normalizedSearchPattern = searchPattern.replace(/\s+/g, ' ');

		// Find the XPath section first
		let xpathSectionStart = NOT_FOUND_INDEX;
		let inXPathSection = false;
		let xpathContentStart = NOT_FOUND_INDEX;

		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<property') && line.includes('name="xpath"')) {
				inXPathSection = true;
				xpathSectionStart = i;
			}
			if (inXPathSection && line.includes('<value>')) {
				xpathContentStart = i;
			}
			if (inXPathSection && line.includes('</property>')) {
				inXPathSection = false;
			}
		}

		// If we found the XPath section, search within it for the expression
		if (xpathSectionStart !== NOT_FOUND_INDEX) {
			// Search for the expression pattern in the XPath section
			// Search from the end backwards to find the most specific match (for nested conditionals)
			// This helps when 'or' is nested inside 'and' - we want to find the 'or' line, not the 'and' line
			const LAST_INDEX_OFFSET = 1;
			const lastLineIndex = lines.length - LAST_INDEX_OFFSET;
			for (let i = lastLineIndex; i >= xpathSectionStart; i--) {
				// split('\n') always returns a dense array, so lines[i] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
				const line = lines[i]!;
				// Normalize whitespace in the line for comparison (replace multiple spaces with single space)
				const normalizedLine = line.replace(/\s+/g, ' ');
				if (normalizedLine.includes(normalizedSearchPattern)) {
					return i + LINE_OFFSET;
				}
			}
		}

		// Fallback: find position in trimmed XPath string and estimate line
		// The xpath parameter is already trimmed, so position is relative to trimmed string
		// For 'or' and 'and', position points to the operator, so we need to find that in the XML
		const xpathIndex = conditional.position;
		if (
			xpathIndex !== NOT_FOUND_INDEX &&
			xpathContentStart !== NOT_FOUND_INDEX
		) {
			// Find where the actual XPath content starts in the XML file
			// This is after <value> and potentially after <![CDATA[
			let actualContentStartLine;
			// Check if CDATA is used
			const NEXT_LINE_OFFSET = 1;
			const nextLineIndex = xpathContentStart + NEXT_LINE_OFFSET;
			const hasNextLine = nextLineIndex < lines.length;
			const nextLine = hasNextLine ? lines[nextLineIndex] : undefined;
			const hasCdataStart =
				hasNextLine && nextLine?.includes('<![CDATA[') === true;
			if (hasCdataStart) {
				// CDATA starts on next line, actual content starts after that
				const CDATA_CONTENT_OFFSET = 1;
				actualContentStartLine = nextLineIndex + CDATA_CONTENT_OFFSET;
			} else {
				// Content might be on the same line as <value> or next line
				// Check if <value> line contains the start of XPath content
				const valueLine = lines[xpathContentStart];
				const hasValueLine = valueLine !== undefined;
				const valueLineEndsWithTag =
					hasValueLine && valueLine.trim().endsWith('<value>');
				if (hasValueLine && !valueLineEndsWithTag) {
					// Content starts on same line as <value>
					actualContentStartLine = xpathContentStart;
				} else {
					// Content starts on next line
					actualContentStartLine =
						xpathContentStart + NEXT_LINE_OFFSET;
				}
			}

			// Count newlines in the trimmed XPath up to the conditional position
			const xpathBeforeConditional = xpath.substring(
				MIN_COUNT,
				xpathIndex,
			);
			const newlineMatches = xpathBeforeConditional.match(/\n/g);
			// match() returns null if no match, or array if match found
			// Use 0 if no matches found (null case)
			const newlineCount = newlineMatches?.length ?? MIN_COUNT;

			// Calculate the line number
			// actualContentStartLine is 0-indexed, so we add LINE_OFFSET to convert to 1-indexed
			// Then add newlineCount to account for newlines in the XPath
			return actualContentStartLine + LINE_OFFSET + newlineCount;
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Find line number for an operator in the XPath within the XML file.
 * @param ruleFilePath - Path to the rule XML file.
 * @param xpath - XPath expression.
 * @param operator - Operator to find (e.g., "+", "=", "!=").
 * @returns Line number where operator appears, or null if not found.
 */
function findOperatorLineNumber(
	ruleFilePath: Readonly<string>,
	xpath: Readonly<string>,
	operator: Readonly<string>,
): number | null {
	try {
		const content = readFileSync(ruleFilePath, 'utf-8');
		const lines = content.split('\n');

		// Escape special regex characters in operator
		const escapedOperator = operator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const operatorPattern = new RegExp(escapedOperator);

		// Find the line containing the XPath value element
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			// Check if this line contains the XPath and the operator
			const hasXPath = line.includes('xpath');
			const hasValue = line.includes('value');
			const hasOperator = operatorPattern.test(line);
			if (hasXPath && hasValue && hasOperator) {
				return i + LINE_OFFSET;
			}
		}

		// If not found in a single line, search for the XPath section and then the operator
		let inXPathSection = false;
		for (let i = 0; i < lines.length; i++) {
			// split('\n') always returns a dense array, so lines[i] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
			const line = lines[i]!;
			if (line.includes('<property') && line.includes('name="xpath"')) {
				inXPathSection = true;
			}
			if (inXPathSection && operatorPattern.test(line)) {
				return i + LINE_OFFSET;
			}
			if (inXPathSection && line.includes('</property>')) {
				inXPathSection = false;
			}
		}

		// Fallback: find position in XPath string and estimate line
		const xpathIndex = xpath.indexOf(operator);
		if (xpathIndex !== NOT_FOUND_INDEX) {
			// Find the value element and count lines
			for (let i = 0; i < lines.length; i++) {
				// split('\n') always returns a dense array, so lines[i] is always defined
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures i < length, split() returns dense array
				const line = lines[i]!;
				if (line.includes('<value>')) {
					// Count newlines in XPath up to the operator position
					const xpathBeforeOperator = xpath.substring(
						MIN_COUNT,
						xpathIndex,
					);
					const newlineMatches = xpathBeforeOperator.match(/\n/g);
					// match() returns null if no match, or array if match found
					// Use 0 if no matches found (null case)
					const newlineCount = newlineMatches?.length ?? MIN_COUNT;
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
				ruleFilePath !== undefined && xpathValue !== undefined;
			if (hasOptions) {
				const lineNumber = findConditionalLineNumber(
					ruleFilePath,
					xpathValue,
					conditional,
				);
				if (lineNumber !== null && lineNumberCollector) {
					// Record this line as covered for LCOV reporting
					lineNumberCollector(lineNumber);
				}
				missingConditionals.push(
					lineNumber !== null
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
	const missingList =
		missingConditionals.length > MIN_COUNT ? missingConditionals : [];

	const missingText =
		missingList.length > MIN_COUNT
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
				// Look for literal values (numbers, strings, booleans, null)
				isCovered =
					/\b\d+(\.\d+)?\b|'(?:[^'\\]|\\.)*'|"[^"]*"|\bnull\b|\btrue\b|\bfalse\b/.test(
						lowerContent,
					);
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

	const foundList =
		foundOperators.length > MIN_COUNT
			? foundOperators.map((item) => ` - ${item}`).join('\n')
			: '';
	// Format missing operators with line numbers if available
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
