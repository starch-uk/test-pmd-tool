/**
 * @file
 * Example extraction tests for RuleTester.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuleTester } from '../../../src/tester/RuleTester.js';
import type { FileOperationResult } from '../../../src/types/index.js';

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

	describe('extractExamples', () => {
		it('should handle examples with null text content', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <description>Test rule description</description>
  <priority>3</priority>
  <example></example>
  <example>   </example>
</rule>`;

			mockedReadFileSync.mockReturnValue(xmlContent);
			const xpathResult: FileOperationResult<string | null> = {
				data: null,
				success: true,
			};
			mockedExtractXPath.mockReturnValue(xpathResult);

			const tester = new RuleTester('/path/to/test-rule.xml');
			const examples = tester.extractExamples();

			expect(examples).toHaveLength(0); // Empty examples should be filtered out
		});
	});
});
