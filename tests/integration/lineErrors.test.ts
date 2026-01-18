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
});
