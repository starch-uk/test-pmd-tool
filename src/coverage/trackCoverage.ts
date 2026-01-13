/**
 * @file
 * Coverage tracking for XPath line coverage.
 */

export interface CoverageData {
	filePath: string;

	/**
	 * Line -> execution count.
	 */
	xpathLines: Map<number, number>;

	/**
	 * Line -> execution count.
	 */
	componentLines: Map<number, number>; 
}

/**
 * Tracks coverage data for a rule file during testing.
 */
export class CoverageTracker {
	private readonly coverageData: CoverageData;

	public constructor(ruleFilePath: string) {
		this.coverageData = {
			componentLines: new Map(),
			filePath: ruleFilePath,
			xpathLines: new Map(),
		};
	}

	/**
	 * Records that an XPath line was executed.
	 * @param lineNumber - Line number in the XML file.
	 */
	public recordXPathLine(lineNumber: number): void {
		const INITIAL_COUNT = 0;
		const INCREMENT = 1;
		const current = this.coverageData.xpathLines.get(lineNumber) ?? INITIAL_COUNT;
		this.coverageData.xpathLines.set(lineNumber, current + INCREMENT);
	}

	/**
	 * Records that an XPath component line was executed.
	 * @param lineNumber - Line number in the XML file.
	 */
	public recordComponentLine(lineNumber: number): void {
		const INITIAL_COUNT = 0;
		const INCREMENT = 1;
		const current =
			this.coverageData.componentLines.get(lineNumber) ?? INITIAL_COUNT;
		this.coverageData.componentLines.set(lineNumber, current + INCREMENT);
	}

	/**
	 * Gets the coverage data.
	 * @returns Coverage data for this rule file.
	 */
	public getCoverageData(): Readonly<CoverageData> {
		return this.coverageData;
	}
}