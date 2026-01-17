/**
 * @file
 * Utility method tests for RuleTester.
 */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Test helpers intentionally use simple parameter types for clarity */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuleTester } from '../../../src/tester/RuleTester.js';
import type { ExampleData } from '../../../src/types/index.js';

// Mock dependencies
vi.mock(
	'fs',
	() =>
		({
			existsSync: vi.fn(),
			readFileSync: vi.fn(),
			writeFileSync: vi.fn(),
		}) as {
			existsSync: ReturnType<typeof vi.fn>;
			readFileSync: ReturnType<typeof vi.fn>;
			writeFileSync: ReturnType<typeof vi.fn>;
		},
);

vi.mock('tmp', () => ({
	default: {
		fileSync: vi.fn(() => ({
			fd: 3,
			name: '/tmp/rule-test-example-1-test.cls',
			removeCallback: vi.fn(),
		})),
	},
}));

vi.mock(
	'../../../src/xpath/extractXPath.js',
	() =>
		({
			extractXPath: vi.fn(),
		}) as { extractXPath: ReturnType<typeof vi.fn> },
);

vi.mock('../../../src/pmd/runPMD.js', () => ({
	runPMD: vi.fn(),
}));

vi.mock('tmp', () => ({
	default: {
		fileSync: vi.fn(() => ({
			fd: 3,
			name: '/tmp/rule-test-example-1-test.cls',
			removeCallback: vi.fn(),
		})),
	},
}));

vi.mock('../../../src/parser/createTestFile.js', () => ({
	createTestFile: vi.fn(
		({ exampleIndex }: Readonly<{ exampleIndex: number }>) => ({
			filePath: `/tmp/test-${String(exampleIndex)}.cls`,
			hasValids: true,
			hasViolations: true,
			validCount: 0,
			violationCount: 1,
		}),
	),
}));

const mockedReadFileSync = vi.mocked(readFileSync);

// Import modules with proper typing
interface ExtractXPathModule {
	extractXPath: ReturnType<typeof vi.fn>;
}
const extractXPathModule = await import('../../../src/xpath/extractXPath.js');
const mockedExtractXPath = vi.mocked(
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Dynamic import requires type assertion
	(extractXPathModule as ExtractXPathModule).extractXPath,
);

// Mock fs.existsSync to return true
interface FsModule {
	existsSync: ReturnType<typeof vi.fn>;
}
const fsModule = await import('fs');
const mockedExistsSync = vi.mocked(
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Dynamic import requires type assertion
	(fsModule as FsModule).existsSync,
);
mockedExistsSync.mockReturnValue(true);

