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
});
