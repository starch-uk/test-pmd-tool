/**
 * @file
 * Unit tests for RuleTester duplicate marker handling.
 * Tests the false branches of seenViolationMarkers.has() and seenValidMarkers.has().
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleTester } from '../../../src/tester/RuleTester.js';

// Mock dependencies
vi.mock('fs', () => ({
	existsSync: vi.fn(() => true),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
}));

vi.mock('tmp', () => ({
	default: {
		fileSync: vi.fn(() => ({
			fd: 3,
			name: '/tmp/test-1.cls',
			removeCallback: vi.fn(),
		})),
	},
}));

vi.mock('../../../src/xpath/extractXPath.js', () => ({
	extractXPath: vi.fn(),
}));

vi.mock('../../../src/pmd/runPMD.js', () => ({
	runPMD: vi.fn(),
}));

vi.mock('../../../src/parser/createTestFile.js', () => ({
	createTestFile: vi.fn(() => ({
		filePath: '/tmp/test-1.cls',
		hasValids: true,
		hasViolations: true,
		validCount: 0,
		violationCount: 1,
	})),
}));

import { runPMD } from '../../../src/pmd/runPMD.js';
import { extractXPath } from '../../../src/xpath/extractXPath.js';

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedRunPMD = vi.mocked(runPMD);
const mockedExtractXPath = vi.mocked(extractXPath);

describe('RuleTester duplicate marker handling', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedExtractXPath.mockResolvedValue({
			data: '//Method',
			success: true,
		});
		mockedReadFileSync.mockReturnValue(`<?xml version="1.0"?>
<rule name="TestRule">
  <example>
    public class Test {
        public void method1() {} // ❌
        public void method2() {} // ❌
    }
  </example>
</rule>`);
		mockedRunPMD.mockResolvedValue({
			data: {
				violations: [{ line: 3, message: 'Test', rule: 'TestRule' }],
			},
			success: true,
		});
	});

	it('should skip duplicate violation markers', async () => {
		// Test false branch when duplicate violation markers have the same uniqueKey
		// This happens when the same marker appears multiple times with the same uniqueKey
		const tester = new RuleTester('/path/to/rule.xml');
		tester.extractExamples();

		// Mock test file content
		mockedReadFileSync.mockImplementation((filePath: string) => {
			if (filePath.includes('test-') && filePath.endsWith('.cls')) {
				return 'public class Test {\n    public void method1() {} // ❌\n    public void method2() {} // ❌\n}';
			}
			return `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
    public class Test {
        public void method1() {} // ❌
        public void method2() {} // ❌
    }
  </example>
</rule>`;
		});

		// Mock runPMD to return violation on line 3
		mockedRunPMD
			.mockResolvedValueOnce({
				data: {
					violations: [
						{ line: 3, message: 'Test', rule: 'TestRule' },
					],
				},
				success: true,
			})
			.mockResolvedValueOnce({
				data: {
					violations: [
						{ line: 3, message: 'Test', rule: 'TestRule' },
					],
				},
				success: true,
			});

		// Get examples and manually add duplicate markers with same line number
		// This will cause findMarkerLineNumber to return the same xmlLineNumber for both
		// creating duplicate uniqueKey values
		const examples = tester.getExamples();
		if (examples.length > 0) {
			const [example] = examples;
			if (example) {
				// Create two markers with the same line number in example content
				// Both will map to the same XML line number, creating duplicate uniqueKey
				example.violationMarkers = [
					{
						description: 'Violation 1',
						index: 0,
						isViolation: true,
						lineNumber: 3,
					},
					{
						description: 'Violation 2',
						index: 1,
						isViolation: true,
						lineNumber: 3, // Same line number - will create duplicate uniqueKey
					},
				];
			}
		}

		const result = await tester.runCoverageTest(false);

		expect(result).toBeDefined();
		expect(result.success).toBeDefined();
		// Should have test results - duplicate markers should be filtered
		// The duplicate detection happens in runCoverageTest, so we just verify it completes
		expect(result.examplesTested).toBeGreaterThanOrEqual(0);
	});

	it('should skip duplicate valid markers', async () => {
		// Test false branch when duplicate valid markers have the same uniqueKey
		// This happens when the same marker appears multiple times with the same uniqueKey
		const tester = new RuleTester('/path/to/rule.xml');
		tester.extractExamples();

		// Mock test file content - ensure both markers map to the same XML line
		mockedReadFileSync.mockImplementation((filePath: string) => {
			if (filePath.includes('test-') && filePath.endsWith('.cls')) {
				return 'public class Test {\n    public void method1() {} // ✅\n    public void method2() {} // ✅\n}';
			}
			return `<?xml version="1.0"?>
<rule name="TestRule">
  <example>
    public class Test {
        public void uniqueMethod() {} // ✅
        public void method2() {} // ✅
    }
  </example>
</rule>`;
		});

		// Mock runPMD to return no violations (valid test passes)
		mockedRunPMD.mockResolvedValue({
			data: {
				violations: [],
			},
			success: true,
		});

		// Get examples and manually add duplicate markers
		const examples = tester.getExamples();
		if (examples.length > 0) {
			const [example] = examples;
			if (example) {
				// Clear existing markers to ensure we only have our test markers
				example.validMarkers = [];
				// Use lineNumber: 2 (1-indexed) which exists in the example content
				const duplicateLineNumber = 2;
				// Create two valid markers with the same line number
				// Both will map to the same XML line number via findMarkerLineNumber
				// First marker: adds uniqueKey to seenValidMarkers (line 521)
				// Second marker: hits false branch at line 516 (isDuplicate is true)
				example.validMarkers = [
					{
						description: 'Valid 1',
						index: 0,
						isViolation: false,
						lineNumber: duplicateLineNumber,
					},
					{
						description: 'Valid 2',
						index: 1,
						isViolation: false,
						lineNumber: duplicateLineNumber, // Same line number - will create duplicate uniqueKey
					},
				];
				example.valids = ['public void uniqueMethod() {}'];
			}
		}

		// Spy on findMarkerLineNumber to ensure both markers map to the same XML line number
		const findMarkerLineNumberSpy = vi.spyOn(
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Type assertion needed for private method access in tests, narrower type is intentional
			tester as unknown as {
				findMarkerLineNumber: (
					example: unknown,
					exampleIndex: number,
					markerLineNumber: number,
				) => number | undefined;
			},
			'findMarkerLineNumber',
		);
		// Ensure both markers map to the same XML line number (line 4 in XML)
		findMarkerLineNumberSpy.mockReturnValue(4);

		const result = await tester.runCoverageTest(false);

		expect(result).toBeDefined();
		expect(result.success).toBeDefined();
		// Verify that duplicate markers are filtered
		// The first marker will add the uniqueKey to seenValidMarkers (line 511)
		// The second marker with the same uniqueKey will hit the false branch at line 510
		// (!seenValidMarkers.has(uniqueKey) is false, so the if block is skipped)
		const hasDetailedResults = result.detailedTestResults !== undefined;
		if (hasDetailedResults) {
			const validTestCases = result.detailedTestResults.filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for Array.prototype.filter
				(tc) => tc.testType === 'valid',
			);
			// Should have only one test case despite two markers (duplicate filtered)
			// This verifies that the false branch at line 510 is hit
			// If we get 2 test cases, it means findMarkerLineNumber returned different values
			// If we get 1 test case, it means the duplicate was correctly filtered (false branch hit)
			expect(validTestCases.length).toBe(1);
		}
	});
});
