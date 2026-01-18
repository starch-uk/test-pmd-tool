/**
 * @file
 * Creates temporary Apex test files from example content for PMD rule testing.
 */
import { writeFileSync } from 'fs';
import tmp from 'tmp';
import type { TestFileResult } from '../types/index.js';
import { parseExample } from './parseExample.js';
import {
	extractHelperMethods,
	formatMethodDeclarationIndent,
	removeInlineMarkers,
} from './testFileContent.js';

export { generateReturnValue } from './testFileContent.js';

const EMPTY_LENGTH = 0;
const LAST_ELEMENT_OFFSET = 1;
const SINGLE_COUNT = 1;

interface CreateTestFileOptions {
	exampleContent: string;
	exampleIndex: number;
	includeViolations?: boolean;
	includeValids?: boolean;
}

/**
 * Create a temporary Apex test file from example content.
 * @param options - Configuration options for test file creation.
 * @param options.exampleContent - Raw example content.
 * @param options.exampleIndex - Index of the example for unique naming.
 * @param options.includeViolations - Whether to include violation code.
 * @param options.includeValids - Whether to include valid code.
 * @returns Result of file creation.
 */
export function createTestFile({
	exampleContent,
	exampleIndex,
	includeViolations = true,
	includeValids = true,
}: Readonly<CreateTestFileOptions>): TestFileResult {
	// Use tmp library for secure temporary file creation
	// keep: true ensures file persists for PMD to read it
	// File will be cleaned up on process exit by default, or can be manually removed
	const tmpFile = tmp.fileSync({
		keep: true,
		postfix: '.cls',
		prefix: `rule-test-example-${String(exampleIndex)}-`,
	});
	const tempFile = tmpFile.name;

	// Parse the example to get violation and valid code
	const parsed = parseExample(exampleContent);

	// Choose which code to include based on parameters
	let codeToInclude: string[] = [];
	if (includeViolations && !includeValids) {
		// Only violations
		codeToInclude = parsed.violations;
	} else if (includeValids && !includeViolations) {
		codeToInclude = parsed.valids;
	} else {
		// Both or neither
		codeToInclude = [...parsed.violations, ...parsed.valids];
	}

	// Determine the structure of the code to decide how to wrap it
	// Check the original example content, not just parsed violations/valids,
	// because class definitions might not have markers
	const TEST_CLASS_NAME = `TestClass${String(exampleIndex)}`;
	const fullExampleContent = parsed.content;

	// Check for top-level class (not inner class) in the original content
	// If there are multiple top-level classes, treat them all as inner classes
	// This ensures that when there are multiple classes, they're all wrapped together
	const ZERO_BRACE_DEPTH = 0;
	const topLevelClassCount = ((): number => {
		let count = 0;
		let braceDepth = ZERO_BRACE_DEPTH;
		const exampleLines = fullExampleContent.split('\n');
		for (const line of exampleLines) {
			const trimmed = line.trim();
			const isClassDef =
				trimmed.startsWith('public class ') ||
				trimmed.startsWith('class ') ||
				trimmed.startsWith('private class ');

			if (isClassDef && braceDepth === ZERO_BRACE_DEPTH) {
				count++;
			}

			// Track brace depth to detect inner classes
			const openBracesMatch = line.match(/{/g);
			const closeBracesMatch = line.match(/}/g);
			const openBraces = openBracesMatch
				? openBracesMatch.length
				: ZERO_BRACE_DEPTH;
			const closeBraces = closeBracesMatch
				? closeBracesMatch.length
				: ZERO_BRACE_DEPTH;
			braceDepth += openBraces - closeBraces;
		}
		return count;
	})();
	// Count how many class definitions are in the included content
	const classDefCountInIncluded = codeToInclude.filter((line) => {
		const trimmed = line.trim();
		return (
			trimmed.startsWith('public class ') ||
			trimmed.startsWith('class ') ||
			trimmed.startsWith('private class ')
		);
	}).length;
	// Only treat as top-level class if:
	// 1. There's exactly one class in the original content, OR
	// 2. There are multiple classes in the original but only one class definition is in the included content
	// If multiple class definitions are in the included content, treat them as inner classes
	const hasTopLevelClass =
		topLevelClassCount === SINGLE_COUNT ||
		(topLevelClassCount > SINGLE_COUNT &&
			classDefCountInIncluded <= SINGLE_COUNT);

	// Check for class-like structures (attributes, methods, inner classes) without top-level class
	// Also includes cases with multiple top-level classes (which should be treated as inner classes)
	const hasClassLikeStructures = ((): boolean => {
		if (hasTopLevelClass) {
			return false;
		}
		// If there are multiple top-level classes, check if multiple classes will be included
		// If only one class's content is included, treat it as top-level (handled by hasTopLevelClass)
		// If multiple classes' content is included, treat them as inner classes
		if (topLevelClassCount > SINGLE_COUNT) {
			// If multiple class definitions are in the included content, multiple classes are included
			// Otherwise, only one class's content is included, so treat it as top-level
			return classDefCountInIncluded > SINGLE_COUNT;
		}
		const fieldDeclarationRegex =
			/^\s*(public|private|protected)\s+\w+\s+\w+\s*[;=]/;
		return codeToInclude.some((line) => {
			const trimmed = line.trim();
			// Method signatures (but not class definitions)
			const isMethodSignature =
				(trimmed.startsWith('public ') ||
					trimmed.startsWith('private ') ||
					trimmed.startsWith('protected ')) &&
				trimmed.includes('() {') &&
				!trimmed.includes('class ');
			// Field declarations
			const fieldMatch = fieldDeclarationRegex.exec(trimmed);
			const isFieldDeclaration = Boolean(fieldMatch);
			// Inner class
			const isInnerClass =
				trimmed.includes('class ') && trimmed.includes('{');
			return isMethodSignature || isFieldDeclaration || isInnerClass;
		});
	})();

	let classContent = '';

	// Extract helper methods and filter them BEFORE adding to file
	// This ensures we don't create helper methods for methods already defined in the example
	// Do this once for all branches to avoid duplication
	const allHelperMethods = extractHelperMethods(codeToInclude);
	const FIRST_CAPTURE_GROUP = 1;
	const EMPTY_NAME_LENGTH = 0;

	// Extract method names that are part of the example code (not helpers)
	// These are methods declared in the example, not method calls
	// Match method declarations with any combination of modifiers
	const exampleMethodNames = new Set<string>();
	// Match method declarations: [modifiers]* returnType methodName(
	// Handles: public void method(), private String getPattern(), static final Pattern compile(), etc.
	// Pattern: (modifiers with spaces) returnType methodName(
	// Modifiers can be: public, private, protected, static, final (in any order)
	// Return type is a word (void, String, Pattern, etc.)
	// Method name is captured in group 1
	const methodDeclRegex =
		/\b(?:public|private|protected|static|final)(?:\s+(?:public|private|protected|static|final))*\s+\w+\s+(\w+)\s*\(/g;
	let methodDeclMatch: RegExpExecArray | null = null;
	while (
		(methodDeclMatch = methodDeclRegex.exec(fullExampleContent)) !== null
	) {
		// The regex always captures the method name in group 1, so methodName is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex guarantees capture group 1 exists
		const methodName = methodDeclMatch[FIRST_CAPTURE_GROUP]!;
		exampleMethodNames.add(methodName);
	}

	// Filter out example methods from helper methods (they're not helpers)
	// Create a map of method name to method signature for efficient filtering
	const helperMethodMap = new Map<string, string>();
	for (const method of allHelperMethods) {
		// Extract method name from signature like "public Boolean methodName() {" or "public List<String> methodName() {"
		// Handle both simple types (Boolean, String) and generic types (List<String>, Map<String, Integer>)
		const methodNameMatch =
			/public\s+(?:\w+(?:<[^>]+(?:,\s*[^>]+)?>)?)\s+(\w+)\s*\(/.exec(
				method,
			);
		const methodName = methodNameMatch?.[FIRST_CAPTURE_GROUP];
		if (
			methodName !== undefined &&
			methodName.length > EMPTY_NAME_LENGTH &&
			!exampleMethodNames.has(methodName)
		) {
			helperMethodMap.set(methodName, method);
		}
	}

	// Filter to only include methods not already defined in the example
	const filteredHelperMethods = Array.from(helperMethodMap.entries())
		.filter(
			([methodName]: readonly [string, string]) =>
				!exampleMethodNames.has(methodName),
		)
		.map(
			([, methodSignature]: readonly [string, string]) => methodSignature,
		);

	const actualHelperMethodNames = Array.from(helperMethodMap.keys());

	if (hasTopLevelClass) {
		// Case 1: Has top-level class - extract from original content and rename the class
		// We need to extract the full class structure from the original content,
		// but only include lines that match our includeViolations/includeValids criteria
		const exampleLines = fullExampleContent.split('\n');
		const extractedCode: string[] = [];
		let insideClass = false;
		let classBraceDepth = ZERO_BRACE_DEPTH;
		const INITIAL_BRACE_DEPTH = 1;
		let methodBraceDepth = ZERO_BRACE_DEPTH;
		let currentMode: 'valid' | 'violation' | null = null;
		let insideMethod = false;
		let methodDeclaration: string | null = null;
		let methodDeclarationOriginal: string | null = null;
		let hasIncludedMethodContent = false;

		// eslint-disable-next-line @typescript-eslint/prefer-for-of -- Need index for method tracking
		for (let lineIndex = 0; lineIndex < exampleLines.length; lineIndex++) {
			// Array access with valid index always returns a value, never undefined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loop condition ensures valid index
			const line = exampleLines[lineIndex]!;
			const trimmed = line.trim();

			// Determine mode based on markers or section headers
			if (trimmed.includes('// ❌')) {
				currentMode = 'violation';
			} else if (trimmed.includes('// ✅')) {
				currentMode = 'valid';
			} else if (trimmed.startsWith('// Violation:')) {
				currentMode = 'violation';
			} else if (trimmed.startsWith('// Valid:')) {
				currentMode = 'valid';
			}

			// Check if this line should be included based on includeViolations/includeValids
			const shouldInclude =
				!trimmed.startsWith('//') &&
				trimmed.length > EMPTY_LENGTH &&
				((includeViolations && currentMode === 'violation') ||
					(includeValids && currentMode === 'valid'));

			// Replace class definition with our test class name
			if (
				trimmed.startsWith('public class ') ||
				trimmed.startsWith('class ') ||
				trimmed.startsWith('private class ')
			) {
				// Only replace if we're at the top level (classBraceDepth === 0)
				const CLASS_PREFIX_GROUP_INDEX = 1;
				if (classBraceDepth === ZERO_BRACE_DEPTH) {
					const classRegex = /^(public\s+|private\s+)?class\s+(\w+)/;
					const classMatch = classRegex.exec(trimmed);
					if (classMatch) {
						const classPrefix =
							classMatch[CLASS_PREFIX_GROUP_INDEX] ?? '';
						const newClassLine = `${classPrefix}class ${TEST_CLASS_NAME} {`;
						extractedCode.push(newClassLine);
						insideClass = true;
						classBraceDepth = INITIAL_BRACE_DEPTH;
						continue;
					}
				}
			}

			if (insideClass || classBraceDepth > ZERO_BRACE_DEPTH) {
				// Count braces in the line
				const openBracesMatch = line.match(/{/g);
				const closeBracesMatch = line.match(/}/g);
				const openBraces = openBracesMatch
					? openBracesMatch.length
					: ZERO_BRACE_DEPTH;
				const closeBraces = closeBracesMatch
					? closeBracesMatch.length
					: ZERO_BRACE_DEPTH;
				const prevClassBraceDepth = classBraceDepth;
				classBraceDepth += openBraces - closeBraces;

				// Detect method declarations (lines with opening brace that increase depth from 1 to 2)
				// Exclude property blocks (Pattern FIELD_PATTERN { get { ... } }) - these are not methods
				const isPropertyBlock =
					trimmed.includes('{') &&
					!trimmed.includes('(') &&
					!trimmed.includes('void') &&
					prevClassBraceDepth === INITIAL_BRACE_DEPTH;
				const methodRegex = /\w+\s*\(/;
				const methodMatch = methodRegex.exec(trimmed);
				const hasMethodPattern = methodMatch !== null;
				// Check if this is a method declaration (not a property block)
				// Property blocks are excluded - they have { but no ( and no void
				// If it's a property block, it's not a method declaration
				let isMethodDeclaration = false;
				if (!isPropertyBlock) {
					// Not a property block - check if it's a method declaration
					// Check depth conditions first
					const hasCorrectDepth =
						prevClassBraceDepth === INITIAL_BRACE_DEPTH &&
						classBraceDepth > INITIAL_BRACE_DEPTH;
					// Check structure conditions
					const hasMethodStructure =
						!trimmed.startsWith('{') && trimmed.includes('{');
					// Check method indicators (void, parentheses, or method pattern)
					const hasVoid = trimmed.includes('void');
					const hasParentheses = trimmed.includes('(');
					const hasMethodIndicator =
						hasVoid || hasParentheses || hasMethodPattern;
					isMethodDeclaration =
						hasCorrectDepth &&
						hasMethodStructure &&
						hasMethodIndicator;
				}

				if (isMethodDeclaration) {
					insideMethod = true;
					methodBraceDepth = classBraceDepth - INITIAL_BRACE_DEPTH;
					methodDeclaration = trimmed;
					methodDeclarationOriginal = line;
					hasIncludedMethodContent = false;
				}

				// Track method brace depth
				if (insideMethod) {
					methodBraceDepth += openBraces - closeBraces;
					if (methodBraceDepth <= ZERO_BRACE_DEPTH) {
						// Method ended
						insideMethod = false;
						methodDeclaration = null;
						methodDeclarationOriginal = null;
						hasIncludedMethodContent = false;
					}
				}

				// Include line if it matches our criteria or is structural (braces, etc.)
				// Always include braces to maintain structure - this ensures property getters/setters, methods, and class are properly structured
				const shouldIncludeBrace = trimmed === '{' || trimmed === '}';
				if (shouldInclude || shouldIncludeBrace) {
					// Check if this is the method declaration line itself (with or without marker)
					const hasMethodDeclaration =
						methodDeclaration !== null &&
						methodDeclarationOriginal !== null;
					const markerRegex = /\s*\/\/\s*[❌✅].*$/;
					const trimmedWithoutMarker = trimmed
						.replace(markerRegex, '')
						.trim();
					const isMethodDeclarationLine =
						insideMethod &&
						hasMethodDeclaration &&
						(trimmed === methodDeclaration ||
							trimmedWithoutMarker === methodDeclaration);

					if (
						shouldInclude &&
						insideMethod &&
						hasMethodDeclaration &&
						!hasIncludedMethodContent
					) {
						// First time including content from this method
						if (isMethodDeclarationLine) {
							// This IS the method declaration line - include it once with marker removed but preserve indentation
							const codeLine = removeInlineMarkers(line);
							extractedCode.push(codeLine);
							hasIncludedMethodContent = true;
						} else {
							// This is method body content - include method declaration first, then this line
							// Preserve indentation for method declaration
							// methodDeclarationOriginal is checked by hasMethodDeclaration (both are non-null)
							/* eslint-disable @typescript-eslint/no-non-null-assertion */
							const methodDeclOriginal =
								methodDeclarationOriginal!;
							/* eslint-enable @typescript-eslint/no-non-null-assertion */
							const methodDeclWithIndent =
								formatMethodDeclarationIndent(
									methodDeclOriginal,
								);
							extractedCode.push(methodDeclWithIndent);
							// Remove inline markers from code lines but preserve indentation
							const codeLine = removeInlineMarkers(line);
							extractedCode.push(codeLine);
							hasIncludedMethodContent = true;
						}
					} else if (shouldInclude && !isMethodDeclarationLine) {
						// Regular content line - remove inline markers but preserve indentation
						const codeLine = removeInlineMarkers(line);
						extractedCode.push(codeLine);
					} else {
						// Structural braces - preserve original line to maintain indentation
						// This handles braces when shouldInclude is false but braces are needed for structure
						// We're inside the outer if (shouldInclude || trimmed === '{' || trimmed === '}'),
						// and shouldInclude is false, so trimmed must be '{' or '}'
						extractedCode.push(line);
					}
				}

				if (classBraceDepth <= ZERO_BRACE_DEPTH) {
					// Class ended - reset state
					// Note: We don't add closing brace here because line 662 handles it after the loop
					// This ensures consistent behavior regardless of when the class ends
					insideClass = false;
					classBraceDepth = ZERO_BRACE_DEPTH;
					insideMethod = false;
					methodDeclaration = null;
					methodDeclarationOriginal = null;
				}
			} else if (shouldInclude) {
				// Include standalone lines outside classes
				const codeLine = removeInlineMarkers(line).trim();
				extractedCode.push(codeLine);
			}
		}

		// Ensure class closing brace is present if we started a class
		// When hasTopLevelClass is true, we always push the class declaration (line 502),
		// so extractedCode.length > EMPTY_LENGTH is always true
		// We're already in the hasTopLevelClass branch, so this check is always true
		const lastLineIndex = extractedCode.length - LAST_ELEMENT_OFFSET;
		// lastLineIndex is always valid because we always have at least the class declaration
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const lastLine = extractedCode[lastLineIndex]!;
		if (!lastLine.trim().endsWith('}')) {
			// Add missing class closing brace
			extractedCode.push('}');
		}
		// Add helper methods before the final closing brace
		const classContentStr = extractedCode.join('\n');
		// Find the last closing brace (should be the class closing brace)
		// After line 662, if hasTopLevelClass is true, extractedCode always has at least one '}'
		// So lastBraceIndex is never NOT_FOUND_INDEX when hasTopLevelClass is true
		const lastBraceIndex = classContentStr.lastIndexOf('}');
		// After line 662, if hasTopLevelClass is true, extractedCode always has at least one '}'
		// So lastBraceIndex is always >= 0 when hasTopLevelClass is true
		// We're in the hasTopLevelClass branch, so lastBraceIndex >= 0 is guaranteed
		if (filteredHelperMethods.length > EMPTY_LENGTH) {
			// Split class content at the last closing brace to insert helper methods
			// lastBraceIndex is always > 0 because we have at least the class declaration line before the closing brace
			const beforeLastBrace = classContentStr.substring(
				ZERO_BRACE_DEPTH,
				lastBraceIndex,
			);
			const afterLastBrace = classContentStr.substring(lastBraceIndex);
			classContent = beforeLastBrace + '\n';
			for (const method of filteredHelperMethods) {
				classContent += `    ${method}\n`;
			}
			classContent += afterLastBrace + '\n';
		} else {
			// No helper methods - classContentStr already has closing brace from line 662
			classContent = classContentStr + '\n';
		}
	} else if (hasClassLikeStructures) {
		// Case 2: Has attributes/methods/inner-class - wrap in a class
		classContent = `public class ${TEST_CLASS_NAME} {\n`;
		codeToInclude.forEach((line) => {
			classContent += `    ${line}\n`;
		});

		// Add filtered helper methods
		for (const method of filteredHelperMethods) {
			classContent += `    ${method}\n`;
		}

		classContent += '}\n';
	} else {
		// Case 3: Just normal lines - wrap in a method inside a class
		classContent = `public class ${TEST_CLASS_NAME} {\n`;

		if (codeToInclude.length > EMPTY_LENGTH) {
			classContent += `    public void testMethod${String(exampleIndex)}() {\n`;
			codeToInclude.forEach((line) => {
				classContent += `        ${line}\n`;
			});
			classContent += `    }\n`;
		}

		// Add filtered helper methods
		for (const method of filteredHelperMethods) {
			classContent += `    ${method}\n`;
		}

		classContent += '}\n';
	}

	writeFileSync(tempFile, classContent, 'utf-8');

	// Track what was added for AST processing
	const TEST_METHOD_NAME = `testMethod${String(exampleIndex)}`;

	const addedWrapperClass = !hasTopLevelClass;
	const addedWrapperMethod = !hasTopLevelClass && !hasClassLikeStructures;

	return {
		filePath: tempFile,
		hasValids: parsed.valids.length > EMPTY_LENGTH,
		hasViolations: parsed.violations.length > EMPTY_LENGTH,
		validCount: parsed.valids.length,
		violationCount: parsed.violations.length,
		wrapperInfo: {
			addedWrapperClass,
			addedWrapperMethod,
			helperMethodNames: [...actualHelperMethodNames],
			wrapperClassName: TEST_CLASS_NAME,
			wrapperMethodName: TEST_METHOD_NAME,
		},
	};
}
