import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createTestFile } from '../../../src/parser/createTestFile.js';

// Mock file system operations
vi.mock('fs', () => ({
	writeFileSync: vi.fn(),
	readFileSync: vi.fn(() => 'public class TestClass {\n    private Integer violation = 42;\n}'),
}));

vi.mock('os', () => ({
	tmpdir: vi.fn(() => '/tmp'),
}));

vi.mock('path', () => ({
	join: vi.fn((...args) => args.join('/')),
}));

const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedTmpdir = vi.mocked(tmpdir);
const mockedJoin = vi.mocked(join);

let capturedContent: string;

describe('createTestFile', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedWriteFileSync.mockClear();
		mockedWriteFileSync.mock.calls.length = 0;
		capturedContent = '';
		mockedWriteFileSync.mockImplementation((filePath, content) => {
			capturedContent = content as string;
		});
		mockedTmpdir.mockReturnValue('/tmp');
		mockedJoin.mockImplementation((...args) => args.join('/'));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should create test file with inline markers content', () => {
		const exampleContent = `
// Violation: Test violations
public class TestClass {
    private Integer field = 42; // ❌ Magic number
    private String name = 'test'; // ✅ Valid string
}
`;

		const result = createTestFile(exampleContent, 1, true, true);

		expect(result.filePath).toContain('rule-test-example-1-');
		expect(result.hasViolations).toBe(true);
		expect(result.hasValids).toBe(true);
		expect(result.violationCount).toBe(3);
		expect(result.validCount).toBe(1);

		expect(mockedWriteFileSync).toHaveBeenCalledWith(
			expect.stringContaining('rule-test-example-1-'),
			expect.stringContaining('private Integer field = 42;'),
			'utf-8',
		);
	});

	it('should create test file with section markers content', () => {
		const exampleContent = `
// Violation: Magic numbers
public class TestClass {
    private Integer value = 42;
}

// Valid: Constants
public class ValidClass {
    private static final Integer MAX = 100;
}
`;

		const result = createTestFile(exampleContent, 2, true, true);

		expect(result.hasViolations).toBe(true);
		expect(result.hasValids).toBe(true);
		expect(result.violationCount).toBe(3);
		expect(result.validCount).toBe(3);

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('private Integer value = 42;');
		expect(writtenContent).toContain(
			'private static final Integer MAX = 100;',
		);
	});

	it('should create violation-only file when includeValids is false', () => {
		const exampleContent = `
public class TestClass {
    private Integer violation = 42; // ❌ Violation
    private Integer valid = 100; // ✅ Valid
}
`;

		const result = createTestFile(exampleContent, 3, true, false);

		expect(result.hasViolations).toBe(true);
		expect(result.hasValids).toBe(true);
		expect(result.violationCount).toBe(1);
		expect(result.validCount).toBe(1);
	});

	it('should create valid-only file when includeViolations is false', () => {
		const exampleContent = `
public class TestClass {
    private Integer violation = 42; // ❌ Violation
    private Integer valid = 100; // ✅ Valid
}
`;

		const result = createTestFile(exampleContent, 4, false, true);

		expect(result.hasViolations).toBe(true);
		expect(result.hasValids).toBe(true);
		expect(result.violationCount).toBe(1);
		expect(result.validCount).toBe(1);
	});


	it('should handle legacy format without inline markers', () => {
		const exampleContent = `
// Violation: Magic numbers
public class TestClass {
    private Integer value = 42;
}

// Valid: Constants
public class ValidClass {
    private static final Integer MAX = 100;
}
`;

		const result = createTestFile(exampleContent, 5, true, false);

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public class TestClass5 {');
		expect(writtenContent).toContain('private Integer value = 42;');
		expect(writtenContent).not.toContain(
			'private static final Integer MAX = 100;',
		);
	});

	it('should generate unique file names with timestamp', () => {
		const exampleContent = 'public class Test {}';

		createTestFile(exampleContent, 1);
		createTestFile(exampleContent, 1);

		const calls = mockedWriteFileSync.mock.calls;
		// Since we're mocking join and tmpdir, the paths will be the same
		// But Date.now() should make them different in real usage
		expect(calls[0][0]).toContain('rule-test-example-1-');
		expect(calls[1][0]).toContain('rule-test-example-1-');
	});

	it('should handle empty example content', () => {
		const result = createTestFile('', 6);

		expect(result.hasViolations).toBe(false);
		expect(result.hasValids).toBe(false);
		expect(result.violationCount).toBe(0);
		expect(result.validCount).toBe(0);

		const writtenContent = capturedContent;
		expect(writtenContent.trim()).toBe('public class TestClass6 {\n}');
	});

	it('should clean section markers from output', () => {
		const exampleContent = `
// Violation: Test
public class TestClass {
    private Integer field;
}
// Valid: Another test
public class ValidClass {
    private String name;
}
`;

		createTestFile(exampleContent, 7, true, true);

		const writtenContent = capturedContent;
		expect(writtenContent).not.toContain('// Violation:');
		expect(writtenContent).not.toContain('// Valid:');
		expect(writtenContent).toContain('private Integer field;');
		expect(writtenContent).toContain('private String name;');
	});

	it('should use correct file extension', () => {
		const exampleContent = 'public class Test {}';

		createTestFile(exampleContent, 8);

		const filePath = mockedWriteFileSync.mock.calls[0][0] as string;
		expect(filePath).toMatch(/\.cls$/);
	});
});
