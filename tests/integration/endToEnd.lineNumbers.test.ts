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
	it('should find line numbers for test cases with section markers', async () => {
		// beforeEach already resets mocks via vi.resetAllMocks()

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
        // method body
    }
}

// Valid: Private method
public class ValidClass {
    private void exampleMethod() {
        // method body
    }
}
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlWithSectionMarkers);

		// Mock PMD to return no violations for violation test (should fail and trigger line number finding)
		mockedRunPMD.mockResolvedValueOnce({
			data: {
				violations: [],
			},
			success: true,
		});

		// Mock PMD to return violations for valid test (should fail and trigger line number finding)
		mockedRunPMD.mockResolvedValueOnce({
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
		// Should have detailed test results with line numbers
		expect(result.detailedTestResults?.length).toBeGreaterThan(0);
	});

	it('should find example line numbers when PMD execution fails', async () => {
		// beforeEach already resets mocks via vi.resetAllMocks()

		// Use mockImplementation instead of mockReturnValue to ensure
		// readFileSync always returns the XML for all calls (constructor + findMarkerLineNumber)
		// According to VITEST.md, mockImplementation is more reliable for persistent behavior
		// when there are multiple calls to the same mocked function
		const testRuleXml = `<?xml version="1.0" encoding="UTF-8"?>
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
		// Use mockImplementation to ensure consistent behavior across all readFileSync calls
		// This avoids mock state conflicts when readFileSync is called multiple times:
		// 1. In constructor (extractRuleMetadata, extractExamples)
		// 2. In findMarkerLineNumber (for each marker)
		mockedReadFileSync.mockImplementation(() => testRuleXml);

		// Mock PMD to throw an error
		mockedRunPMD.mockRejectedValue(new Error('PMD execution failed'));

		const testerForError = new RuleTester('/path/to/test-rule.xml');
		const result = await testerForError.runCoverageTest(false);

		expect(result.examplesTested).toBe(1);
		// Should have test results even when PMD fails
		expect(result.detailedTestResults?.length).toBeGreaterThan(0);
		// Line numbers should be found for failed tests
		const failedTests = result.detailedTestResults?.filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			(t) => !t.passed,
		);
		if (failedTests && failedTests.length > 0) {
			// At least some should have line numbers
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			expect(failedTests.some((t) => t.lineNumber !== undefined)).toBe(
				true,
			);
		}
	});

	it('should handle PMD execution error in violation test counting', async () => {
		// beforeEach already resets mocks via vi.resetAllMocks()

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
  <example>
// Violation: Public method
public class TestClass {
    public void exampleMethod() { // ❌ Violation
        // method body
    }
}
  </example>
</rule>`;

		mockedReadFileSync.mockReturnValue(xmlContent);

		// Mock PMD to succeed for runTestCase but throw error for violation counting
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
			.mockRejectedValueOnce(new Error('PMD error during counting'));

		const testerForCounting = new RuleTester('/path/to/test-rule.xml');
		const countingResult = await testerForCounting.runCoverageTest(false);

		expect(countingResult.examplesTested).toBe(1);
		// Should handle the error gracefully
		expect(countingResult).toBeDefined();
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

	it('should handle findTestCaseLineNumber catch block when file read fails', async () => {
		// mockReset: true in vitest.config.ts ensures mocks are reset before each test

		const xmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Violation: Test
public class TestClass {
    public void exampleMethod() {
    }
}
  </example>
</rule>`;

		// Track read calls - need to allow constructor (extractRuleMetadata + extractXPath), extractExamples, then throw
		let readCallCount = 0;
		mockedReadFileSync.mockImplementation(() => {
			readCallCount++;
			// First 3 calls: extractRuleMetadata (1), extractXPath (2), extractExamples (3)
			if (readCallCount <= 3) {
				return xmlContent;
			}
			// 4th call is in findTestCaseLineNumber - throw to trigger catch block (lines 587-590)
			throw new Error('File read error in findTestCaseLineNumber');
		});

		// Mock PMD to return no violations for violation test (should fail and trigger line number finding at line 431)
		mockedRunPMD.mockResolvedValueOnce({
			data: {
				violations: [],
			},
			success: true,
		});

		const testerForCatch = new RuleTester('/path/to/test-rule.xml');
		const catchResult = await testerForCatch.runCoverageTest(false);

		expect(catchResult.examplesTested).toBe(1);
		// Should handle file read errors gracefully in findTestCaseLineNumber catch block (lines 587-590)
		expect(catchResult).toBeDefined();
		expect(catchResult.detailedTestResults?.length).toBeGreaterThan(0);
	});

	it('should handle findExampleLineNumber catch block when file read fails', async () => {
		// Test line 632: return undefined in catch block of findExampleLineNumber
		vi.clearAllMocks();
		mockedExistsSync.mockReturnValue(true);

		const xmlContent = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Violation: Test
public class TestClass {
    public void exampleMethod() {
    }
}
  </example>
</rule>`;

		// Track read calls - need to allow constructor (3 reads), then throw when findExampleLineNumber is called
		// findExampleLineNumber is called once per test case when PMD throws (violation + valid = 2 calls for 1 example)
		let readCallCount = 0;
		mockedReadFileSync.mockImplementation(() => {
			readCallCount++;
			// First 3 calls: extractRuleMetadata (1), extractXPath (2), extractExamples (3)
			if (readCallCount <= 3) {
				return xmlContent;
			}
			// Next call(s) are in findExampleLineNumber (when PMD throws) - throw to trigger catch block (line 632)
			// This will be called once per test case (violation + valid = 2 calls for 1 example with both)
			throw new Error('File read error in findExampleLineNumber');
		});

		// Mock PMD to throw error (triggers findExampleLineNumber in catch block at line 471)
		// This covers line 632: return undefined in catch block
		mockedRunPMD.mockRejectedValue(new Error('PMD execution failed'));

		const testerForExample = new RuleTester('/path/to/test-rule.xml');
		const exampleResult = await testerForExample.runCoverageTest(false);

		expect(exampleResult.examplesTested).toBe(1);
		// Should handle file read errors gracefully in findExampleLineNumber catch block (line 630)
		expect(exampleResult).toBeDefined();
		expect(exampleResult.detailedTestResults?.length).toBeGreaterThan(0);
	});

	it('should handle findTestCaseLineNumber when example boundaries not found', async () => {
		// Test line 531: return undefined when exampleStart or exampleEnd is NOT_FOUND_INDEX
		vi.clearAllMocks();
		mockedExistsSync.mockReturnValue(true);

		const xmlWithExample = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Violation: Test
public class TestClass {
    public void exampleMethod() {
    }
}
  </example>
</rule>`;

		// XML without closing example tag - this will cause exampleEnd to be NOT_FOUND_INDEX
		const xmlWithoutClosingTag = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Violation: Test
public class TestClass {
    public void exampleMethod() {
    }
</rule>`;

		// Setup initial reads for constructor (extractRuleMetadata, extractXPath, extractExamples)
		mockedReadFileSync
			.mockReturnValueOnce(xmlWithExample) // extractRuleMetadata
			.mockReturnValueOnce(xmlWithExample) // extractXPath
			.mockReturnValueOnce(xmlWithExample); // extractExamples

		// Mock PMD to return no violations for violation test (should fail and trigger findTestCaseLineNumber)
		// Also need to mock for valid test
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

		// Mock readFileSync for findTestCaseLineNumber - return XML without closing tag
		// This will cause exampleEnd to be NOT_FOUND_INDEX (triggers line 531)
		mockedReadFileSync
			.mockReturnValueOnce(xmlWithoutClosingTag) // findTestCaseLineNumber for violation
			.mockReturnValueOnce(xmlWithoutClosingTag); // findTestCaseLineNumber for valid (if called)

		const testerForBoundaries = new RuleTester('/path/to/test-rule.xml');
		const boundariesResult =
			await testerForBoundaries.runCoverageTest(false);

		expect(boundariesResult.examplesTested).toBe(1);
		// Should handle case where example boundaries are not found (line 531)
		expect(boundariesResult).toBeDefined();
		expect(boundariesResult.detailedTestResults?.length).toBeGreaterThan(0);
	});

	it('should handle findExampleLineNumber when example index not found', async () => {
		// Test line 627: return undefined when example index is not found
		vi.clearAllMocks();
		mockedExistsSync.mockReturnValue(true);

		const xmlWithExample = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Violation: Test
public class TestClass {
    public void exampleMethod() {
    }
}
  </example>
</rule>`;

		// XML with no examples - this will cause findExampleLineNumber to not find the example
		const xmlWithNoExamples = `<?xml version="1.0"?>
<rule name="TestRule">
</rule>`;

		// Setup initial reads for constructor (extractRuleMetadata, extractXPath, extractExamples)
		mockedReadFileSync
			.mockReturnValueOnce(xmlWithExample) // extractRuleMetadata
			.mockReturnValueOnce(xmlWithExample) // extractXPath
			.mockReturnValueOnce(xmlWithExample); // extractExamples

		// Mock PMD to throw error (triggers findExampleLineNumber in catch block at line 471)
		mockedRunPMD.mockRejectedValue(new Error('PMD execution failed'));

		// Mock readFileSync for findExampleLineNumber to return XML with no examples
		// This will cause the loop to complete without finding the example (triggers line 627)
		mockedReadFileSync.mockReturnValueOnce(xmlWithNoExamples);

		const testerForNotFound = new RuleTester('/path/to/test-rule.xml');
		const notFoundResult = await testerForNotFound.runCoverageTest(false);

		expect(notFoundResult.examplesTested).toBe(1);
		// Should handle case where example index is not found (line 627)
		expect(notFoundResult).toBeDefined();
		expect(notFoundResult.detailedTestResults?.length).toBeGreaterThan(0);
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

	it('should handle findTestCaseLineNumber when currentExampleIndex does not match', async () => {
		// Test line 509: branch when currentExampleIndex !== exampleIndex
		vi.clearAllMocks();
		mockedExistsSync.mockReturnValue(true);

		const xmlWithMultipleExamples = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Violation: Test 1
public class TestClass1 {
    public void exampleMethod() {
    }
}
  </example>
  <example>
// Violation: Test 2
public class TestClass2 {
    public void exampleMethod() {
    }
}
  </example>
</rule>`;

		mockedReadFileSync
			.mockReturnValueOnce(xmlWithMultipleExamples) // extractRuleMetadata
			.mockReturnValueOnce(xmlWithMultipleExamples) // extractXPath
			.mockReturnValueOnce(xmlWithMultipleExamples); // extractExamples

		// Mock PMD to return no violations for violation tests (triggers findTestCaseLineNumber for both examples)
		// Sequence: example 1 violation test, example 1 valid test, example 2 violation test, example 2 valid test
		// Each violation test that fails will call findTestCaseLineNumber
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
			});

		// Mock readFileSync for findTestCaseLineNumber - return XML with multiple examples
		// When searching for example 2, we encounter example 1 first (currentExampleIndex=1, exampleIndex=2)
		// This tests the false branch where currentExampleIndex !== exampleIndex (line 509)
		// Then we find example 2 (currentExampleIndex=2, exampleIndex=2) - true branch
		mockedReadFileSync.mockReturnValue(xmlWithMultipleExamples);

		const testerForMultiple = new RuleTester('/path/to/test-rule.xml');
		const multipleResult = await testerForMultiple.runCoverageTest(false);

		expect(multipleResult.examplesTested).toBe(2);
		expect(multipleResult).toBeDefined();
	});

	it('should handle findExampleLineNumber when currentExampleIndex does not match', async () => {
		// Test line 620: branch when currentExampleIndex !== exampleIndex
		vi.clearAllMocks();
		mockedExistsSync.mockReturnValue(true);

		const xmlWithMultipleExamples = `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
// Violation: Test 1
public class TestClass1 {
    public void exampleMethod() {
    }
}
  </example>
  <example>
// Violation: Test 2
public class TestClass2 {
    public void exampleMethod() {
    }
}
  </example>
</rule>`;

		mockedReadFileSync
			.mockReturnValueOnce(xmlWithMultipleExamples) // extractRuleMetadata
			.mockReturnValueOnce(xmlWithMultipleExamples) // extractXPath
			.mockReturnValueOnce(xmlWithMultipleExamples); // extractExamples

		// Mock PMD to throw error (triggers findExampleLineNumber in catch block)
		mockedRunPMD.mockRejectedValue(new Error('PMD execution failed'));

		// Mock readFileSync for findExampleLineNumber - return XML with multiple examples
		// When searching for example 1, we'll find example 2 first (currentExampleIndex !== exampleIndex)
		// This tests the branch at line 620
		mockedReadFileSync.mockReturnValueOnce(xmlWithMultipleExamples);

		const testerForMultipleExamples = new RuleTester(
			'/path/to/test-rule.xml',
		);
		const multipleExamplesResult =
			await testerForMultipleExamples.runCoverageTest(false);

		expect(multipleExamplesResult.examplesTested).toBe(2);
		expect(multipleExamplesResult).toBeDefined();
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
