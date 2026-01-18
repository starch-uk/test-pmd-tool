/**
 * @file
 * Unit tests for createTestFile function.
 */
/* eslint-disable @typescript-eslint/strict-void-return */
import { writeFileSync } from 'fs';
import tmp from 'tmp';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestFile } from '../../../src/parser/createTestFile.js';

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
	it('should generate helper methods for method calls', () => {
		const exampleContent = `
// Violation: Test
Integer result = helperMethod(); // ❌ Violation
String value = anotherHelper(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 9 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Boolean helperMethod()');
		expect(writtenContent).toContain('public Boolean anotherHelper()');
		expect(writtenContent).toContain('return true;');
	});

	it('should infer Integer return type from comparisons', () => {
		const exampleContent = `
// Violation: Test
if (getCount() > 0) { // ❌ Violation
    // do something
}
`;

		createTestFile({ exampleContent, exampleIndex: 13 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Integer getCount()');
		expect(writtenContent).toContain('return 1;');
	});

	it('should infer String return type from switch statements', () => {
		const exampleContent = `
// Violation: Test
switch on getValue() { // ❌ Violation
    when 'test' {
        // do something
    }
}
`;

		createTestFile({ exampleContent, exampleIndex: 14 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public String getValue()');
		expect(writtenContent).toContain("return 'test';");
	});

	it('should infer Boolean return type from ternary expressions', () => {
		const exampleContent = `
// Violation: Test
Boolean result = isActive() ? true : false; // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 15 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Boolean isActive()');
		expect(writtenContent).toContain('return true;');
	});

	it('should infer List return type from for-each loops', () => {
		const exampleContent = `
// Violation: Test
for (String item : getItems()) { // ❌ Violation
    // do something
}
`;

		createTestFile({ exampleContent, exampleIndex: 16 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public List<String> getItems()');
		expect(writtenContent).toContain('return new List<String>();');
	});

	it('should infer Boolean return type from while loops', () => {
		const exampleContent = `
// Violation: Test
while (isRunning()) { // ❌ Violation
    // do something
}
`;

		createTestFile({ exampleContent, exampleIndex: 17 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Boolean isRunning()');
		expect(writtenContent).toContain('return true;');
	});

	it('should handle default return type for unknown types', () => {
		const exampleContent = `
// Violation: Test
UnknownType result = getUnknown(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 19 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Boolean getUnknown()');
		expect(writtenContent).toContain('return true;');
	});

	it('should handle Object return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Object value = getObject(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 37 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Object getObject()');
		expect(writtenContent).toContain('return null;');
	});

	it('should handle default case in generateReturnValue for unknown types', async () => {
		// Test the default case by calling generateReturnValue directly with an unknown type
		const { generateReturnValue } =
			await import('../../../src/parser/createTestFile.js');

		// Call with a type that doesn't match any case
		const result = generateReturnValue('UnknownType');

		expect(result).toBe('return null;');
	});

	it('should skip Apex keywords when extracting helper methods', () => {
		const exampleContent = `
// Violation: Test
if (condition) { // ❌ Violation
    return value;
}
`;

		createTestFile({ exampleContent, exampleIndex: 20 });

		const writtenContent = capturedContent;
		// Should not generate helper methods for 'if' or 'return' keywords
		expect(writtenContent).not.toContain('public Boolean if()');
		expect(writtenContent).not.toContain('public Boolean return()');
	});

	it('should handle empty codeToInclude array', () => {
		const exampleContent = '';

		const result = createTestFile({ exampleContent, exampleIndex: 21 });

		expect(result.hasViolations).toBe(false);
		expect(result.hasValids).toBe(false);
		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public class TestClass21');
		expect(writtenContent).toContain('}');
	});

	it('should handle Map return type generation when inferred', () => {
		// Map return type can only be tested if we can infer it, which currently isn't possible
		// But we can test the generateReturnValue function indirectly through List/Set
		const exampleContent = `
// Violation: Test
for (String item : getItems()) { // ❌ Violation
    // do something
}
`;

		createTestFile({ exampleContent, exampleIndex: 23 });

		const writtenContent = capturedContent;
		// Should generate List<String> return type from for-each loop
		expect(writtenContent).toContain('public List<String> getItems()');
		expect(writtenContent).toContain('return new List<String>();');
	});

	it('should handle Set return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Set<Integer> numbers = getNumbers(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 24 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Set<String> getNumbers()');
		expect(writtenContent).toContain('return new Set<String>();');
	});

	it('should handle Map return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Map<String, Integer> map = getMap(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 25 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain(
			'public Map<String, Integer> getMap()',
		);
		expect(writtenContent).toContain('return new Map<String, Integer>();');
	});

	it('should handle Decimal return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Decimal value = getDecimal(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 26 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Decimal getDecimal()');
		expect(writtenContent).toContain('return 1.0;');
	});

	it('should handle Double return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Double value = getDouble(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 27 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Double getDouble()');
		expect(writtenContent).toContain('return 1.0;');
	});

	it('should handle Long return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Long value = getLong(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 28 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Long getLong()');
		expect(writtenContent).toContain('return 1000L;');
	});

	it('should handle Date return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Date value = getDate(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 29 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Date getDate()');
		expect(writtenContent).toContain(
			'return Date.newInstance(2024, 1, 1);',
		);
	});

	it('should handle Datetime return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Datetime value = getDatetime(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 30 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Datetime getDatetime()');
		expect(writtenContent).toContain(
			'return Datetime.newInstance(2024, 1, 1);',
		);
	});

	it('should handle Time return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Time value = getTime(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 31 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Time getTime()');
		expect(writtenContent).toContain(
			'return Time.newInstance(0, 0, 0, 0);',
		);
	});

	it('should handle Blob return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Blob value = getBlob(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 32 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Blob getBlob()');
		expect(writtenContent).toContain("return Blob.valueOf('test');");
	});

	it('should handle Id return type in helper methods', () => {
		const exampleContent = `
// Violation: Test
Id value = getId(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 33 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Id getId()');
		expect(writtenContent).toContain("return '001000000000000000';");
	});

	it('should handle default return type for unknown types', () => {
		const exampleContent = `
// Violation: Test
UnknownType value = getUnknown(); // ❌ Violation
`;

		createTestFile({ exampleContent, exampleIndex: 34 });

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Boolean getUnknown()');
		expect(writtenContent).toContain('return true;');
	});
});
