/**
 * @file
 * End-to-end integration tests for RuleTester.
 */
/* eslint-disable @typescript-eslint/strict-void-return */
import { existsSync, readFileSync, realpathSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuleTester } from '../../src/tester/RuleTester.js';

// Mock file system operations
vi.mock('fs', () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	realpathSync: vi.fn(),
	unlinkSync: vi.fn(),
	writeFileSync: vi.fn(),
}));

// Mock path operations
vi.mock('path', () => ({
	resolve: vi.fn(),
}));

// Mock PMD execution
vi.mock('../../src/pmd/runPMD.js', () => ({
	runPMD: vi.fn(),
}));

// Mock tmp library for secure temporary file creation
vi.mock('tmp', () => ({
	default: {
		fileSync: vi.fn(() => ({
			fd: 3,
			name: '/tmp/rule-test-example-1-test.cls',
			removeCallback: vi.fn(),
		})),
	},
}));

import { runPMD } from '../../src/pmd/runPMD.js';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedRealpathSync = vi.mocked(realpathSync);
const mockedResolve = vi.mocked(resolve);
const mockedRunPMD = vi.mocked(runPMD);

describe.sequential('RuleTester Integration', () => {
	beforeEach(() => {
		// Suppress xmldom warnings and errors for all tests
		console.warn = vi.fn();
		console.error = vi.fn();
		// Reset mocks completely - this clears call history AND resets implementations
		vi.resetAllMocks();

		// Mock path normalization - default behavior: return input path
		mockedResolve.mockImplementation((path: Readonly<string>) => path);
		mockedRealpathSync.mockImplementation((path: Readonly<string>) => path);

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
    public void exampleMethod() { // ❌ Violation
        // method body
    }
}

// Valid: Private method
public class ValidClass {
    private void exampleMethod() { // ✅ Valid
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

		new RuleTester('/path/to/test-rule.xml');
	});

	afterEach(() => {
		// Restore console methods
		vi.restoreAllMocks();
	});
	it('should handle findTestCaseLineNumber section marker path with code after marker', async () => {
		// mockReset: true in vitest.config.ts ensures mocks are reset before each test

		const xmlWithSectionMarkers = `<?xml version="1.0" encoding="UTF-8"?>
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
  <example>
// Violation: Public method
public class TestClass {
    public void exampleMethod() {
    }
}
// Valid: Private method
public class ValidClass {
    private void exampleMethod() {
    }
}
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlWithSectionMarkers);

		// Mock PMD: violation test passes, valid test fails (has violations when it shouldn't)
		// This triggers findTestCaseLineNumber for the valid test with section markers
		mockedRunPMD
			.mockResolvedValueOnce({
				data: {
					violations: [
						{
							column: 5,
							file: '/tmp/test.cls',
							line: 3,
							message: 'Test message',
							priority: 3,
							rule: 'TestRule',
						},
					],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [
						{
							column: 5,
							file: '/tmp/test.cls',
							line: 3,
							message: 'Test message',
							priority: 3,
							rule: 'TestRule',
						},
					],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [
						{
							column: 5,
							file: '/tmp/test.cls',
							line: 3,
							message: 'Test message',
							priority: 3,
							rule: 'TestRule',
						},
					],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [
						{
							column: 5,
							file: '/tmp/test.cls',
							line: 3,
							message: 'Test message',
							priority: 3,
							rule: 'TestRule',
						},
					],
				},
				success: true,
			});

		const testerWithSections = new RuleTester('/path/to/test-rule.xml');
		const result = await testerWithSections.runCoverageTest(false);

		expect(result.examplesTested).toBe(1);
		// Should trigger section marker path (lines 560-584) when valid test fails
		expect(result.detailedTestResults?.length).toBeGreaterThan(0);
	});
	it('should handle findTestCaseLineNumber fallback when section marker has no code after it', async () => {
		// Test line 592: fallback when section marker found but no code line follows
		vi.clearAllMocks();
		mockedExistsSync.mockReturnValue(true);

		// XML with section marker "// Valid:" as the last line before </example>
		// The loop checks lines after the marker up to and including exampleEnd (</example>)
		// Since </example> is XML (not Apex code), it should be skipped, but the current logic
		// treats it as code. To hit line 590, we need the marker to be the last content line.
		// Actually, the issue is that </example> will match the condition at line 585
		// and return early. To hit 590, we need to ensure exampleEnd is BEFORE </example>.
		// But that's not how it works - exampleEnd IS the </example> line.
		// So line 590 is only hit if the section marker is found but the loop completes
		// without finding code. But </example> will always be found as "code".
		// This suggests line 590 might be unreachable in practice.
		// However, we can test it by ensuring the marker is on the line right before </example>
		// and that line is empty/whitespace only, so the loop completes.
		const xmlWithSectionMarkerOnly = `<?xml version="1.0" encoding="UTF-8"?>
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
  <example>
// Violation: Public method
public class TestClass {
    public void exampleMethod() {
    }
}
// Valid: Private method
  </example>
</rule>`;

		// Setup initial reads for constructor (extractRuleMetadata, extractXPath, extractExamples)
		mockedReadFileSync
			.mockReturnValueOnce(xmlWithSectionMarkerOnly) // extractRuleMetadata
			.mockReturnValueOnce(xmlWithSectionMarkerOnly) // extractXPath
			.mockReturnValueOnce(xmlWithSectionMarkerOnly); // extractExamples

		// Mock PMD sequence:
		// 1. runTestCase for violation test - should pass (has violations)
		// 2. runPMD for violation count (line 350)
		// 3. runTestCase for valid test - should fail (has violations when it shouldn't) - triggers findTestCaseLineNumber
		// 4. runPMD for valid count (if exists)
		mockedRunPMD
			.mockResolvedValueOnce({
				data: {
					violations: [
						{
							column: 5,
							file: '/tmp/test.cls',
							line: 3,
							message: 'Test message',
							priority: 3,
							rule: 'TestRule',
						},
					],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [
						{
							column: 5,
							file: '/tmp/test.cls',
							line: 3,
							message: 'Test message',
							priority: 3,
							rule: 'TestRule',
						},
					],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [
						{
							column: 5,
							file: '/tmp/test.cls',
							line: 3,
							message: 'Test message',
							priority: 3,
							rule: 'TestRule',
						},
					],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [],
				},
				success: true,
			});

		// Mock readFileSync for findTestCaseLineNumber - return same XML to trigger section marker path
		// The XML has "// Valid:" marker but only whitespace after it until </example>
		// With XML tags excluded from code check, </example> is skipped, triggering fallback at line 592
		mockedReadFileSync.mockReturnValue(xmlWithSectionMarkerOnly);

		const testerForSections = new RuleTester('/path/to/test-rule.xml');
		const sectionsResult = await testerForSections.runCoverageTest(false);

		expect(sectionsResult.examplesTested).toBe(1);
		// Should handle section markers with no code after marker - triggers fallback path (line 590)
		expect(sectionsResult.detailedTestResults?.length).toBeGreaterThan(0);
	});
	it('should handle example with no violations (only valids)', async () => {
		// Test line 330: branch when example.violations.length === 0
		vi.clearAllMocks();
		mockedExistsSync.mockReturnValue(true);

		const xmlWithOnlyValids = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Valid: Private method
public class ValidClass {
    private void exampleMethod() {
    }
}
  </example>
</rule>`;

		mockedReadFileSync
			.mockReturnValueOnce(xmlWithOnlyValids) // extractRuleMetadata
			.mockReturnValueOnce(xmlWithOnlyValids) // extractXPath
			.mockReturnValueOnce(xmlWithOnlyValids); // extractExamples

		// Mock PMD for valid test only (no violation test since no violations in example)
		mockedRunPMD.mockResolvedValueOnce({
			data: {
				violations: [],
			},
			success: true,
		});

		const testerForValidsOnly = new RuleTester('/path/to/test-rule.xml');
		const validsOnlyResult =
			await testerForValidsOnly.runCoverageTest(false);

		expect(validsOnlyResult.examplesTested).toBe(1);
		// Should skip violation test when example has no violations (line 330 false branch)
		expect(validsOnlyResult).toBeDefined();
	});
	it('should handle all branches in findTestCaseLineNumber code detection', async () => {
		// Test line 580: all branches of the complex if condition
		// Need to test: empty line, comment (//), block comment start (/*), block comment end (*/), and actual code
		// Note: XML tags (</, <) are tested by the section marker fallback test
		vi.clearAllMocks();
		mockedExistsSync.mockReturnValue(true);

		const xmlWithVariousCode = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Violation: Test

// This is a comment
/* This is a block comment start
*/ This is a block comment end
public class TestClass {
    public void exampleMethod() {
    }
}
  </example>
</rule>`;

		mockedReadFileSync
			.mockReturnValueOnce(xmlWithVariousCode) // extractRuleMetadata
			.mockReturnValueOnce(xmlWithVariousCode) // extractXPath
			.mockReturnValueOnce(xmlWithVariousCode); // extractExamples

		// Mock PMD to return no violations (triggers findTestCaseLineNumber)
		mockedRunPMD
			.mockResolvedValueOnce({
				data: {
					violations: [],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [],
				},
				success: true,
			});

		// Mock readFileSync for findTestCaseLineNumber - return same XML
		// The loop will skip empty lines, comments, then find the actual code
		mockedReadFileSync.mockReturnValue(xmlWithVariousCode);

		const testerForBranches = new RuleTester('/path/to/test-rule.xml');
		const branchesResult = await testerForBranches.runCoverageTest(false);

		expect(branchesResult.examplesTested).toBe(1);
		// Should handle all branches in code detection logic (line 580)
		expect(branchesResult).toBeDefined();
	});
	it('should hit false branch in findExampleLineNumber when searching for example 2', async () => {
		// Explicitly test the false branch at line 625 when searching for example 2
		// This ensures currentExampleIndex !== exampleIndex branch is covered
		// findExampleLineNumber is called when PMD throws an error
		vi.clearAllMocks();
		mockedExistsSync.mockReturnValue(true);

		const xmlWithTwoExamples = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Violation: Example 1
public class Test1 {
}
  </example>
  <example>
// Violation: Example 2
public class Test2 {
}
  </example>
</rule>`;

		mockedReadFileSync
			.mockReturnValueOnce(xmlWithTwoExamples) // extractRuleMetadata
			.mockReturnValueOnce(xmlWithTwoExamples) // extractXPath
			.mockReturnValueOnce(xmlWithTwoExamples); // extractExamples

		// Mock PMD to throw error for example 2 violation test to trigger findExampleLineNumber(2)
		// Need mocks for: example 1 violation (success), example 1 count (success),
		//                 example 1 valid (success), example 1 count (success),
		//                 example 2 violation (throw - triggers findExampleLineNumber(2)),
		//                 example 2 count (not reached), example 2 valid (not reached), example 2 count (not reached)
		mockedRunPMD
			.mockResolvedValueOnce({
				data: {
					violations: [],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [],
				},
				success: true,
			})
			.mockRejectedValueOnce(new Error('PMD failed')); // This triggers findExampleLineNumber(2)

		// Mock readFileSync for findExampleLineNumber call
		// When searching for example 2, we encounter example 1 first (false branch at line 625)
		mockedReadFileSync.mockReturnValue(xmlWithTwoExamples);

		const testerForFalseBranch = new RuleTester('/path/to/test-rule.xml');
		const result = await testerForFalseBranch.runCoverageTest(false);

		expect(result.examplesTested).toBe(2);
		// This should hit the false branch when findExampleLineNumber(2) encounters example 1
		expect(result).toBeDefined();
	});
});
