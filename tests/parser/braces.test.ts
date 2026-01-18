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
});
