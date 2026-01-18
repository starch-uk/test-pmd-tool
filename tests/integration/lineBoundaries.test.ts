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
});
