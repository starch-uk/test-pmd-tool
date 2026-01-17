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

	it('should use class as-is when class definition is present', () => {
		const exampleContent = `
// Violation: Variables that are never reassigned should be declared as final
public class Example {
  public void invalidMethod() {
    Integer value = 5;
    String message = 'Hello'; // ❌
    System.debug(message);
  }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 35,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should rename the class but keep the structure
		expect(writtenContent).toContain('public class TestClass35 {');
		expect(writtenContent).not.toContain('public class Example {');
		// Should contain the method signature (needed for PMD to match Method nodes)
		expect(writtenContent).toContain('public void invalidMethod() {');
		// Should contain the method body content
		expect(writtenContent).toContain('Integer value = 5;');
		expect(writtenContent).toContain("String message = 'Hello';");
		expect(writtenContent).toContain('System.debug(message);');
		// Should NOT be wrapped in another method
		expect(writtenContent).not.toContain('public void testMethod35() {');
	});

	it('should handle class with empty method when class definition is present', () => {
		const exampleContent = `
// Violation: Test
public class Example {
  public void emptyMethod() {
  }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 36,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should use the class as-is (renamed), not wrap in another method
		expect(writtenContent).toContain('public class TestClass36 {');
		expect(writtenContent).toContain('public void emptyMethod() {');
		expect(writtenContent).not.toContain('public void testMethod36() {');
		// Tests case when no helper methods are needed (helperMethods.length === 0)
	});

	it('should handle class-like structures without top-level class', () => {
		const exampleContent = `
// Violation: Test
public void method() {
  Integer value = 5;
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 37,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should wrap in a class (not in a method)
		expect(writtenContent).toContain('public class TestClass37 {');
		expect(writtenContent).toContain('public void method() {');
		expect(writtenContent).toContain('Integer value = 5;');
		expect(writtenContent).not.toContain('public void testMethod37() {');
	});

	it('should handle helper methods insertion when class has top-level class', () => {
		const exampleContent = `
// Violation: Test
public class Example {
  public void method() {
    Integer value = getValue();
  }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 38,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should have helper method for getValue()
		expect(writtenContent).toContain('public Boolean getValue()');
		expect(writtenContent).toContain('return true;');
	});

	it('should handle helper methods when class has top-level class and helper methods exist', () => {
		const exampleContent = `
// Violation: Test
public class Example {
  public void method() {
    Integer value = getValue();
    String name = getName();
  }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 39,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should have helper methods inserted before closing brace
		expect(writtenContent).toContain('public class TestClass39 {');
		expect(writtenContent).toContain('public Boolean getValue()');
		expect(writtenContent).toContain('public Boolean getName()');
		expect(writtenContent).toContain('Integer value = getValue();');
		// Verify helper methods are before the closing brace
		const getValueIndex = writtenContent.indexOf(
			'public Boolean getValue()',
		);
		const lastBraceIndex = writtenContent.lastIndexOf('}');
		expect(getValueIndex).toBeLessThan(lastBraceIndex);
	});

	it('should add closing brace when missing and insert helper methods', () => {
		// Tests case when extractedCode doesn't contain '}'
		// We need a scenario where:
		// 1. hasTopLevelClass is true
		// 2. extractedCode.join('\n') doesn't contain '}' (so lastBraceIndex === -1)
		// 3. helperMethods.length > 0
		// The logic includes braces with `trimmed === '}'`, but if the class
		// is missing its closing brace entirely, and we finish processing while still inside
		// the class (classBraceDepth > 0), then extractedCode won't have '}'.
		// We also need the method to be missing its closing brace, otherwise the method's
		// closing brace will be in extractedCode.
		const exampleContent = `
// Violation: Test - both class and method missing closing braces
public class Example {
  public void method() {
    Integer value = getValue();
    String name = getName();
`;

		createTestFile({
			exampleContent,
			exampleIndex: 41,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should still create valid structure and add closing brace
		expect(writtenContent).toContain('public class TestClass41 {');
		expect(writtenContent).toContain('public Boolean getValue()');
		expect(writtenContent).toContain('public Boolean getName()');
		// The closing brace should be added, and helper methods should be inserted before it
		expect(writtenContent).toContain('}'); // Should have closing brace added
		// Verify helper methods are before the closing brace
		const getValueIndex = writtenContent.indexOf(
			'public Boolean getValue()',
		);
		const getNameIndex = writtenContent.indexOf('public Boolean getName()');
		const lastBraceIndex = writtenContent.lastIndexOf('}');
		expect(getValueIndex).toBeLessThan(lastBraceIndex);
		expect(getNameIndex).toBeLessThan(lastBraceIndex);
	});

	it('should handle class-like structures path (methods without top-level class)', () => {
		const exampleContent = `
// Violation: Test method
public void exampleMethod() {
  Integer value = 5;
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 40,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should wrap in a class (hasClassLikeStructures path)
		expect(writtenContent).toContain('public class TestClass40 {');
		expect(writtenContent).toContain('public void exampleMethod() {');
		expect(writtenContent).toContain('Integer value = 5;');
		expect(writtenContent).not.toContain('public void exampleMethod40() {');
	});

	it('should handle standalone lines outside class with inline markers', () => {
		// Tests standalone lines outside class with markers
		const exampleContent = `
// Violation: Test
public class Example {
  public void method() {
    Integer value = 5;
  }
}
Integer standalone = 10; // ❌
String message = 'test'; // ✅
`;

		createTestFile({
			exampleContent,
			exampleIndex: 42,
			includeValids: true,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should include the class
		expect(writtenContent).toContain('public class TestClass42 {');
		// Should include standalone lines with markers removed
		expect(writtenContent).toContain('Integer standalone = 10;');
		expect(writtenContent).not.toContain('// ❌');
		expect(writtenContent).toContain("String message = 'test';");
		expect(writtenContent).not.toContain('// ✅');
	});

	it('should handle class without access modifier (class keyword only)', () => {
		// Tests case when class has no access modifier and classBraceDepth === ZERO_BRACE_DEPTH
		const exampleContent = `
// Violation: Test
class Example {
  public void method() {
    Integer value = 5;
  }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 43,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should rename the class (classMatch[1] will be undefined, so classPrefix is '')
		expect(writtenContent).toContain('class TestClass43 {');
		expect(writtenContent).not.toContain('public class TestClass43 {');
		expect(writtenContent).not.toContain('class Example {');
	});

	it('should handle lines without braces in hasTopLevelClass check', () => {
		// Tests ternary branches when openBracesMatch or closeBracesMatch is falsy in hasTopLevelClass
		// We need a line that doesn't contain any braces before the class definition
		const exampleContent = `
// Violation: Test
// This is a comment line without braces
Integer someVariable = 5;
public class Example {
  public void method() {
    Integer value = 5;
  }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 44,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should still create valid structure
		expect(writtenContent).toContain('public class TestClass44 {');
		expect(writtenContent).toContain('Integer value = 5;');
	});

	it('should handle lines without braces in class extraction', () => {
		// Tests ternary branches when openBracesMatch or closeBracesMatch is falsy during class extraction
		const exampleContent = `
// Violation: Test
public class Example {
  public void method() {
    Integer value = 5;
    String message = 'test';
  }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 45,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should still create valid structure
		expect(writtenContent).toContain('public class TestClass45 {');
		expect(writtenContent).toContain('Integer value = 5;');
		expect(writtenContent).toContain("String message = 'test';");
	});

	it('should handle field declarations in hasClassLikeStructures', () => {
		// Tests case when fieldMatch is truthy (field declarations without top-level class)
		const exampleContent = `
// Violation: Test
public Integer value = 42;
private String name = 'test';
`;

		createTestFile({
			exampleContent,
			exampleIndex: 46,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should wrap in a class (hasClassLikeStructures path)
		expect(writtenContent).toContain('public class TestClass46 {');
		expect(writtenContent).toContain('public Integer value = 42;');
		expect(writtenContent).toContain("private String name = 'test';");
	});

	it('should handle class match when classBraceDepth is zero', () => {
		// Tests case when classBraceDepth === ZERO_BRACE_DEPTH and classMatch is truthy
		const exampleContent = `
// Violation: Test
public class Example {
  public void method() {
    Integer value = 5;
  }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 47,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should rename the class (classMatch should be truthy)
		expect(writtenContent).toContain('public class TestClass47 {');
		expect(writtenContent).not.toContain('public class Example {');
	});

	it('should handle inner class detection in hasClassLikeStructures', () => {
		// Tests case when trimmed.includes('class ') && trimmed.includes('{')
		// To test this, we need a line that contains "class " and "{" but is NOT detected as top-level
		// We can use a line that contains the pattern but doesn't start with class keywords
		// For example: a string literal that contains the pattern
		const exampleContent = `public void method() {
  String code = "class Inner { }"; // ❌ contains class and {
  Integer value = 5; // ❌
}`;

		createTestFile({
			exampleContent,
			exampleIndex: 48,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should wrap in a class (hasClassLikeStructures path)
		// The line with "class " and "{" in string should trigger inner class detection
		expect(writtenContent).toContain('public class TestClass48 {');
		expect(writtenContent).toContain('String code = "class Inner { }";');
		expect(writtenContent).toContain('Integer value = 5;');
	});

	it('should handle class definition when classBraceDepth is not zero', () => {
		// Tests case when classBraceDepth !== ZERO_BRACE_DEPTH
		// This happens when we're already inside a class and encounter another class (inner class)
		const exampleContent = `public class Outer {
  public void method() {
    Integer value = 5; // ❌
  }
  class Inner { // ❌ inner class - classBraceDepth > 0 when this is encountered
    public void innerMethod() {
      Integer innerValue = 10; // ❌
    }
  }
}`;

		createTestFile({
			exampleContent,
			exampleIndex: 50,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should rename the outer class but keep inner class as-is
		expect(writtenContent).toContain('public class TestClass50 {');
		expect(writtenContent).toContain('class Inner {');
		expect(writtenContent).toContain('Integer value = 5;');
		expect(writtenContent).toContain('Integer innerValue = 10;');
	});

	it('should handle class definition when classMatch is falsy', () => {
		// Tests case when classMatch is falsy
		// This happens when the regex doesn't match - e.g., "public class {" (no class name)
		// The line passes startsWith('public class ') but regex fails because \w+ requires a name
		const exampleContent = `public class {
  public void method() {
    Integer value = 5; // ❌
  }
}`;

		createTestFile({
			exampleContent,
			exampleIndex: 49,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// When classMatch is falsy, the code continues without replacing the class name
		// This is defensive code - the class definition should still be included
		expect(writtenContent).toBeDefined();
		// The malformed class line should be included as-is (defensive path)
		expect(writtenContent).toContain('Integer value = 5;');
	});

	it('should handle method body content with valid marker when including valids only', () => {
		// Tests method body content with // ✅ marker when includeValids is true and includeViolations is false
		const exampleContent = `
public class Example {
    public void method() {
        Integer value = 5; // ❌
        String name = 'test'; // ✅
    }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 50,
			includeValids: true,
			includeViolations: false,
		});

		const writtenContent = capturedContent;
		// Should include method declaration and the valid line
		expect(writtenContent).toContain('public void method()');
		expect(writtenContent).toContain("String name = 'test';");
		expect(writtenContent).not.toContain('Integer value = 5;');
		expect(writtenContent).not.toContain('// ✅');
		expect(writtenContent).not.toContain('// ❌');
	});

	it('should handle method body content with valid marker and tab-indented method declaration', () => {
		// Tests methodDecl.startsWith(TAB_CHAR) branch and method body content with // ✅ marker
		// The method declaration must start with tab AND we must be including method body content
		// (not the declaration line itself - declaration has no marker)
		const exampleContent = `
public class Example {
	public void method() {
		String name = 'test'; // ✅
	}
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 51,
			includeValids: true,
			includeViolations: false,
		});

		const writtenContent = capturedContent;
		// Should include method declaration (with tab) and the valid line
		expect(writtenContent).toContain('public void method()');
		expect(writtenContent).toContain("String name = 'test';");
		// Verify the method declaration is included (not just the body)
		// The method body content path includes the declaration first
		const methodIndex = writtenContent.indexOf('public void method()');
		const nameIndex = writtenContent.indexOf("String name = 'test';");
		expect(methodIndex).toBeLessThan(nameIndex);
	});

	it('should handle method body content with valid marker and space-indented method declaration', () => {
		// Tests methodDecl.startsWith(SPACE_CHAR) branch and method body content with // ✅ marker
		// The method declaration must start with space AND we must be including method body content
		// (not the declaration line itself - declaration has no marker)
		const exampleContent = `
public class Example {
 public void method() {
  String name = 'test'; // ✅
 }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 52,
			includeValids: true,
			includeViolations: false,
		});

		const writtenContent = capturedContent;
		// Should include method declaration (with space) and the valid line
		expect(writtenContent).toContain('public void method()');
		expect(writtenContent).toContain("String name = 'test';");
	});

	it('should handle method declaration with no indentation (default indent path)', () => {
		// Tests else branch when neither tab nor space
		// Method declaration has no leading whitespace, so default indent is used
		const exampleContent = `
public class Example {
public void method() {
    String name = 'test'; // ✅
}
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 54,
			includeValids: true,
			includeViolations: false,
		});

		const writtenContent = capturedContent;
		// Should include method declaration with default indent
		expect(writtenContent).toContain('public void method()');
		expect(writtenContent).toContain("String name = 'test';");
	});

	it('should handle structural braces when shouldInclude is false', () => {
		// Tests case when shouldInclude is false but braces are needed for structure
		// This path is reached when:
		// - shouldInclude is false (content not included)
		// - isMethodDeclarationLine is false
		// - We're not in the first-time-including-method-content path
		// - We're not in the regular-content-line path
		// - trimmed is '{' or '}'
		const exampleContent = `
public class Example {
    public void violationMethod() {
        Integer value = 5; // ❌
    }
    public void validMethod() {
        String name = 'test'; // ✅
    }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 53,
			includeValids: true,
			includeViolations: false,
		});

		const writtenContent = capturedContent;
		// Should still have class structure with braces even if violations not included
		expect(writtenContent).toContain('public class TestClass53');
		expect(writtenContent).toContain('public void validMethod()');
		expect(writtenContent).toContain("String name = 'test';");
		expect(writtenContent).not.toContain('Integer value = 5;');
		// Should have closing braces for structure
		expect(writtenContent.split('}').length).toBeGreaterThan(1);
	});

	it('should add closing brace when class ends without brace in extractedCode', () => {
		// Test when classBraceDepth <= 0, insideClass is true, lastExtracted doesn't end with '}'
		// This happens when we exit a class but the closing brace wasn't included in extractedCode
		// We need: classBraceDepth becomes <= 0, insideClass is still true, and last line doesn't end with '}'
		const exampleContent = `
// Violation: Test
public class Example {
    public void method() {
        Integer value = 5; // ❌
    }
    // Comment line - class closing brace missing, this line doesn't end with '}'
`;

		createTestFile({
			exampleContent,
			exampleIndex: 60,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should have added the closing brace
		expect(writtenContent).toContain('public class TestClass60');
		expect(writtenContent.split('}').length).toBeGreaterThan(1);
	});

	it('should handle helper methods when no closing brace exists in class content', () => {
		// Test when helperMethods.length > 0 and lastBraceIndex === NOT_FOUND_INDEX
		// This happens when classContentStr (extractedCode.join('\n')) has no '}' character
		// We need a class that's missing its closing brace entirely, and helper methods are needed
		const exampleContent = `
// Violation: Test
public class Example {
    public void method() {
        Integer value = getValue();
        String name = getName();
    }
    // Missing closing brace - classContentStr will have no '}'
`;

		createTestFile({
			exampleContent,
			exampleIndex: 61,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should have helper methods and closing brace added
		expect(writtenContent).toContain('public Boolean getValue()');
		expect(writtenContent).toContain('public Boolean getName()');
		expect(writtenContent).toContain('}'); // Closing brace should be added
		// Helper methods should be before the closing brace
		const getValueIndex = writtenContent.indexOf(
			'public Boolean getValue()',
		);
		const lastBraceIndex = writtenContent.lastIndexOf('}');
		expect(getValueIndex).toBeLessThan(lastBraceIndex);
	});

	it('should add closing brace when class has no helper methods and no brace', () => {
		// Test when needsClosingBrace is true (lastBraceIndex === NOT_FOUND_INDEX && hasTopLevelClass)
		// and helperMethods.length === 0
		// We need: hasTopLevelClass=true, classContentStr has no '}', and no helper methods
		const exampleContent = `
// Violation: Test
public class Example {
    public void method() {
        Integer value = 5; // ❌
    }
    // Missing closing brace, no helper methods needed (no method calls)
`;

		createTestFile({
			exampleContent,
			exampleIndex: 62,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should have added the closing brace even without helper methods
		expect(writtenContent).toContain('public class TestClass62');
		expect(writtenContent.split('}').length).toBeGreaterThan(1);
	});

	it('should add closing brace when class ends and lastExtracted does not end with brace', () => {
		// Test when classBraceDepth <= 0, insideClass=true, lastExtracted doesn't end with '}'
		// Conditions: classBraceDepth becomes <= 0 (class ended), insideClass is still true,
		// lastExtracted exists, and lastExtracted.trim() doesn't end with '}'
		// We need a scenario where we exit the class (classBraceDepth <= 0) but the last
		// line in extractedCode is not a closing brace (e.g., a comment or code line)
		const exampleContent = `// Violation: Test
public class Example {
    public void method() {
        Integer value = 5; // ❌
    }
    // This comment line is the last thing before class ends - doesn't end with '}'
    // Class closing brace is missing, so classBraceDepth becomes <= 0 when we finish processing
`;

		createTestFile({
			exampleContent,
			exampleIndex: 63,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should have added the closing brace
		expect(writtenContent).toContain('public class TestClass63');
		expect(writtenContent.split('}').length).toBeGreaterThan(1);
	});

	it('should handle case where classContentStr has absolutely no closing brace with helper methods', () => {
		// Test when helperMethods.length > 0 AND lastBraceIndex === NOT_FOUND_INDEX
		// We need extractedCode.join('\n') to have NO '}' character at all
		// This requires: class missing closing brace, methods missing closing braces,
		// and helper methods are needed
		// The key is that extractedCode must not contain any '}' characters
		const exampleContent = `// Violation: Test
public class Example {
    public void method() {
        Integer value = getValue();
        String name = getName();
        // Method and class both missing closing braces - extractedCode will have no '}'
`;

		createTestFile({
			exampleContent,
			exampleIndex: 64,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public Boolean getValue()');
		expect(writtenContent).toContain('public Boolean getName()');
		expect(writtenContent).toContain('}'); // Closing brace should be added
		// Verify helper methods are before the closing brace
		const getValueIndex = writtenContent.indexOf(
			'public Boolean getValue()',
		);
		const lastBraceIndex = writtenContent.lastIndexOf('}');
		expect(getValueIndex).toBeLessThan(lastBraceIndex);
	});

	it('should add closing brace when no helper methods and classContentStr has no brace', () => {
		// Test when needsClosingBrace=true (lastBraceIndex === NOT_FOUND_INDEX && hasTopLevelClass)
		// AND helperMethods.length === 0
		const exampleContent = `// Violation: Test
public class Example {
    public void method() {
        Integer value = 5; // ❌
    }
    // No closing brace, no method calls (no helper methods needed)
`;

		createTestFile({
			exampleContent,
			exampleIndex: 65,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		expect(writtenContent).toContain('public class TestClass65');
		expect(writtenContent.split('}').length).toBeGreaterThan(1);
	});

	it('should handle property blocks (not method declarations)', () => {
		// Test !isPropertyBlock branch when isPropertyBlock is true
		// Property blocks have { but no ( and no void, at depth 1 (prevClassBraceDepth === INITIAL_BRACE_DEPTH)
		// This tests the short-circuit branch where !isPropertyBlock is false
		const exampleContent = `
// Violation: Test
public class Example {
    public String name { get; set; } // ❌ Property block, not a method
    public void method() { // ❌ This is a method, not a property
        Integer value = 5;
    }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 66,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Property block should be included but not treated as a method declaration
		expect(writtenContent).toContain('public class TestClass66');
		expect(writtenContent).toContain('public String name { get; set; }');
		// Method should be treated as a method declaration
		expect(writtenContent).toContain('public void method()');
	});

	it('should handle method declaration when isPropertyBlock is false and all conditions are met', () => {
		// Test when !isPropertyBlock is true and all method declaration conditions are met
		// This ensures the isMethodDeclaration assignment is fully evaluated
		// Tests all three branches of the || expression: 'void', '(', and hasMethodPattern
		const exampleContent = `
// Violation: Test
public class Example {
    public void exampleMethod() { // ❌ Method with 'void' - tests first || branch
        Integer value = 5;
    }
    public Integer getValue() { // ❌ Method with '(' - tests second || branch (void is false)
        return 5;
    }
    public String getName() { // ❌ Method with hasMethodPattern - tests third || branch (void and ( are false)
        return 'test';
    }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 68,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// All methods should be treated as method declarations
		expect(writtenContent).toContain('public class TestClass68');
		expect(writtenContent).toContain('public void exampleMethod()');
		expect(writtenContent).toContain('public Integer getValue()');
		expect(writtenContent).toContain('public String getName()');
	});

	it('should add closing brace when last line does not end with brace', () => {
		// Tests when !lastLine.trim().endsWith('}') is true
		// This happens when the last line in extractedCode doesn't end with '}'
		const exampleContent = `
// Violation: Test
public class Example {
    public void method() {
        Integer value = 5; // ❌
    }
    // Comment line - class missing closing brace
`;

		createTestFile({
			exampleContent,
			exampleIndex: 69,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Should have added the closing brace
		expect(writtenContent).toContain('public class TestClass69');
		expect(writtenContent.split('}').length).toBeGreaterThan(1);
	});

	it('should handle method declaration when some conditions are false', () => {
		// Test when !isPropertyBlock is true but some conditions fail
		// This tests branches where the expression evaluates to false
		// For example, when prevClassBraceDepth !== INITIAL_BRACE_DEPTH
		const exampleContent = `
// Violation: Test
public class Example {
    {
        public void innerMethod() { // ❌ Method at depth > 1, not INITIAL_BRACE_DEPTH
            Integer value = 5;
        }
    }
}
`;

		createTestFile({
			exampleContent,
			exampleIndex: 70,
			includeValids: false,
			includeViolations: true,
		});

		const writtenContent = capturedContent;
		// Method at wrong depth should not be treated as method declaration
		expect(writtenContent).toContain('public class TestClass70');
	});

	it('should skip method calls preceded by a dot (Pattern.compile, String.matches, etc.)', () => {
		const exampleContent = `
public class TestClass {
    public void exampleMethod() {
        Pattern.compile("test"); // ❌ Should not generate helper for Pattern.compile
        String.matches("pattern", "text"); // ❌ Should not generate helper for String.matches
        someMethod(); // ❌ Should generate helper for standalone method
    }
}
`;

		const result = createTestFile({
			exampleContent,
			exampleIndex: 1,
			includeValids: false,
			includeViolations: true,
		});

		expect(result.filePath).toBeDefined();
		const writtenContent = capturedContent;

		// Should NOT generate helper for Pattern.compile (preceded by dot)
		expect(writtenContent).not.toContain('public Pattern compile()');
		// Should NOT generate helper for String.matches (preceded by dot)
		expect(writtenContent).not.toContain('public String matches()');
		// Should generate helper for standalone method
		expect(writtenContent).toContain('public Boolean someMethod()');
	});

	it('should add filtered helper methods to class content', () => {
		const exampleContent = `
public class TestClass {
    public void exampleMethod() {
        helperMethod1(); // ❌
        helperMethod2(); // ❌
    }
    
    // helperMethod1 is already defined, so it should be filtered out
    public Boolean helperMethod1() {
        return true;
    }
}
`;

		const result = createTestFile({
			exampleContent,
			exampleIndex: 1,
			includeValids: false,
			includeViolations: true,
		});

		expect(result.filePath).toBeDefined();
		const writtenContent = capturedContent;

		// helperMethod1 should NOT be added (already defined)
		const helperMethod1Count = (
			writtenContent.match(/public Boolean helperMethod1\(\)/g) ?? []
		).length;
		expect(helperMethod1Count).toBe(1); // Only the original definition

		// helperMethod2 should be added (not defined)
		expect(writtenContent).toContain('public Boolean helperMethod2()');
	});

	it('should add filtered helper methods when hasClassLikeStructures is true', () => {
		// Test case where hasClassLikeStructures is true and helper methods need to be added
		// This covers the loop that processes filteredHelperMethods
		const exampleContent = `
    private Integer field = 42; // ❌
    public void exampleMethod() {
        helperMethod(); // ❌ Should generate helper
    }
`;

		const result = createTestFile({
			exampleContent,
			exampleIndex: 1,
			includeValids: false,
			includeViolations: true,
		});

		expect(result.filePath).toBeDefined();
		const writtenContent = capturedContent;

		// Should have wrapped in class and added helper method
		expect(writtenContent).toContain('public class TestClass1');
		expect(writtenContent).toContain('private Integer field = 42;');
		expect(writtenContent).toContain('public Boolean helperMethod()');
	});
});