describe('RuleTester', () => {
	beforeEach(() => {
		// Mocks are cleared automatically by clearMocks: true in vitest.config.ts
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return undefined when example line number not found', () => {
		mockedExtractXPath.mockReturnValue({
			error: 'xpath extraction failed',
			success: false,
		});
		// Minimal rule file with no <example> tags
		mockedReadFileSync.mockReturnValue(
			`<?xml version="1.0" encoding="UTF-8"?>\n<rule name="R" message="m">\n</rule>`,
		);
		const tester = new RuleTester('/tmp/rule.xml');
		interface PrivateExampleLineFinder {
			findExampleLineNumber: (n: number) => number | undefined;
		}

		/**
		 * Safely access RuleTester private method for coverage.
		 * @param value - Unknown value to inspect.
		 * @returns Typed accessor or undefined when unavailable.
		 */
		function getPrivateExampleLineFinder(
			value: unknown,
		): PrivateExampleLineFinder | undefined {
			if (value == null || typeof value !== 'object') {
				return undefined;
			}
			if (!('findExampleLineNumber' in value)) {
				return undefined;
			}
			const maybeFn = (value as { findExampleLineNumber?: unknown })
				.findExampleLineNumber;
			if (typeof maybeFn !== 'function') {
				return undefined;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Guarded by runtime checks above
			return value as PrivateExampleLineFinder;
		}

		const finder = getPrivateExampleLineFinder(tester);
		expect(finder).toBeDefined();
		expect(finder?.findExampleLineNumber(1)).toBeUndefined();
	});

	it('should find example line number when example exists', () => {
		mockedExtractXPath.mockReturnValue({
			error: 'xpath extraction failed',
			success: false,
		});

		// XML with a single <example> tag so that findExampleLineNumber
		// can successfully locate the example line.
		const xmlWithExample = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="R" message="m">
  <description>Example rule</description>
  <example>
    // Example content
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlWithExample);

		const tester = new RuleTester('/tmp/rule-with-example.xml');
		// Accessing tested private method for coverage - using type guard pattern
		interface PrivateExampleLineFinder {
			findExampleLineNumber: (n: number) => number | undefined;
		}

		/**
		 * Safely access RuleTester private method for coverage.
		 * @param value - Unknown value to inspect.
		 * @returns Typed accessor or undefined when unavailable.
		 */
		function getPrivateExampleLineFinder(
			value: unknown,
		): PrivateExampleLineFinder | undefined {
			if (value === null || typeof value !== 'object') {
				return undefined;
			}
			if (!('findExampleLineNumber' in value)) {
				return undefined;
			}
			const maybeFn = (value as { findExampleLineNumber?: unknown })
				.findExampleLineNumber;
			if (typeof maybeFn !== 'function') {
				return undefined;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Guarded by runtime checks above
			return value as PrivateExampleLineFinder;
		}

		const finder = getPrivateExampleLineFinder(tester);
		expect(finder).toBeDefined();
		const lineNumber = finder?.findExampleLineNumber(1);
		expect(lineNumber).toBeDefined();
	});

	it('should map marker line numbers using CDATA fallback and inline marker paths', () => {
		mockedExtractXPath.mockReturnValue({
			error: 'xpath extraction failed',
			success: false,
		});

		// XML with CDATA-wrapped example content so that findMarkerLineNumber
		// must use the fallback that looks for <![CDATA[ and then maps by offset.
		const xmlWithCdataExample = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="R" message="m">
  <description>Example rule</description>
  <example>
    <![CDATA[
Line one
Line two
Line three
    ]]>
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlWithCdataExample);

		const tester = new RuleTester('/tmp/rule-with-cdata.xml');

		interface PrivateMarkerLineFinder {
			findMarkerLineNumber: (
				example: Readonly<ExampleData>,
				exampleIndex: number,
				markerLineNumber: number,
			) => number | undefined;
		}

		/**
		 * Safely access RuleTester private marker line finder for coverage.
		 * @param value - Instance that may contain the private method.
		 * @returns Typed accessor or undefined when unavailable.
		 */
		function getPrivateMarkerLineFinder(
			value: unknown,
		): PrivateMarkerLineFinder | undefined {
			if (value == null || typeof value !== 'object') {
				return undefined;
			}
			if (!('findMarkerLineNumber' in value)) {
				return undefined;
			}
			const maybeFn = (value as { findMarkerLineNumber?: unknown })
				.findMarkerLineNumber;
			if (typeof maybeFn !== 'function') {
				return undefined;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Guarded by runtime checks above
			return value as PrivateMarkerLineFinder;
		}

		const finder = getPrivateMarkerLineFinder(tester);
		expect(finder).toBeDefined();

		const exampleWithCdata: ExampleData = {
			content: 'Line one\nLine two\nLine three',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		// Marker line 2 (1-based) should map to the second code line inside the CDATA block.
		const xmlLineNumber = finder?.findMarkerLineNumber(
			exampleWithCdata,
			1,
			2,
		);
		expect(xmlLineNumber).toBeDefined();

		// Test out-of-bounds markerLineNumber to cover line 559 early return
		const outOfBoundsEarlyReturn = finder?.findMarkerLineNumber(
			exampleWithCdata,
			1,
			100, // Way beyond the 3 lines in the example
		);
		expect(outOfBoundsEarlyReturn).toBeUndefined();

		// Now exercise the inline marker paths where there is no code before the marker
		// so that codePart is empty and the "no code part" branches are used.
		const xmlWithInlineMarkers = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="R" message="m">
  <description>Example rule</description>
  <example>
SomeCode(); // ❌
OtherCode(); // ✅
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlWithInlineMarkers);

		const exampleWithInlineMarkers: ExampleData = {
			content: 'SomeCode(); // ❌\nOtherCode(); // ✅',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		const inlineViolationLine = finder?.findMarkerLineNumber(
			exampleWithInlineMarkers,
			1,
			1,
		);
		const inlineValidLine = finder?.findMarkerLineNumber(
			exampleWithInlineMarkers,
			1,
			2,
		);
		expect(inlineViolationLine).toBeDefined();
		expect(inlineValidLine).toBeDefined();

		// Test lines that start with just the marker (no code part) to cover lines 590 and 607
		const xmlWithJustMarkers = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="R" message="m">
  <description>Example rule</description>
  <example>
// ❌
// ✅
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlWithJustMarkers);

		const exampleWithJustMarkers: ExampleData = {
			content: '// ❌\n// ✅',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		// These should hit the "no code part" branches (lines 590 and 607)
		const justViolationLine = finder?.findMarkerLineNumber(
			exampleWithJustMarkers,
			1,
			1,
		);
		const justValidLine = finder?.findMarkerLineNumber(
			exampleWithJustMarkers,
			1,
			2,
		);
		expect(justViolationLine).toBeDefined();
		expect(justValidLine).toBeDefined();

		// Test codePart matching to cover lines 585 and 603 (when codePart exists and is found in XML)
		// The codePart must match exactly in the XML line for the true branch to be hit
		const xmlWithCodeParts = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="R" message="m">
  <description>Example rule</description>
  <example>
SomeMethod(); // ❌
AnotherMethod(); // ✅
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlWithCodeParts);

		const exampleWithCodeParts: ExampleData = {
			content: 'SomeMethod(); // ❌\nAnotherMethod(); // ✅',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		// These should hit the codePart.includes branches (lines 585 and 603) - true branch
		// The codePart "SomeMethod();" should be found in the XML line "SomeMethod(); // ❌"
		const codePartViolationLine = finder?.findMarkerLineNumber(
			exampleWithCodeParts,
			1,
			1,
		);
		const codePartValidLine = finder?.findMarkerLineNumber(
			exampleWithCodeParts,
			1,
			2,
		);
		expect(codePartViolationLine).toBeDefined();
		expect(codePartValidLine).toBeDefined();

		// Test case where codePart exists but doesn't match in XML to cover lines 592 and 609 false branch
		// This tests: hasCodePart=true, codePartMatches=false (codePart exists but not found in xmlLine)
		const xmlWithNonMatchingCodeParts = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="R" message="m">
  <description>Example rule</description>
  <example>
DifferentCode(); // ❌
OtherCode(); // ✅
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlWithNonMatchingCodeParts);

		const exampleWithNonMatchingCodeParts: ExampleData = {
			content: 'SomeMethod(); // ❌\nAnotherMethod(); // ✅',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		// These should hit the false branch: hasCodePart is true but codePartMatches is false
		// The codePart "SomeMethod();" won't be found in "DifferentCode(); // ❌"
		// This causes the condition at line 592/609 to be false (hasCodePart=true, codePartMatches=false)
		// The loop continues, and since there's only one line with each marker, it falls through to fallback
		// The fallback will return undefined since there's no CDATA in this XML
		const nonMatchingViolationLine = finder?.findMarkerLineNumber(
			exampleWithNonMatchingCodeParts,
			1,
			1,
		);
		const nonMatchingValidLine = finder?.findMarkerLineNumber(
			exampleWithNonMatchingCodeParts,
			1,
			2,
		);
		// Should return undefined since codePart doesn't match and no CDATA fallback
		expect(nonMatchingViolationLine).toBeUndefined();
		expect(nonMatchingValidLine).toBeUndefined();

		// Test fallback path: when loop doesn't find a match, fallback uses CDATA offset
		const xmlWithFallback = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="R" message="m">
  <description>Example rule</description>
  <example>
    <![CDATA[
Line one
    ]]>
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlWithFallback);

		const exampleWithFallback: ExampleData = {
			content: 'Line one',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		// Use markerLineNumber=1 (within bounds, example has 1 line)
		// markerLineInExample will be "Line one" (no markers), so loop won't find a match
		// Falls through to fallback, which finds CDATA and calculates line number
		const fallbackResult = finder?.findMarkerLineNumber(
			exampleWithFallback,
			1,
			1, // Within bounds (example has 1 line)
		);
		// Should find a line via fallback
		expect(fallbackResult).toBeDefined();
	});

	it('should handle findMarkerLineInTestFile with out-of-bounds markerLineNumber', () => {
		mockedExtractXPath.mockReturnValue({
			error: 'xpath extraction failed',
			success: false,
		});

		mockedReadFileSync.mockReturnValue(
			`<?xml version="1.0" encoding="UTF-8"?>\n<rule name="R" message="m">\n</rule>`,
		);

		const tester = new RuleTester('/tmp/rule.xml');

		interface PrivateMarkerLineInTestFileFinder {
			findMarkerLineInTestFile: (
				example: Readonly<ExampleData>,
				markerLineNumber: number,
				testFilePath: string,
			) => number | undefined;
		}

		/**
		 * Safely access RuleTester private method for coverage.
		 * @param value - Unknown value to inspect.
		 * @returns Typed accessor or undefined when unavailable.
		 */
		function getPrivateMarkerLineInTestFileFinder(
			value: unknown,
		): PrivateMarkerLineInTestFileFinder | undefined {
			if (value == null || typeof value !== 'object') {
				return undefined;
			}
			if (!('findMarkerLineInTestFile' in value)) {
				return undefined;
			}
			const maybeFn = (value as { findMarkerLineInTestFile?: unknown })
				.findMarkerLineInTestFile;
			if (typeof maybeFn !== 'function') {
				return undefined;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Guarded by runtime checks above
			return value as PrivateMarkerLineInTestFileFinder;
		}

		const finder = getPrivateMarkerLineInTestFileFinder(tester);
		expect(finder).toBeDefined();

		const example: ExampleData = {
			content: 'Line one\nLine two',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		// Test out-of-bounds markerLineNumber (negative)
		mockedReadFileSync.mockReturnValue('Test file content');
		const negativeResult = finder?.findMarkerLineInTestFile(
			example,
			-1, // Out of bounds (negative)
			'/tmp/test.cls',
		);
		expect(negativeResult).toBeUndefined();

		// Test out-of-bounds markerLineNumber (too large)
		const tooLargeResult = finder?.findMarkerLineInTestFile(
			example,
			100, // Out of bounds (example only has 2 lines)
			'/tmp/test.cls',
		);
		expect(tooLargeResult).toBeUndefined();
	});

	it('should handle findMarkerLineInTestFile with valid marker and empty codeToFind', () => {
		mockedExtractXPath.mockReturnValue({
			error: 'xpath extraction failed',
			success: false,
		});

		mockedReadFileSync.mockReturnValue(
			`<?xml version="1.0" encoding="UTF-8"?>\n<rule name="R" message="m">\n</rule>`,
		);

		const tester = new RuleTester('/tmp/rule.xml');

		interface PrivateMarkerLineInTestFileFinder {
			findMarkerLineInTestFile: (
				example: Readonly<ExampleData>,
				markerLineNumber: number,
				testFilePath: string,
			) => number | undefined;
		}

		/**
		 * Safely access RuleTester private method for coverage.
		 * @param value - Unknown value to inspect.
		 * @returns Typed accessor or undefined when unavailable.
		 */
		function getPrivateMarkerLineInTestFileFinder(
			value: unknown,
		): PrivateMarkerLineInTestFileFinder | undefined {
			if (value == null || typeof value !== 'object') {
				return undefined;
			}
			if (!('findMarkerLineInTestFile' in value)) {
				return undefined;
			}
			const maybeFn = (value as { findMarkerLineInTestFile?: unknown })
				.findMarkerLineInTestFile;
			if (typeof maybeFn !== 'function') {
				return undefined;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Guarded by runtime checks above
			return value as PrivateMarkerLineInTestFileFinder;
		}

		const finder = getPrivateMarkerLineInTestFileFinder(tester);
		expect(finder).toBeDefined();

		// Test with empty codeToFind (line with only marker, no code)
		const exampleWithEmptyCode: ExampleData = {
			content: '// ❌\n// ✅',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		mockedReadFileSync.mockReturnValue('Test file content');
		const emptyCodeResult = finder?.findMarkerLineInTestFile(
			exampleWithEmptyCode,
			1, // First line is "// ❌" which will result in empty codeToFind
			'/tmp/test.cls',
		);
		expect(emptyCodeResult).toBeUndefined();
	});

	it('should handle findMarkerLineInTestFile with valid marker', () => {
		mockedExtractXPath.mockReturnValue({
			error: 'xpath extraction failed',
			success: false,
		});

		mockedReadFileSync.mockReturnValue(
			`<?xml version="1.0" encoding="UTF-8"?>\n<rule name="R" message="m">\n</rule>`,
		);

		const tester = new RuleTester('/tmp/rule.xml');

		interface PrivateMarkerLineInTestFileFinder {
			findMarkerLineInTestFile: (
				example: Readonly<ExampleData>,
				markerLineNumber: number,
				testFilePath: string,
			) => number | undefined;
		}

		/**
		 * Safely access RuleTester private method for coverage.
		 * @param value - Unknown value to inspect.
		 * @returns Typed accessor or undefined when unavailable.
		 */
		function getPrivateMarkerLineInTestFileFinder(
			value: unknown,
		): PrivateMarkerLineInTestFileFinder | undefined {
			if (value == null || typeof value !== 'object') {
				return undefined;
			}
			if (!('findMarkerLineInTestFile' in value)) {
				return undefined;
			}
			const maybeFn = (value as { findMarkerLineInTestFile?: unknown })
				.findMarkerLineInTestFile;
			if (typeof maybeFn !== 'function') {
				return undefined;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Guarded by runtime checks above
			return value as PrivateMarkerLineInTestFileFinder;
		}

		const finder = getPrivateMarkerLineInTestFileFinder(tester);
		expect(finder).toBeDefined();

		// Test with valid marker (// ✅)
		const exampleWithValidMarker: ExampleData = {
			content: 'SomeCode(); // ✅',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		mockedReadFileSync.mockReturnValue('    SomeCode(); // ✅');
		const validMarkerResult = finder?.findMarkerLineInTestFile(
			exampleWithValidMarker,
			1, // Line with "// ✅" marker
			'/tmp/test.cls',
		);
		expect(validMarkerResult).toBeDefined();
	});

	it('should return undefined when test file does not exist', () => {
		mockedExtractXPath.mockReturnValue({
			error: 'xpath extraction failed',
			success: false,
		});

		mockedReadFileSync.mockReturnValue(
			`<?xml version="1.0" encoding="UTF-8"?>\n<rule name="R" message="m">\n</rule>`,
		);

		const tester = new RuleTester('/tmp/rule.xml');

		interface PrivateMarkerLineInTestFileFinder {
			findMarkerLineInTestFile: (
				example: Readonly<ExampleData>,
				markerLineNumber: number,
				testFilePath: string,
			) => number | undefined;
		}

		/**
		 * Safely access RuleTester private method for coverage.
		 * @param value - Unknown value to inspect.
		 * @returns Typed accessor or undefined when unavailable.
		 */
		function getPrivateMarkerLineInTestFileFinder(
			value: unknown,
		): PrivateMarkerLineInTestFileFinder | undefined {
			if (value == null || typeof value !== 'object') {
				return undefined;
			}
			if (!('findMarkerLineInTestFile' in value)) {
				return undefined;
			}
			const maybeFn = (value as { findMarkerLineInTestFile?: unknown })
				.findMarkerLineInTestFile;
			if (typeof maybeFn !== 'function') {
				return undefined;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Guarded by runtime checks above
			return value as PrivateMarkerLineInTestFileFinder;
		}

		const finder = getPrivateMarkerLineInTestFileFinder(tester);
		expect(finder).toBeDefined();

		// Mock existsSync to return false (file doesn't exist)
		mockedExistsSync.mockReturnValue(false);

		const example: ExampleData = {
			content: 'SomeCode(); // ❌',
			exampleIndex: 1,
			validMarkers: [],
			valids: [],
			violationMarkers: [],
			violations: [],
		};

		const result = finder?.findMarkerLineInTestFile(
			example,
			1,
			'/tmp/nonexistent.cls',
		);
		expect(result).toBeUndefined();
	});
});
