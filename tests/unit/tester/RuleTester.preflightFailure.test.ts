/**
 * @file
 * Covers RuleTester preflight failure paths (AST parse pre-check).
 */
import { describe, expect, it, vi } from 'vitest';
import { RuleTester } from '../../../src/tester/RuleTester.js';

vi.mock('fs', () => ({
	existsSync: vi.fn(() => true),
	readFileSync: vi.fn(),
}));

vi.mock('../../../src/parser/parseExample.js', () => ({
	parseExample: vi.fn(),
}));

vi.mock('../../../src/parser/apexParser.js', () => ({
	isValidParseResult: vi.fn(() => false),
	parseApexCode: vi.fn(() => ({
		ast: undefined,
		errors: [{ message: 'boom', severity: 'error' }],
		isUsable: false,
		partialSuccess: false,
	})),
}));

const fsModule = await import('fs');
const mockedReadFileSync = vi.mocked(fsModule.readFileSync);

interface ParseExampleModule {
	parseExample: ReturnType<typeof vi.fn>;
}
const parseExampleModule = await import('../../../src/parser/parseExample.js');
const mockedParseExample = vi.mocked(
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Dynamic import typing
	(parseExampleModule as ParseExampleModule).parseExample,
);

describe('RuleTester preflight', () => {
	it('aborts the rule run when an example is not parsable', async () => {
		mockedReadFileSync.mockReturnValue(`<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" language="apex" message="m" class="c">
  <description>d</description>
  <priority>3</priority>
  <example><![CDATA[public class Example {}]]></example>
</rule>`);

		mockedParseExample.mockReturnValue({
			content: 'public class Example {}',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		});

		const tester = new RuleTester('rule.xml');
		await expect(tester.runCoverageTest(false)).rejects.toThrow(
			'Example 1 cannot be parsed by ts-summit-ast',
		);
	});
});
