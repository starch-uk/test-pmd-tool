/**
 * @file
 * Coverage report generation utilities.
 */
import { generateLcovReport } from '../coverage/generateLcov.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- CoverageTracker is used as a value (calling getCoverageData method)
import { CoverageTracker } from '../coverage/trackCoverage.js';
import { EXIT_CODE_ERROR } from './main.js';

/**
 * Generate coverage report from coverage trackers.
 * @param coverageTrackers - Map of file paths to coverage trackers, or null if coverage is disabled.
 * @returns True if report was generated successfully.
 */
export function generateCoverageReport(
	coverageTrackers: Readonly<Map<string, CoverageTracker>> | null,
): boolean {
	if (!coverageTrackers) {
		return false;
	}

	const coverageData = Array.from(coverageTrackers.values()).map(
		(tracker: Readonly<CoverageTracker>) => tracker.getCoverageData(),
	);
	try {
		generateLcovReport(coverageData, 'coverage/lcov.info');
		console.log('\n📊 Coverage report generated: coverage/lcov.info');
		return true;
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		console.error(`\n❌ Error generating coverage report: ${errorMessage}`);
		process.exit(EXIT_CODE_ERROR);
		return false;
	}
}
