/**
 * @file
 * Coverage-focused tests for RuleTester fallback branches that are hard to reach
 * through the normal happy-path integration tests.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RuleTester } from '../../../src/tester/RuleTester.js';
import { runPMD } from '../../../src/pmd/runPMD.js';
import { createTestFile } from '../../../src/parser/createTestFile.js';

vi.mock('fs', () => ({
	existsSync: vi.fn(() => true),
	readFileSync: vi.fn(),
}));

vi.mock('../../../src/pmd/runPMD.js', () => ({
	runPMD: vi.fn(),
}));

vi.mock('../../../src/parser/createTestFile.js', () => ({
	createTestFile: vi.fn(),
}));

vi.mock('../../../src/xpath/extractXPath.js', () => ({
	extractXPath: vi.fn(() => ({ success: true, data: null })),
}));

vi.mock('../../../src/xpath/checkCoverage.js', () => ({
	checkXPathCoverage: vi.fn(() => ({
		success: true,
		issues: [],
		warnings: [],
	})),
}));

vi.mock('../../../src/tester/qualityChecks.js', () => ({
	runQualityChecks: vi.fn(() => ({ passed: true, issues: [], warnings: [] })),
}));

vi.mock('../../../src/tester/checkQualityChecks.js', () => ({
	checkQualityChecks: vi.fn(() => ({
		passed: true,
		issues: [],
		warnings: [],
	})),
}));

vi.mock('../../../src/parser/parseExample.js', () => ({
	parseExample: vi.fn(),
}));

const fsModule = await import('fs');
const mockedReadFileSync = vi.mocked(fsModule.readFileSync);
const mockedRunPMD = vi.mocked(runPMD);
const mockedCreateTestFile = vi.mocked(createTestFile);

interface ParseExampleModule {
	parseExample: ReturnType<typeof vi.fn>;
}
const parseExampleModule = await import('../../../src/parser/parseExample.js');
const mockedParseExample = vi.mocked(
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Dynamic import typing
	(parseExampleModule as ParseExampleModule).parseExample,
);

describe('RuleTester fallback coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates violation testCaseResults from inline markers when extraction returns zero markers', async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" language="apex" message="m" class="c">
  <description>d</description>
  <priority>3</priority>
  <example>
<![CDATA[
public class Example {
  private Pattern p = Pattern.compile('x'); // ❌ should trigger
}
]]>
  </example>
</rule>`;
		mockedReadFileSync.mockReturnValue(xml);

		mockedParseExample.mockReturnValue({
			content:
				"public class Example {\n  private Pattern p = Pattern.compile('x'); // ❌ should trigger\n}\n",
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [], // Force fallback
			violations: ["private Pattern p = Pattern.compile('x');"],
		});

		mockedCreateTestFile.mockReturnValue({
			filePath: '/tmp/test-1.cls',
			hasValids: false,
			hasViolations: true,
			validCount: 0,
			violationCount: 1,
		});

		mockedRunPMD.mockReturnValue({
			success: true,
			data: { violations: [] },
		});

		const tester = new RuleTester('rule.xml');
		const results = await tester.runCoverageTest(false);

		expect(results.detailedTestResults.length).toBeGreaterThan(0);
		expect(
			results.detailedTestResults.some(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test callback parameter
				(r) => r.testType === 'violation',
			),
		).toBe(true);
	});

	it('adds a default testCaseResult when no markers exist and no test results were created (example line lookup missing)', async () => {
		// Deliberately omit <![CDATA[ to make line lookup return undefined.
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" language="apex" message="m" class="c">
  <description>d</description>
  <priority>3</priority>
  <example>
public class Example {}
  </example>
</rule>`;
		mockedReadFileSync.mockReturnValue(xml);

		mockedParseExample.mockReturnValue({
			content: 'public class Example {}',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		});

		mockedCreateTestFile.mockReturnValue({
			filePath: '/tmp/test-1.cls',
			hasValids: false,
			hasViolations: false,
			validCount: 0,
			violationCount: 0,
		});

		mockedRunPMD.mockReturnValue({
			success: true,
			data: { violations: [] },
		});

		const tester = new RuleTester('rule.xml');
		const results = await tester.runCoverageTest(false);

		expect(results.detailedTestResults.length).toBe(1);
		expect(results.detailedTestResults[0]?.description).toContain('tested');
	});
});
