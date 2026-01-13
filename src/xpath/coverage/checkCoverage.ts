/**
 * @file
 * XPath coverage checking module.
 */
import type { XPathAnalysis, CoverageResult, Conditional } from '../../types/index.js';
import { checkNodeTypes } from './checkNodeTypes.js';

const MIN_ARRAY_LENGTH = 0;

/**
 * Check coverage for conditional expressions.
 * @param conditionals - Array of conditional expressions.
 * @param content - Content to check against.
 * @returns Coverage result for conditionals.
 */
function checkConditionalCoverage(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Array elements are accessed
	conditionals: readonly Conditional[],
	content: Readonly<string>,
): CoverageResult {
	// Placeholder implementation - will be expanded with conditional checkers
	const covered = conditionals.filter((conditional: Readonly<Conditional>) => {
		// Simple check: see if conditional expression appears in content
		return content.includes(conditional.expression);
	});

	const success = covered.length === conditionals.length;
	const coveredCount = covered.length;
	const totalCount = conditionals.length;
	const uncoveredCount = totalCount - coveredCount;

	return {
		details: [],
		evidence: [
			{
				count: coveredCount,
				description: 'Conditional expressions covered by content',
				required: totalCount,
				type: 'valid',
			},
		],
		message: success
			? `All ${String(totalCount)} conditionals covered`
			: `${String(uncoveredCount)} of ${String(totalCount)} conditionals not covered`,
		success,
	};
}

/**
 * Main coverage checker that orchestrates all coverage validation.
 * @param xpathAnalysis - Complete XPath analysis result.
 * @param content - Example content to check against.
 * @returns Overall coverage result.
 */
export function checkCoverage(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Object properties are accessed
	xpathAnalysis: Readonly<XPathAnalysis>,
	content: Readonly<string>,
): CoverageResult {
	const results: CoverageResult[] = [];

	// Check node types coverage
	if (xpathAnalysis.nodeTypes.length > MIN_ARRAY_LENGTH) {
		const nodeTypeResult = checkNodeTypes(xpathAnalysis.nodeTypes, content);
		results.push(nodeTypeResult);
	}

	// Check conditional coverage
	if (xpathAnalysis.conditionals.length > MIN_ARRAY_LENGTH) {
		const conditionalResult = checkConditionalCoverage(
			xpathAnalysis.conditionals,
			content,
		);
		results.push(conditionalResult);
	}

	// Combine results
	const overallSuccess = results.every(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for every
		(result: Readonly<CoverageResult>) => result.success,
	);
	const totalEvidence = results.flatMap(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for flatMap
		(result: Readonly<CoverageResult>) => result.evidence,
	);
	const totalDetails = results.flatMap(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for flatMap
		(result: Readonly<CoverageResult>) => result.details,
	);

	const resultsLength = results.length;
	const failedCount = results.filter(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
		(r: Readonly<CoverageResult>) => !r.success,
	).length;
	const message = overallSuccess
		? `All XPath elements covered (${String(resultsLength)} checks passed)`
		: `${String(failedCount)} of ${String(resultsLength)} coverage checks failed`;

	return {
		details: totalDetails,
		evidence: totalEvidence,
		message,
		success: overallSuccess,
	};
}