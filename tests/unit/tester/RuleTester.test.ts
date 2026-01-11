/**
 * @file
 * Unit tests for RuleTester class.
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
		}) as {
			existsSync: ReturnType<typeof vi.fn>;
			readFileSync: ReturnType<typeof vi.fn>;
		},
);

vi.mock(
	'../../../src/xpath/extractXPath.js',
	() =>
		({
			extractXPath: vi.fn(),
		}) as { extractXPath: ReturnType<typeof vi.fn> },
);

vi.mock(
	'../../../src/pmd/runPMD.js',
	() =>
		({
			runPMD: vi.fn(),
		}) as { runPMD: ReturnType<typeof vi.fn> },
);

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

	describe('extractRuleMetadata', () => {
		it('should extract rule metadata with successful xpath extraction', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <description>Test rule description</description>
  <priority>3</priority>
  <properties>
    <property name="xpath">
      <value>//Method[@Visibility='public']</value>
    </property>
  </properties>
</rule>`;

			mockedReadFileSync.mockReturnValue(xmlContent);
			const xpathResult1: FileOperationResult<string | null> = {
				data: "//Method[@Visibility='public']",
				success: true,
			};
			mockedExtractXPath.mockReturnValue(xpathResult1);

			const tester = new RuleTester('/path/to/test-rule.xml');
			const metadata = tester.extractRuleMetadata();

			expect(metadata).toEqual({
				description: 'Test rule description',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "//Method[@Visibility='public']",
			});
		});

		it('should handle xpath extraction failure', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <description>Test rule description</description>
  <priority>3</priority>
</rule>`;

			mockedReadFileSync.mockReturnValue(xmlContent);
			const xpathErrorResult: FileOperationResult<string | null> = {
				error: 'XPath extraction failed',
				success: false,
			};
			mockedExtractXPath.mockReturnValue(xpathErrorResult);

			const tester = new RuleTester('/path/to/test-rule.xml');
			const metadata = tester.extractRuleMetadata();

			expect(metadata).toEqual({
				description: 'Test rule description',
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: null,
			});
		});

		it('should handle rule without description element', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <priority>3</priority>
  <properties>
    <property name="xpath">
      <value>//Method[@Visibility='public']</value>
    </property>
  </properties>
</rule>`;

			mockedReadFileSync.mockReturnValue(xmlContent);
			const xpathResult: FileOperationResult<string | null> = {
				data: "//Method[@Visibility='public']",
				success: true,
			};
			mockedExtractXPath.mockReturnValue(xpathResult);

			const tester = new RuleTester('/path/to/test-rule.xml');
			const metadata = tester.extractRuleMetadata();

			expect(metadata).toEqual({
				description: null, // No description element
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "//Method[@Visibility='public']",
			});
		});

		it('should handle description element with empty text content', () => {
			// This test is to cover the case where descElement.textContent exists but is falsy
			// Since DOMParser behavior might vary, we'll test with an empty description element
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <description></description>
  <priority>3</priority>
  <properties>
    <property name="xpath">
      <value>//Method[@Visibility='public']</value>
    </property>
  </properties>
</rule>`;

			mockedReadFileSync.mockReturnValue(xmlContent);
			const xpathResult: FileOperationResult<string | null> = {
				data: "//Method[@Visibility='public']",
				success: true,
			};
			mockedExtractXPath.mockReturnValue(xpathResult);

			const tester = new RuleTester('/path/to/test-rule.xml');
			const metadata = tester.extractRuleMetadata();

			expect(metadata).toEqual({
				description: null, // Empty description content
				message: 'Test message',
				ruleName: 'TestRule',
				xpath: "//Method[@Visibility='public']",
			});
		});
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

			const tester = new RuleTester('/path/to/test-rule.xml');
			const examples = tester.extractExamples();

			expect(examples).toHaveLength(0); // Empty examples should be filtered out
		});
	});

	describe('cleanup', () => {
		it('should execute without error', () => {
			const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <description>Test rule description</description>
  <priority>3</priority>
</rule>`;

			mockedReadFileSync.mockReturnValue(xmlContent);
			const xpathResult: FileOperationResult<string | null> = {
				data: null,
				success: true,
			};
			mockedExtractXPath.mockReturnValue(xpathResult);

			const tester = new RuleTester('/path/to/test-rule.xml');

			// Should not throw an error
			expect(() => {
				tester.cleanup();
			}).not.toThrow();
		});
	});
});
