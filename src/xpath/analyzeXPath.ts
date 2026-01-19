/**
 * @file
 * XPath analysis module. Analyzes XPath expressions and extracts components.
 */
import type { XPathAnalysis } from '../types/index.js';
import { extractAttributes } from './extractors/extractAttributes.js';
import { extractConditionals } from './extractors/extractConditionals.js';
import { extractNodeTypes } from './extractors/extractNodeTypes.js';
import { extractOperators } from './extractors/extractOperators.js';

/**
 * Analyzes an XPath expression and extracts node types, operators, conditionals, attributes, hardcoded values, and let variables.
 * @param xpath - XPath expression to analyze.
 * @returns XPathAnalysis object containing extracted node types, operators, conditionals, attributes, hardcoded values, and let variables for coverage checking.
 */
export function analyzeXPath(xpath: Readonly<string>): XPathAnalysis {
	if (!xpath) {
		return {
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		};
	}

	const nodeTypes = extractNodeTypes(xpath);
	const operators = extractOperators(xpath);
	const attributes = extractAttributes(xpath);
	const conditionals = extractConditionals(xpath);

	const hasUnions = xpath.includes('|');
	const hasLetExpressions = xpath.includes('let ');

	return {
		attributes,
		conditionals,
		hasLetExpressions,
		hasUnions,
		nodeTypes,
		operators,
		patterns: [], // Reserved for future pattern analysis
	};
}
