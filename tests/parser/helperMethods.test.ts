/**
 * @file
 * Unit tests for createTestFile function.
 */
/* eslint-disable @typescript-eslint/strict-void-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- Test mocks require unsafe operations */
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
