import { extractNodeTypes } from './extractors/extractNodeTypes.js';
import { extractOperators } from './extractors/extractOperators.js';
import { extractAttributes } from './extractors/extractAttributes.js';
import { extractConditionals } from './extractors/extractConditionals.js';
import type { XPathAnalysis } from '../types/index.js';

/**
 * Analyze XPath expression and extract all components
 * @param xpath - XPath expression to analyze
 * @returns Complete XPath analysis result
 */
export function analyzeXPath(xpath: string): XPathAnalysis {
	if (!xpath) {
		return {
			nodeTypes: [],
			operators: [],
			attributes: [],
			conditionals: [],
			hasUnions: false,
			hasLetExpressions: false,
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
		nodeTypes,
		operators,
		attributes,
		conditionals,
		hasUnions,
		hasLetExpressions,
		patterns: [], // Reserved for future pattern analysis
	};
}
