/**
 * @file
 * Unit tests for createTestFile function.
 */
/* eslint-disable @typescript-eslint/strict-void-return */
import { writeFileSync } from 'fs';
import tmp from 'tmp';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestFile } from '../../src/parser/createTestFile.js';

// Mock file system operations
vi.mock('fs', () => ({
	readFileSync: vi.fn(
		() =>
			'public class TestClass {\n    private Integer violation = 42;\n}',
	),
	writeFileSync: vi.fn(),
}));

// Mock tmp library
vi.mock('tmp', () => ({
	default: {
		fileSync: vi.fn(() => ({
			fd: 3,
			name: '/tmp/rule-test-example-1-test.cls',
			removeCallback: vi.fn(),
		})),
	},
}));

const mockedWriteFileSync = vi.mocked(writeFileSync);
// Type the mocked tmp module properly
interface TmpModule {
	fileSync: ReturnType<typeof vi.fn>;
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- tmp is mocked, type assertion needed for test
const tmpModule = tmp as unknown as TmpModule;
const mockedTmpFileSync = vi.mocked(tmpModule.fileSync);

let capturedContent = '';

describe('createTestFile', () => {
	beforeEach(() => {
		mockedWriteFileSync.mockClear();
		mockedWriteFileSync.mock.calls.length = 0;
		capturedContent = '';
		mockedWriteFileSync.mockImplementation(
			(filePath: Readonly<string>, content: Readonly<string>) => {
				capturedContent = content;
			},
		);
		// Mock tmp.fileSync to return different file names based on exampleIndex
		mockedTmpFileSync.mockImplementation(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Options object for tmp.fileSync
			(options: {
				keep?: boolean;
				postfix?: string;
				prefix?: string;
			}) => {
				const prefix = options.prefix ?? 'tmp-';
				const postfix = options.postfix ?? '';
				return {
					fd: 3,
					name: `/tmp/${prefix}${String(Date.now())}${postfix}`,
					removeCallback: vi.fn(),
				};
			},
		);
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

		const result = createTestFile({
			exampleContent,
			exampleIndex: 1,
			includeValids: true,
			includeViolations: true,
		});

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

		const result = createTestFile({
			exampleContent,
			exampleIndex: 2,
			includeValids: true,
			includeViolations: true,
		});

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

		const result = createTestFile({
			exampleContent,
			exampleIndex: 3,
			includeValids: false,
			includeViolations: true,
		});

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

		const result = createTestFile({
			exampleContent,
			exampleIndex: 4,
			includeValids: true,
			includeViolations: false,
		});

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

		createTestFile({
			exampleContent,
			exampleIndex: 5,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should use the class as-is (renamed), not wrap in another class
		expect(writtenContent).toContain('public class TestClass5 {');
		expect(writtenContent).toContain('private Integer value = 42;');
		expect(writtenContent).not.toContain(
			'private static final Integer MAX = 100;',
		);
		expect(writtenContent).not.toContain('public class TestClass {');
		expect(writtenContent).not.toContain('public class ValidClass {');
	});

	it('should generate unique file names with timestamp', () => {
		const exampleContent = 'public class Test {}';

		createTestFile({ exampleContent, exampleIndex: 1 });
		createTestFile({ exampleContent, exampleIndex: 1 });

		const { calls } = mockedWriteFileSync.mock;
		// tmp.fileSync generates unique file names, so paths will be different
		expect(calls[0][0]).toContain('rule-test-example-1-');
		expect(calls[1][0]).toContain('rule-test-example-1-');
	});

	it('should handle empty example content', () => {
		const result = createTestFile({ exampleContent: '', exampleIndex: 6 });

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

		createTestFile({
			exampleContent,
			exampleIndex: 7,
			includeValids: true,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		expect(writtenContent).not.toContain('// Violation:');
		expect(writtenContent).not.toContain('// Valid:');
		expect(writtenContent).toContain('private Integer field;');
		expect(writtenContent).toContain('private String name;');
	});

	it('should use correct file extension', () => {
		const exampleContent = 'public class Test {}';

		createTestFile({ exampleContent, exampleIndex: 8 });

		const filePath = mockedWriteFileSync.mock.calls[0]?.[0];
		if (typeof filePath === 'string') {
			expect(filePath).toMatch(/\.cls$/);
		}
	});
});
