/**
 * @file
 * Creates temporary Apex test files from example content for PMD rule testing.
 */
import { writeFileSync } from 'fs';
import tmp from 'tmp';
import type { TestFileResult } from '../types/index.js';
import { parseExample } from './parseExample.js';

const EMPTY_LENGTH = 0;
const FIRST_CAPTURE_GROUP_INDEX = 1;
const SECOND_CAPTURE_GROUP_INDEX = 2;

/**
 * Infers the return type of a method based on its usage context in the code.
 * @param code - Full code to analyze.
 * @param methodName - Name of the method to analyze.
 * @returns Inferred return type (always returns a string, defaults to 'Boolean').
 */
function inferReturnType(code: string, methodName: string): string {
	// Look for patterns that indicate return types

	// Comparison with numbers: method() > 0, method() < 5, etc.
	if (
		new RegExp(`\\b${methodName}\\s*\\(\\s*\\)\\s*[><=!]+\\s*\\d+`).test(
			code,
		)
	) {
		return 'Integer';
	}

	// Switch statements: switch on method()
	if (new RegExp(`switch\\s+on\\s+${methodName}\\s*\\(`).test(code)) {
		return 'String';
	}

	// Ternary expressions: method() ? ... : ...
	if (new RegExp(`${methodName}\\s*\\(\\s*\\)\\s*\\?`).test(code)) {
		return 'Boolean';
	}

	// For-each loops: for (Type var : method())
	if (new RegExp(`for\\s*\\([^:]*:\\s*${methodName}\\s*\\(`).test(code)) {
		return 'List<String>';
	}

	// Set assignments: Set<Type> var = method()
	if (
		new RegExp(`Set<[^>]+>\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)
	) {
		return 'Set<String>';
	}

	// Map assignments: Map<Key, Value> var = method()
	if (
		new RegExp(
			`Map<[^>]+,\\s*[^>]+>\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`,
		).test(code)
	) {
		return 'Map<String, Integer>';
	}

	// Decimal assignments: Decimal var = method()
	if (new RegExp(`Decimal\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)) {
		return 'Decimal';
	}

	// Double assignments: Double var = method()
	if (new RegExp(`Double\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)) {
		return 'Double';
	}

	// Long assignments: Long var = method()
	if (new RegExp(`Long\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)) {
		return 'Long';
	}

	// Date assignments: Date var = method()
	if (new RegExp(`Date\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)) {
		return 'Date';
	}

	// Datetime assignments: Datetime var = method()
	if (
		new RegExp(`Datetime\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)
	) {
		return 'Datetime';
	}

	// Time assignments: Time var = method()
	if (new RegExp(`Time\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)) {
		return 'Time';
	}

	// Blob assignments: Blob var = method()
	if (new RegExp(`Blob\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)) {
		return 'Blob';
	}

	// Id assignments: Id var = method()
	if (new RegExp(`Id\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)) {
		return 'Id';
	}

	// While/do-while conditions: while (method())
	if (new RegExp(`(?:while|do)\\s*\\(\\s*${methodName}\\s*\\(`).test(code)) {
		return 'Boolean';
	}

	// Object assignments: Object var = method()
	// This is a catch-all for any object type that doesn't match above patterns
	if (new RegExp(`Object\\s+\\w+\\s*=\\s*${methodName}\\s*\\(`).test(code)) {
		return 'Object';
	}

	// Default to Boolean for unknown patterns
	// Note: This ensures inferReturnType always returns a valid type that matches a case in generateReturnValue
	return 'Boolean';
}

/**
 * Generates an appropriate return value statement for a given Apex type.
 * @internal
 * @param returnType - The Apex return type to generate a value for.
 * @returns Return statement with appropriate value for the type.
 */
// eslint-disable-next-line import/group-exports -- generateReturnValue is exported for testing only
export function generateReturnValue(returnType: string): string {
	// Handle collection types dynamically with support for nested generics
	const listRegex = /^List<(.+)>$/;
	const listMatch = listRegex.exec(returnType);
	const listInnerType = listMatch?.[FIRST_CAPTURE_GROUP_INDEX];
	if (listInnerType !== undefined && listInnerType.length > EMPTY_LENGTH) {
		return `return new List<${listInnerType}>();`;
	}

	const setRegex = /^Set<(.+)>$/;
	const setMatch = setRegex.exec(returnType);
	const setInnerType = setMatch?.[FIRST_CAPTURE_GROUP_INDEX];
	if (setInnerType !== undefined && setInnerType.length > EMPTY_LENGTH) {
		return `return new Set<${setInnerType}>();`;
	}

	const mapRegex = /^Map<(.+),\s*(.+)>$/;
	const mapMatch = mapRegex.exec(returnType);
	const mapKeyType = mapMatch?.[FIRST_CAPTURE_GROUP_INDEX];
	const mapValueType = mapMatch?.[SECOND_CAPTURE_GROUP_INDEX];
	if (
		mapKeyType !== undefined &&
		mapValueType !== undefined &&
		mapKeyType.length > EMPTY_LENGTH &&
		mapValueType.length > EMPTY_LENGTH
	) {
		return `return new Map<${mapKeyType}, ${mapValueType}>();`;
	}

	// Handle primitive and specific types
	switch (returnType) {
		case 'Integer':
			return 'return 1;';
		case 'String':
			return "return 'test';";
		case 'Boolean':
			return 'return true;';
		case 'Decimal':
			return 'return 1.0;';
		case 'Double':
			return 'return 1.0;';
		case 'Long':
			return 'return 1000L;';
		case 'Date':
			return 'return Date.newInstance(2024, 1, 1);';
		case 'Datetime':
			return 'return Datetime.newInstance(2024, 1, 1);';
		case 'Time':
			return 'return Time.newInstance(0, 0, 0, 0);';
		case 'Blob':
			return "return Blob.valueOf('test');";
		case 'Id':
			return "return '001000000000000000';";
		case 'Object':
			return 'return null;';
		// All types from inferReturnType are handled above
		// TypeScript ensures exhaustiveness, so no default needed
		// However, we keep a default for runtime safety in case inferReturnType is extended
		default:
			// This should never be reached as inferReturnType always returns a known type
			// But kept for type safety and to satisfy TypeScript exhaustiveness
			// To test this, we would need to call generateReturnValue directly with an unknown type
			return 'return null;';
	}
}

/**
 * Extract helper methods needed for the test code.
 * Analyzes method calls in the code and generates appropriate helper method signatures.
 * @param codeLines - Array of code lines to analyze.
 * @returns Array of helper method signatures with implementations.
 */
function extractHelperMethods(codeLines: readonly string[]): string[] {
	const methods = new Map<string, string>();

	// Join all code lines for easier analysis
	const fullCode = codeLines.join('\n');

	// Extract method calls using regex - match word characters before parentheses
	const methodCallRegex = /\b([a-zA-Z_]\w*)\s*\(/g;
	let match: RegExpExecArray | null = null;
	const foundMethods = new Set<string>();

	// Apex keywords that should not be considered method names
	const apexKeywords = [
		'if',
		'else',
		'for',
		'while',
		'do',
		'switch',
		'case',
		'default',
		'try',
		'catch',
		'finally',
		'class',
		'interface',
		'enum',
		'public',
		'private',
		'protected',
		'static',
		'final',
		'abstract',
		'void',
		'return',
		'new',
		'this',
		'super',
		'extends',
		'implements',
		'instanceof',
		'System',
		'debug',
		'List',
		'Map',
		'Set',
		'String',
		'Integer',
		'Boolean',
		'Double',
		'Date',
		'Datetime',
	];

	while ((match = methodCallRegex.exec(fullCode)) !== null) {
		const [, methodName] = match;

		// Skip Apex keywords and built-in types
		// The false branch (methodName === undefined) is unreachable
		// as regex match always produces a value, so remove conditional to eliminate branch
		if (methodName !== undefined && apexKeywords.includes(methodName)) {
			continue;
		}

		// Remove unreachable false branch - methodName is always defined from regex match
		// Use non-null assertion to eliminate unreachable branch
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- methodName is always defined from regex match
		foundMethods.add(methodName!);
	}

	// For each found method, determine return type and generate signature
	for (const methodName of foundMethods) {
		const returnType = inferReturnType(fullCode, methodName);

		// inferReturnType always returns a non-empty string (defaults to 'Boolean')
		// so we can safely use the return type directly
		// Ensure returnType is a valid type that matches a case in generateReturnValue
		const validReturnType: string = returnType;
		const methodSignature = `public ${validReturnType} ${methodName}() {\n        ${generateReturnValue(validReturnType)}\n    }`;
		methods.set(methodName, methodSignature);
	}

	return Array.from(methods.values());
}

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
// eslint-disable-next-line import/group-exports -- createTestFile is the main export, generateReturnValue is for testing
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
	const ZERO_BRACE_DEPTH = 0;
	const hasTopLevelClass = ((): boolean => {
		let foundTopLevelClass = false;
		let braceDepth = ZERO_BRACE_DEPTH;
		const exampleLines = fullExampleContent.split('\n');
		for (const line of exampleLines) {
			const trimmed = line.trim();
			const isClassDef =
				trimmed.startsWith('public class ') ||
				trimmed.startsWith('class ') ||
				trimmed.startsWith('private class ');

			if (isClassDef && braceDepth === ZERO_BRACE_DEPTH) {
				foundTopLevelClass = true;
				break;
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
		return foundTopLevelClass;
	})();

	// Check for class-like structures (attributes, methods, inner classes) without top-level class
	const hasClassLikeStructures = ((): boolean => {
		if (hasTopLevelClass) {
			return false;
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

	if (hasTopLevelClass) {
		// Case 1: Has top-level class - extract from original content and rename the class
		// We need to extract the full class structure from the original content,
		// but only include lines that match our includeViolations/includeValids criteria
		const exampleLines = fullExampleContent.split('\n');
		const extractedCode: string[] = [];
		let insideClass = false;
		let classBraceDepth = ZERO_BRACE_DEPTH;
		let currentMode: 'valid' | 'violation' | null = null;

		for (const line of exampleLines) {
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
				const INITIAL_BRACE_DEPTH = 1;
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
				classBraceDepth += openBraces - closeBraces;

				// Include line if it matches our criteria or is structural (braces, etc.)
				if (shouldInclude || trimmed === '{' || trimmed === '}') {
					// Remove inline markers from code lines
					let codeLine = line;
					const FIRST_ELEMENT_INDEX = 0;
					if (line.includes('// ❌')) {
						const splitResult = line.split('// ❌');
						// split() always returns at least one element, so [0] is always defined
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						codeLine = splitResult[FIRST_ELEMENT_INDEX]!.trim();
					} else if (line.includes('// ✅')) {
						const splitResult = line.split('// ✅');
						// split() always returns at least one element, so [0] is always defined
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						codeLine = splitResult[FIRST_ELEMENT_INDEX]!.trim();
					}
					extractedCode.push(codeLine);
				}

				if (classBraceDepth <= ZERO_BRACE_DEPTH) {
					insideClass = false;
					classBraceDepth = ZERO_BRACE_DEPTH;
				}
			} else if (shouldInclude) {
				// Include standalone lines outside classes
				let codeLine = line;
				const FIRST_ELEMENT_INDEX = 0;
				if (line.includes('// ❌')) {
					const splitResult = line.split('// ❌');
					// split() always returns at least one element, so [0] is always defined
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					codeLine = splitResult[FIRST_ELEMENT_INDEX]!.trim();
				} else if (line.includes('// ✅')) {
					const splitResult = line.split('// ✅');
					// split() always returns at least one element, so [0] is always defined
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					codeLine = splitResult[FIRST_ELEMENT_INDEX]!.trim();
				}
				extractedCode.push(codeLine);
			}
		}

		// Add helper methods before the final closing brace
		const helperMethods = extractHelperMethods(codeToInclude);
		const classContentStr = extractedCode.join('\n');
		// The logic at line 465 always includes braces, so classContentStr will always have '}'
		const lastBraceIndex = classContentStr.lastIndexOf('}');

		if (helperMethods.length > EMPTY_LENGTH) {
			const beforeLastBrace = classContentStr.substring(
				ZERO_BRACE_DEPTH,
				lastBraceIndex,
			);
			const afterLastBrace = classContentStr.substring(lastBraceIndex);
			classContent = beforeLastBrace + '\n';
			for (const method of helperMethods) {
				classContent += `    ${method}\n`;
			}
			classContent += afterLastBrace + '\n';
		} else {
			classContent = classContentStr + '\n';
		}
	} else if (hasClassLikeStructures) {
		// Case 2: Has attributes/methods/inner-class - wrap in a class
		classContent = `public class ${TEST_CLASS_NAME} {\n`;
		codeToInclude.forEach((line) => {
			classContent += `    ${line}\n`;
		});

		// Add helper methods
		const helperMethods = extractHelperMethods(codeToInclude);
		for (const method of helperMethods) {
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

		// Add helper methods
		const helperMethods = extractHelperMethods(codeToInclude);
		for (const method of helperMethods) {
			classContent += `    ${method}\n`;
		}

		classContent += '}\n';
	}

	writeFileSync(tempFile, classContent, 'utf-8');

	return {
		filePath: tempFile,
		hasValids: parsed.valids.length > EMPTY_LENGTH,
		hasViolations: parsed.violations.length > EMPTY_LENGTH,
		validCount: parsed.valids.length,
		violationCount: parsed.violations.length,
	};
}
