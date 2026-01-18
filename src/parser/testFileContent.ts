/**
 * @file
 * Test file content generation helpers for PMD rule testing.
 */

const EMPTY_LENGTH = 0;
const FIRST_CAPTURE_GROUP_INDEX = 1;
const SECOND_CAPTURE_GROUP_INDEX = 2;
const TAB_CHAR = '\t';
const SPACE_CHAR = ' ';
const DEFAULT_INDENT = '    ';
const FIRST_ELEMENT_INDEX = 0;

/**
 * Removes inline markers from a code line while preserving leading indentation.
 * @param line - The line to process.
 * @returns The line with markers removed and trailing whitespace trimmed.
 */
function removeInlineMarkers(line: string): string {
	if (line.includes('// ❌')) {
		const splitResult = line.split('// ❌');
		// split() always returns at least one element, so [0] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const codeLine = splitResult[FIRST_ELEMENT_INDEX]!;
		// Remove trailing whitespace but preserve leading indentation
		return codeLine.replace(/\s+$/, '');
	}
	if (line.includes('// ✅')) {
		const splitResult = line.split('// ✅');
		// split() always returns at least one element, so [0] is always defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const codeLine = splitResult[FIRST_ELEMENT_INDEX]!;
		// Remove trailing whitespace but preserve leading indentation
		return codeLine.replace(/\s+$/, '');
	}
	return line;
}

/**
 * Formats method declaration with appropriate indentation.
 * @param methodDecl - The method declaration string.
 * @returns The method declaration with preserved or default indentation.
 */
function formatMethodDeclarationIndent(methodDecl: string): string {
	const startsWithTab = methodDecl.startsWith(TAB_CHAR);
	if (startsWithTab) {
		return methodDecl;
	}
	const startsWithSpace = methodDecl.startsWith(SPACE_CHAR);
	if (startsWithSpace) {
		return methodDecl;
	}
	return `${DEFAULT_INDENT}${methodDecl}`;
}

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
function generateReturnValue(returnType: string): string {
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
 * Apex keywords that should not be considered method names.
 */
const APEX_KEYWORDS = new Set([
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
]);

/**
 * Check if a method call should be filtered out (is Apex keyword or object method).
 * @param methodName - Method name from regex match.
 * @param matchIndex - Index of match in code.
 * @param fullCode - Full code string.
 * @returns True if method should be filtered out.
 */
function shouldFilterMethod(
	methodName: string | undefined,
	matchIndex: number | undefined,
	fullCode: Readonly<string>,
): boolean {
	const MIN_INDEX = 0;
	const CHAR_BEFORE_OFFSET = 1;

	// methodName is always a string when regex matches, but TypeScript doesn't know this
	// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- Regex always captures when it matches
	if (!methodName || APEX_KEYWORDS.has(methodName)) {
		return true;
	}

	if (matchIndex !== undefined && matchIndex > MIN_INDEX) {
		const charBeforeMatch = fullCode[matchIndex - CHAR_BEFORE_OFFSET];
		if (charBeforeMatch === '.') {
			return true;
		}
	}

	return false;
}

/**
 * Extract method names from code that need helper methods.
 * @param fullCode - Full code string to analyze.
 * @returns Set of method names that need helpers.
 */
function extractMethodNames(fullCode: Readonly<string>): Set<string> {
	const methodCallRegex = /\b([a-zA-Z_]\w*)\s*\(/g;
	const foundMethods = new Set<string>();
	let match: RegExpExecArray | null = null;

	while ((match = methodCallRegex.exec(fullCode)) !== null) {
		const [, methodName] = match;
		const matchIndex = match.index;

		if (
			methodName !== undefined &&
			!shouldFilterMethod(methodName, matchIndex, fullCode)
		) {
			// methodName is always a string when regex matches, so it's always defined
			// But TypeScript doesn't understand this invariant
			foundMethods.add(methodName);
		}
	}

	return foundMethods;
}

/**
 * Generate method signature for a helper method.
 * @param methodName - The method name to generate a signature for.
 * @param fullCode - Full code to infer return type from.
 * @returns Complete method signature including return type and parameters.
 */
function generateMethodSignature(
	methodName: string,
	fullCode: Readonly<string>,
): string {
	const returnType = inferReturnType(fullCode, methodName);
	const returnValue = generateReturnValue(returnType);
	return `public ${returnType} ${methodName}() {\n        ${returnValue}\n    }`;
}

/**
 * Extract helper methods needed for the test code.
 * Analyzes method calls in the code and generates appropriate helper method signatures.
 * @param codeLines - Array of code lines to analyze.
 * @returns Array of helper method signatures with implementations.
 */
function extractHelperMethods(codeLines: readonly string[]): string[] {
	const fullCode = codeLines.join('\n');
	const foundMethods = extractMethodNames(fullCode);
	const methods = new Map<string, string>();

	for (const methodName of foundMethods) {
		const methodSignature = generateMethodSignature(methodName, fullCode);
		methods.set(methodName, methodSignature);
	}

	return Array.from(methods.values());
}

export {
	removeInlineMarkers,
	formatMethodDeclarationIndent,
	inferReturnType,
	generateReturnValue,
	extractHelperMethods,
};
