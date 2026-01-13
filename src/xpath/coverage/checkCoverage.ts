/**
 * @file
 * XPath coverage checking module.
 */
import type { XPathAnalysis, CoverageResult, Conditional } from '../../types/index.js';
import { checkNodeTypes } from './checkNodeTypes.js';
import { conditionalCheckers } from './conditional/strategies.js';

const MIN_ARRAY_LENGTH = 0;
const MIN_COUNT = 0;

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
	if (conditionals.length === MIN_ARRAY_LENGTH) {
		return {
			details: [],
			evidence: [],
			message: 'No conditionals to check',
			success: true,
		};
	}

	const results: CoverageResult[] = [];
	const allEvidence: CoverageResult['evidence'] = [];
	let allSuccess = true;

	for (const conditional of conditionals) {
		const checkerKey = mapConditionalTypeToCheckerKey(conditional.type);
		const checker = conditionalCheckers[checkerKey];

		if (checker) {
			const result = checker(
				conditional as Readonly<Conditional>,
				content,
			);
			results.push(result);
			allEvidence.push(...result.evidence);
			if (!result.success) {
				allSuccess = false;
			}
		} else {
			// Unknown conditional type - mark as not covered
			allSuccess = false;
			allEvidence.push({
				count: MIN_COUNT,
				description: `Unknown conditional type: ${conditional.type}`,
				required: 1,
				type: 'valid',
			});
		}
	}

	const coveredCount = results.filter(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
		(r) => r.success,
	).length;
	const totalCount = conditionals.length;
	const uncoveredCount = totalCount - coveredCount;

	return {
		details: [],
		evidence: allEvidence,
		message: allSuccess
			? `All ${String(totalCount)} conditionals covered`
			: `${String(uncoveredCount)} of ${String(totalCount)} conditionals not covered`,
		success: allSuccess,
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