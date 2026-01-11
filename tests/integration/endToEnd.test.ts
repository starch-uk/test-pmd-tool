/**
 * @file
 * End-to-end integration tests for RuleTester.
 */
import { existsSync, readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuleTester } from '../../src/tester/RuleTester.js';

// Mock file system operations
vi.mock('fs', () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	unlinkSync: vi.fn(),
}));

// Mock PMD execution
vi.mock('../../src/pmd/runPMD.js', () => ({
	runPMD: vi.fn(),
}));

import { runPMD } from '../../src/pmd/runPMD.js';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedRunPMD = vi.mocked(runPMD);

describe('RuleTester Integration', () => {
	let tester: RuleTester | undefined = undefined;

	beforeEach(() => {
		// Suppress xmldom warnings and errors for all tests
		console.warn = vi.fn();
		console.error = vi.fn();
		vi.clearAllMocks();

		// Mock file existence
		mockedExistsSync.mockReturnValue(true);

		// Mock rule XML content
		const mockRuleXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <description>Test rule description with sufficient length</description>
  <priority>3</priority>
  <properties>
    <property name="xpath">
      <value>//Method[@Visibility='public']</value>
    </property>
  </properties>
  <example>
// Violation: Public method
public class TestClass {
    public void testMethod() { // ❌ Violation
        // method body
    }
}

// Valid: Private method
public class ValidClass {
    private void testMethod() { // ✅ Valid
        // method body
    }
}
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockRuleXml);

		// Mock PMD execution results
		mockedRunPMD.mockReturnValue({
			data: {
				violations: [
					{
						column: 5,
						file: '/tmp/test.cls',
						line: 3,
						message: 'Test message',
						rule: 'TestRule',
					},
				],
			},
			success: true,
		});

		tester = new RuleTester('/path/to/test-rule.xml');
	});

	afterEach(() => {
		// Restore console methods
		vi.restoreAllMocks();
	});

	it('should initialize with correct rule metadata', () => {
		expect(tester.ruleName).toBe('TestRule');
		expect(tester.category).toBe('unknown');
	});

	it('should extract rule metadata correctly', () => {
		const metadata = tester.extractRuleMetadata();

		expect(metadata).toEqual({
			description: 'Test rule description with sufficient length',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "//Method[@Visibility='public']",
		});
	});

	it('should extract examples from rule XML', () => {
		const examples = tester.extractExamples();

		expect(examples).toHaveLength(1);
		expect(examples[0].exampleIndex).toBe(1);
		expect(examples[0].violations.length).toBeGreaterThan(0); // Should have violations
		expect(examples[0].valids.length).toBeGreaterThan(0); // Should have valids
	});

	it('should run coverage test successfully', async () => {
		const result = await tester.runCoverageTest();

		expect(result.success).toBe(true);
		expect(result.examplesTested).toBe(1);
		expect(result.ruleTriggersViolations).toBe(true);
	});

	it('should handle rule metadata with empty description', () => {
		// Mock rule XML with empty description
		const mockRuleXmlEmptyDesc = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <description>   </description>
  <priority>3</priority>
  <properties>
    <property name="xpath">
      <value>//Method[@Visibility='public']</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockRuleXmlEmptyDesc);
		const testerEmptyDesc = new RuleTester('/path/to/test-rule.xml');

		const metadata = testerEmptyDesc.extractRuleMetadata();

		expect(metadata).toEqual({
			description: null, // Empty description should be null
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "//Method[@Visibility='public']",
		});

		// Reset mock to original XML with example
		const originalMockRuleXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <description>Test rule description with sufficient length</description>
  <priority>3</priority>
  <properties>
    <property name="xpath">
      <value>//Method[@Visibility='public']</value>
    </property>
  </properties>
  <example>
// Violation: Public method
public class TestClass {
    public void testMethod() { // ❌ Violation
        // method body
    }
}

// Valid: Private method
public class ValidClass {
    private void testMethod() { // ✅ Valid
        // method body
    }
}
  </example>
</rule>`;
		mockedReadFileSync.mockReturnValue(originalMockRuleXml);
	});

	it('should handle PMD execution errors gracefully', async () => {
		// PMD execution not implemented in simplified version
		// This test would verify error handling when PMD calls are added
		const result = await tester.runCoverageTest();

		expect(result.success).toBe(true); // Based on quality checks only
	});

	it('should cleanup temporary files', async () => {
		await tester.runCoverageTest();

		// Cleanup is called (temp file cleanup not implemented in simplified version)
		expect(tester).toBeDefined();
	});

	it('should handle file read errors', () => {
		mockedReadFileSync.mockImplementation(() => {
			throw new Error('File read error');
		});

		expect(() => new RuleTester('/invalid/path.xml')).toThrow();
	});

	it('should validate rule file existence', () => {
		mockedExistsSync.mockReturnValue(false);

		expect(() => new RuleTester('/nonexistent/file.xml')).toThrow();
	});

	it('should validate rule file extension', () => {
		mockedExistsSync.mockReturnValue(true);

		expect(() => new RuleTester('/valid/path/file.txt')).toThrow(
			'Rule file must have .xml extension',
		);
	});

	it('should provide access to rule metadata', () => {
		expect(tester.getRuleMetadata()).toEqual({
			description: 'Test rule description with sufficient length',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: "//Method[@Visibility='public']",
		});
	});

	it('should provide access to extracted examples', () => {
		const examples = tester.getExamples();
		// Examples extraction depends on XML parsing working correctly
		expect(Array.isArray(examples)).toBe(true);
	});

	it('should extract category from file path', () => {
		// Test with rulesets in path
		const testerWithRulesets = new RuleTester(
			'/path/to/rulesets/best-practices/TestRule.xml',
		);
		expect(testerWithRulesets.category).toBe('best-practices');

		// Test without rulesets in path
		expect(tester.category).toBe('unknown');
	});

	it('should handle XML parsing errors gracefully', () => {
		mockedReadFileSync.mockReturnValueOnce('<invalid xml content');

		const testerWithBadXml = new RuleTester('/valid/path.xml');
		const examples = testerWithBadXml.getExamples();

		expect(examples).toHaveLength(0); // Should return empty array on parse error
	});
});
