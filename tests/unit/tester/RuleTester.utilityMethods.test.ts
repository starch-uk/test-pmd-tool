/**
 * @file
 * Utility method tests for RuleTester.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuleTester } from '../../../src/tester/RuleTester.js';

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
		vi.clearAllMocks();
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
});
