import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuleTester } from '../../../src/tester/RuleTester.js';
import { readFileSync } from 'fs';

// Mock dependencies
vi.mock('fs', () => ({
	readFileSync: vi.fn(),
	existsSync: vi.fn(),
}));

vi.mock('../../../src/xpath/extractXPath.js', () => ({
	extractXPath: vi.fn(),
}));

vi.mock('../../../src/pmd/runPMD.js', () => ({
	runPMD: vi.fn(),
}));

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedExtractXPath = vi.mocked(await import('../../../src/xpath/extractXPath.js')).extractXPath;

// Mock fs.existsSync to return true
vi.mocked(await import('fs')).existsSync.mockReturnValue(true);

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
			mockedExtractXPath.mockReturnValue({
				success: true,
				data: "//Method[@Visibility='public']",
			});

			const tester = new RuleTester('/path/to/test-rule.xml');
			const metadata = tester['extractRuleMetadata']();

			expect(metadata).toEqual({
				ruleName: 'TestRule',
				message: 'Test message',
				description: 'Test rule description',
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
			mockedExtractXPath.mockReturnValue({
				success: false,
				error: 'XPath extraction failed',
			});

			const tester = new RuleTester('/path/to/test-rule.xml');
			const metadata = tester['extractRuleMetadata']();

			expect(metadata).toEqual({
				ruleName: 'TestRule',
				message: 'Test message',
				description: 'Test rule description',
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
			mockedExtractXPath.mockReturnValue({
				success: true,
				data: "//Method[@Visibility='public']",
			});

			const tester = new RuleTester('/path/to/test-rule.xml');
			const metadata = tester['extractRuleMetadata']();

			expect(metadata).toEqual({
				ruleName: 'TestRule',
				message: 'Test message',
				description: null, // No description element
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
			mockedExtractXPath.mockReturnValue({
				success: true,
				data: "//Method[@Visibility='public']",
			});

			const tester = new RuleTester('/path/to/test-rule.xml');
			const metadata = tester['extractRuleMetadata']();

			expect(metadata).toEqual({
				ruleName: 'TestRule',
				message: 'Test message',
				description: null, // Empty description content
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
			const examples = tester['extractExamples']();

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
			mockedExtractXPath.mockReturnValue({
				success: true,
				data: null,
			});

			const tester = new RuleTester('/path/to/test-rule.xml');

			// Should not throw an error
			expect(() => tester.cleanup()).not.toThrow();
		});
	});
});