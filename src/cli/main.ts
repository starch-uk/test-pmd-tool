/**
 * @file
 * CLI entry point for PMD Rule Tester. Tests PMD rules using examples embedded in XML rule files.
 */
import { existsSync, readdirSync, realpathSync, statSync } from 'fs';
import { extname, resolve } from 'path';
import { argv } from 'process';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import { DOMParser } from '@xmldom/xmldom';
import { stringifyTree } from 'stringify-tree';
import { RuleTester } from '../tester/RuleTester.js';
import { limitConcurrency } from '../utils/concurrency.js';
import {
	CoverageTracker,
	type CoverageData,
} from '../coverage/trackCoverage.js';
import { generateLcovReport } from '../coverage/generateLcov.js';
import { runPMD, runPmdAstDump } from '../pmd/runPMD.js';
import { createTestFile } from '../parser/createTestFile.js';
import { extractNodeTypes } from '../xpath/extractors/extractNodeTypes.js';
import { parseCliArgs, printUsage } from './args.js';

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ERROR = 1;
const PARSE_INT_RADIX = 10;
const LINE_NUMBER_MATCH_GROUP_INDEX = 1;
const ARGV_SLICE_INDEX = 2;
const REPEAT_CHAR_COUNT = 60;
const MIN_FAILED_FILES_COUNT = 0;
const EXAMPLE_INDEX_OFFSET = 1;
const MIN_EXAMPLES_LENGTH = 0;
const NODE_TYPE_ELEMENT = 1;
const EMPTY_ARRAY_LENGTH = 0;
const SINGLE_ELEMENT_INDEX = 0;
const MIN_ARRAY_INDEX = 0;
const DOT_SEPARATOR_LENGTH = 1;

/**
 * Determine if this module is being executed as the CLI entrypoint.
 * @returns True if the current module is the Node entry file.
 */
function isCliInvocation(): boolean {
	const [, entryPath] = argv;
	if (entryPath === undefined) {
		return false;
	}
	try {
		// Convert import.meta.url to absolute file path
		const currentModulePath = fileURLToPath(import.meta.url);
		// Resolve entryPath to absolute path to handle relative paths from npm/node_modules
		const resolvedEntryPath = resolve(process.cwd(), entryPath);
		// Resolve symlinks to handle npm/pnpm bin symlinks
		const absoluteEntryPath = realpathSync(resolvedEntryPath);
		// Compare resolved absolute paths
		return currentModulePath === absoluteEntryPath;
	} catch {
		// If path resolution fails (e.g., file doesn't exist), assume not CLI invocation
		return false;
	}
}

/**
 * Recursively finds all XML files in a directory.
 * @param directory - Directory to search.
 * @returns Array of absolute paths to XML files.
 */
function findXmlFiles(directory: string): string[] {
	const xmlFiles: string[] = [];
	const items = readdirSync(directory);

	for (const item of items) {
		const fullPath = resolve(directory, item);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			// Recursively search subdirectories
			xmlFiles.push(...findXmlFiles(fullPath));
		} else if (
			stat.isFile() &&
			extname(fullPath).toLowerCase() === '.xml'
		) {
			xmlFiles.push(fullPath);
		}
	}

	return xmlFiles;
}

/**
 * Remove wrapper elements and helper methods from XML DOM.
 * Removes ONLY the wrapper elements added by createTestFile based on tracking info.
 * @param doc - XML DOM document.
 * @param exampleIndex - 1-based example index used for wrapper names.
 * @param wrapperInfo - Tracking information about what was added by createTestFile.
 */
function removeWrappersFromXmlDom(
	doc: Readonly<Document>, // eslint-disable-line @typescript-eslint/prefer-readonly-parameter-types -- Document is DOM type, Readonly wrapper is appropriate
	exampleIndex: number,
	wrapperInfo:
		| Readonly<{
				addedWrapperClass: boolean;
				wrapperClassName: string;
				addedWrapperMethod: boolean;
				wrapperMethodName: string;
				helperMethodNames: readonly string[];
		  }>
		| undefined,
): void {
	// If no tracking info, fall back to old logic for backward compatibility
	if (wrapperInfo === undefined) {
		const wrapperClassName = `TestClass${String(exampleIndex)}`;
		const wrapperMethodName = `testMethod${String(exampleIndex)}`;

		// Use the old detection logic
		const allMethods = doc.getElementsByTagName('Method');
		const helperMethods: Element[] = [];

		for (const method of Array.from(allMethods)) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Array.from can return null/undefined elements
			if (method === null || method === undefined) {
				continue;
			}
			const image = method.getAttribute('Image');
			const canonicalName = method.getAttribute('CanonicalName');

			if (
				image === wrapperMethodName ||
				canonicalName === wrapperMethodName
			) {
				continue;
			}

			const blockStatements = Array.from(method.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'BlockStatement',
			);

			for (const blockStatement of blockStatements) {
				const returnStatements = Array.from(
					blockStatement.childNodes,
				).filter(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
					(child): child is Element =>
						child.nodeType === NODE_TYPE_ELEMENT &&
						child.nodeName === 'ReturnStatement',
				);

				for (const returnStatement of returnStatements) {
					const literalExpressions = Array.from(
						returnStatement.childNodes,
					).filter(
						// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
						(child): child is Element =>
							child.nodeType === NODE_TYPE_ELEMENT &&
							child.nodeName === 'LiteralExpression',
					);

					const otherStatements = Array.from(
						blockStatement.childNodes,
					).filter(
						// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
						(child): child is Element =>
							child.nodeType === NODE_TYPE_ELEMENT &&
							child.nodeName !== 'ReturnStatement' &&
							child.nodeName !== 'ModifierNode',
					);

					if (
						otherStatements.length === EMPTY_ARRAY_LENGTH &&
						literalExpressions.length > EMPTY_ARRAY_LENGTH
					) {
						helperMethods.push(method);
						break;
					}
				}
			}
		}

		for (const helperMethod of helperMethods) {
			const parent = helperMethod.parentNode;
			if (parent !== null) {
				parent.removeChild(helperMethod);
			}
		}

		const wrapperMethods = Array.from(
			doc.getElementsByTagName('Method'),
		).filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
			(method) => {
				const image = method.getAttribute('Image');
				const canonicalName = method.getAttribute('CanonicalName');
				return (
					image === wrapperMethodName ||
					canonicalName === wrapperMethodName
				);
			},
		);

		for (const wrapperMethod of wrapperMethods) {
			const parent = wrapperMethod.parentNode;
			if (parent === null) {
				continue;
			}

			const blockStatements = Array.from(wrapperMethod.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'BlockStatement',
			);

			for (const blockStatement of blockStatements) {
				const blockChildren = Array.from(
					blockStatement.childNodes,
				).filter(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
					(child): child is Element =>
						child.nodeType === NODE_TYPE_ELEMENT,
				);
				for (const blockChild of blockChildren) {
					parent.insertBefore(blockChild, wrapperMethod);
				}
			}

			parent.removeChild(wrapperMethod);
		}

		const wrapperClasses = Array.from(
			doc.getElementsByTagName('UserClass'),
		).filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
			(userClass) => {
				const simpleName = userClass.getAttribute('SimpleName');
				return simpleName === wrapperClassName;
			},
		);

		const classDeclarations = Array.from(
			doc.getElementsByTagName('ClassDeclaration'),
		).filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
			(classDecl) => {
				const simpleName = classDecl.getAttribute('SimpleName');
				return simpleName === wrapperClassName;
			},
		);

		const allWrapperClasses = [...wrapperClasses, ...classDeclarations];

		for (const wrapperClass of allWrapperClasses) {
			const parent = wrapperClass.parentNode;
			if (parent === null) {
				continue;
			}

			const classChildren = Array.from(wrapperClass.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT,
			);

			for (const classChild of classChildren) {
				parent.insertBefore(classChild, wrapperClass);
			}

			parent.removeChild(wrapperClass);
		}

		const allNodes = doc.getElementsByTagName('*');
		for (const node of Array.from(allNodes)) {
			const definingType = node.getAttribute('DefiningType');
			if (definingType === null) {
				continue;
			}
			if (definingType === wrapperClassName) {
				node.removeAttribute('DefiningType');
			} else if (definingType.startsWith(`${wrapperClassName}.`)) {
				const classNameWithoutPrefix = definingType.slice(
					wrapperClassName.length + DOT_SEPARATOR_LENGTH,
				);
				node.setAttribute('DefiningType', classNameWithoutPrefix);
			}
		}
		return;
	}

	// Use tracking info to surgically remove only what was added
	const {
		addedWrapperClass,
		wrapperClassName,
		addedWrapperMethod,
		wrapperMethodName,
		helperMethodNames,
	} = wrapperInfo;

	// Remove helper methods that were added
	const EMPTY_HELPER_METHODS_LENGTH = 0;
	if (helperMethodNames.length > EMPTY_HELPER_METHODS_LENGTH) {
		const allMethods = doc.getElementsByTagName('Method');
		const methodsArray = Array.from(allMethods);
		const ARRAY_LAST_INDEX_OFFSET = 1;
		for (
			let i = methodsArray.length - ARRAY_LAST_INDEX_OFFSET;
			i >= EMPTY_ARRAY_LENGTH;
			i--
		) {
			const method = methodsArray[i];
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Array access can return undefined
			if (method === null || method === undefined) {
				continue;
			}
			// TypeScript doesn't narrow after continue, so use a local variable
			const methodElement = method;
			const image = methodElement.getAttribute('Image');
			const canonicalName = methodElement.getAttribute('CanonicalName');
			if (
				(image !== null && helperMethodNames.includes(image)) ||
				(canonicalName !== null &&
					helperMethodNames.includes(canonicalName))
			) {
				const parent = methodElement.parentNode;
				if (parent !== null) {
					parent.removeChild(methodElement);
				}
			}
		}
	}

	// Remove wrapper method if it was added
	if (addedWrapperMethod) {
		const wrapperMethods = Array.from(
			doc.getElementsByTagName('Method'),
		).filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
			(method) => {
				const image = method.getAttribute('Image');
				const canonicalName = method.getAttribute('CanonicalName');
				return (
					image === wrapperMethodName ||
					canonicalName === wrapperMethodName
				);
			},
		);

		for (const wrapperMethod of wrapperMethods) {
			const parent = wrapperMethod.parentNode;
			if (parent === null) {
				continue;
			}

			const blockStatements = Array.from(wrapperMethod.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'BlockStatement',
			);

			for (const blockStatement of blockStatements) {
				const blockChildren = Array.from(
					blockStatement.childNodes,
				).filter(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
					(child): child is Element =>
						child.nodeType === NODE_TYPE_ELEMENT,
				);
				for (const blockChild of blockChildren) {
					parent.insertBefore(blockChild, wrapperMethod);
				}
			}

			// Remove ModifierNode from wrapper method (it's not part of the example)
			// The ModifierNode is a sibling of BlockStatement, so remove it before removing the method
			const methodModifierNodes = Array.from(
				wrapperMethod.childNodes,
			).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'ModifierNode',
			);
			for (const modifierNode of methodModifierNodes) {
				wrapperMethod.removeChild(modifierNode);
			}

			parent.removeChild(wrapperMethod);
		}
	}

	// Remove wrapper class if it was added
	if (addedWrapperClass) {
		const wrapperClasses = Array.from(
			doc.getElementsByTagName('UserClass'),
		).filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
			(userClass) => {
				const simpleName = userClass.getAttribute('SimpleName');
				return simpleName === wrapperClassName;
			},
		);

		const classDeclarations = Array.from(
			doc.getElementsByTagName('ClassDeclaration'),
		).filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
			(classDecl) => {
				const simpleName = classDecl.getAttribute('SimpleName');
				return simpleName === wrapperClassName;
			},
		);

		const allWrapperClasses = [...wrapperClasses, ...classDeclarations];

		for (const wrapperClass of allWrapperClasses) {
			const parent = wrapperClass.parentNode;
			if (parent === null) {
				continue;
			}

			const classChildren = Array.from(wrapperClass.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT,
			);

			// Remove ModifierNode from wrapper class (it's not part of the example)
			// Keep all other children (methods, statements, etc.)
			for (const classChild of classChildren) {
				// Skip ModifierNode - it belongs to the wrapper class, not the example
				if (classChild.nodeName === 'ModifierNode') {
					// Remove it from the DOM entirely
					wrapperClass.removeChild(classChild);
					continue;
				}
				parent.insertBefore(classChild, wrapperClass);
			}

			parent.removeChild(wrapperClass);
		}
	} else {
		// Example had a class - keep the class structure but remove wrapper name
		// Also remove the ModifierNode that belongs to the wrapper class
		const wrapperClasses = Array.from(
			doc.getElementsByTagName('UserClass'),
		).filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
			(userClass) => {
				const simpleName = userClass.getAttribute('SimpleName');
				return simpleName === wrapperClassName;
			},
		);

		const classDeclarations = Array.from(
			doc.getElementsByTagName('ClassDeclaration'),
		).filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for filter
			(classDecl) => {
				const simpleName = classDecl.getAttribute('SimpleName');
				return simpleName === wrapperClassName;
			},
		);

		const allWrapperClasses = [...wrapperClasses, ...classDeclarations];

		for (const wrapperClass of allWrapperClasses) {
			wrapperClass.removeAttribute('SimpleName');
			const image = wrapperClass.getAttribute('Image');
			if (image === wrapperClassName) {
				wrapperClass.removeAttribute('Image');
			}

			// Remove ModifierNode that belongs to the wrapper class
			// (the class-level modifier we added, not modifiers from the example)
			const modifierNodes = Array.from(wrapperClass.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'ModifierNode',
			);
			// Remove the first ModifierNode (class-level modifier from wrapper)
			// Keep any other ModifierNodes that might be part of the example
			if (modifierNodes.length > EMPTY_ARRAY_LENGTH) {
				const firstModifier = modifierNodes[SINGLE_ELEMENT_INDEX];
				if (firstModifier !== undefined) {
					// Check if it's the wrapper class modifier (Modifiers='1', Public='true')
					const modifiers = firstModifier.getAttribute('Modifiers');
					const publicAttr = firstModifier.getAttribute('Public');
					const MODIFIER_PUBLIC_VALUE = '1';
					if (
						modifiers === MODIFIER_PUBLIC_VALUE &&
						publicAttr === 'true'
					) {
						wrapperClass.removeChild(firstModifier);
					}
				}
			}
		}
	}

	// Remove or strip wrapper class prefix from DefiningType attribute on all nodes
	const allNodes = doc.getElementsByTagName('*');
	for (const node of Array.from(allNodes)) {
		const definingType = node.getAttribute('DefiningType');
		if (definingType === null) {
			continue;
		}
		if (definingType === wrapperClassName) {
			node.removeAttribute('DefiningType');
		} else if (definingType.startsWith(`${wrapperClassName}.`)) {
			const classNameWithoutPrefix = definingType.slice(
				wrapperClassName.length + DOT_SEPARATOR_LENGTH,
			);
			node.setAttribute('DefiningType', classNameWithoutPrefix);
		}
	}
}

/**
 * Convert XML node to tree structure for stringify-tree.
 * Assumes wrappers have already been removed from the DOM.
 * @param node - XML DOM node.
 * @returns Tree node with name and children.
 */
interface TreeNode {
	children: TreeNode[];
	color?: 'dark-green' | 'dark-red' | 'green' | 'orange' | 'red';
	name: string;
}

/**
 * Options for determining node color.
 */
interface NodeColorOptions {
	beginLine: number | null;
	endLine: number | null;
	exampleContent: string;
	nodeImage: string;
	nodeType: string;
	xpath: string | null;
	previousExamplesCoverage?: readonly {
		validMarkers: readonly { lineNumber: number }[];
		violationMarkers: readonly { lineNumber: number }[];
		exampleContent: string;
	}[];
	validMarkers: readonly { lineNumber: number }[];
	violationMarkers: readonly { lineNumber: number }[];
	wrapperInfo?:
		| Readonly<{
				addedWrapperClass: boolean;
				wrapperClassName: string;
				addedWrapperMethod: boolean;
				wrapperMethodName: string;
				helperMethodNames: readonly string[];
		  }>
		| undefined;

	/**
	 * Set of line numbers in the test file that match the XPath (from PMD violations).
	 */
	xpathMatchLines?: ReadonlySet<number>;

	/**
	 * FullMethodName attribute for MethodCallExpression nodes (e.g., 'Pattern.compile', 'input.replaceFirst').
	 */
	fullMethodName?: string;
}

/**
 * Options for parsing XML AST and stripping wrappers.
 */
interface ParseXmlAstOptions {
	exampleIndex: number;
	exampleContent: string;
	xpath: string | null;
	validMarkers: readonly { lineNumber: number }[];
	violationMarkers: readonly { lineNumber: number }[];
	wrapperInfo:
		| Readonly<{
				addedWrapperClass: boolean;
				wrapperClassName: string;
				addedWrapperMethod: boolean;
				wrapperMethodName: string;
				helperMethodNames: readonly string[];
		  }>
		| undefined;
	xmlAstOutput: string;
	previousExamplesCoverage?: readonly {
		validMarkers: readonly { lineNumber: number }[];
		violationMarkers: readonly { lineNumber: number }[];
		exampleContent: string;
	}[];

	/**
	 * Set of line numbers in the test file that match the XPath (from PMD violations).
	 */
	xpathMatchLines?: ReadonlySet<number>;
}

/**
 * Line number offset for converting 0-based array indices to 1-based line numbers.
 */
const LINE_NUMBER_OFFSET = 1;

/**
 * Empty string length constant for comparisons.
 */
const EMPTY_STRING_LENGTH = 0;

/**
 * Map each line in example content to its section type (violation/valid/null).
 * Uses the same logic as parseExample to categorize lines.
 * @param exampleContent - Original example content.
 * @returns Map of line number (1-based) to section type.
 */

/**
 * Map each line in example content to its section type (violation/valid/null).
 * Uses the same logic as parseExample to categorize lines.
 * @param exampleContent - Original example content.
 * @returns Map of line number (1-based) to section type.
 */
function mapLinesToSections(
	exampleContent: Readonly<string>,
): Map<number, 'valid' | 'violation'> {
	const lines = exampleContent.split('\n');
	const lineSectionMap = new Map<number, 'valid' | 'violation'>();
	let currentMode: 'valid' | 'violation' | null = null;

	lines.forEach((line, index) => {
		const trimmed = line.trim();
		const lineNumber = index + LINE_NUMBER_OFFSET;

		/**
		 * Default to current mode.
		 */
		let lineMode = currentMode;

		// Check for inline violation/valid markers
		if (trimmed.includes('// ❌')) {
			lineMode = 'violation';
		} else if (trimmed.includes('// ✅')) {
			lineMode = 'valid';
		}

		if (trimmed.startsWith('// Violation:')) {
			currentMode = 'violation';
		} else if (trimmed.startsWith('// Valid:')) {
			currentMode = 'valid';
		} else if (
			trimmed.length > EMPTY_STRING_LENGTH &&
			!trimmed.startsWith('//')
		) {
			// This is a code line - it belongs to the determined mode
			if (lineMode === 'violation' || currentMode === 'violation') {
				lineSectionMap.set(lineNumber, 'violation');
			} else if (lineMode === 'valid' || currentMode === 'valid') {
				lineSectionMap.set(lineNumber, 'valid');
			}
		}
	});

	return lineSectionMap;
}

/**
 * Find which lines in the example contain the source code represented by an AST node.
 * @param nodeType - AST node type name.
 * @param nodeImage - Image attribute from node (method name, variable name, etc.).
 * @param exampleContent - Original example content.
 * @returns Array of line numbers (1-based) that contain this node's source code.
 */
function findLinesContainingNodeSource(
	nodeType: Readonly<string>,
	nodeImage: Readonly<string>,
	exampleContent: Readonly<string>,
): number[] {
	const lines = exampleContent.split('\n');
	const matchingLines: number[] = [];

	// Pattern matching based on node type
	let searchPattern: RegExp | string | null = null;

	switch (nodeType) {
		case 'MethodCallExpression': {
			if (nodeImage.length > EMPTY_STRING_LENGTH) {
				searchPattern = `${nodeImage}(`;
			} else {
				searchPattern = /\w+\s*\(/;
			}
			break;
		}
		case 'VariableDeclaration': {
			if (nodeImage.length > EMPTY_STRING_LENGTH) {
				searchPattern = new RegExp(`\\b${nodeImage}\\s*[=;]`);
			} else {
				searchPattern = /\w+\s+\w+\s*[=;]/;
			}
			break;
		}
		case 'BinaryExpression': {
			searchPattern = /[+\-*/=<>!&|]{1,2}/;
			break;
		}
		case 'LiteralExpression': {
			searchPattern =
				/\b\d+(\.\d+)?\b|'(?:[^'\\]|\\.)*'|"[^"]*"|\bnull\b|\btrue\b|\bfalse\b/;
			break;
		}
		case 'IfBlockStatement': {
			searchPattern = /\bif\b/;
			break;
		}
		default: {
			if (nodeImage.length > EMPTY_STRING_LENGTH) {
				searchPattern = nodeImage;
			} else {
				// Try to match node type name in lowercase
				searchPattern = nodeType.toLowerCase();
			}
			break;
		}
	}

	// TypeScript flow analysis may not recognize all code paths assign searchPattern
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	const hasNoPattern = searchPattern === null;
	if (hasNoPattern) {
		return matchingLines;
	}

	// Search for pattern in each line
	// Remove inline markers before matching to avoid false positives
	lines.forEach((line, index) => {
		const lineNumber = index + LINE_NUMBER_OFFSET;
		// Remove inline markers for pattern matching
		const lineWithoutMarkers = line
			.replace(/\/\/\s*❌/g, '')
			.replace(/\/\/\s*✅/g, '')
			.trim();
		const lowerLine = lineWithoutMarkers.toLowerCase();

		let matches = false;
		if (typeof searchPattern === 'string') {
			matches =
				lineWithoutMarkers.includes(searchPattern) ||
				lowerLine.includes(searchPattern);
		} else {
			matches =
				searchPattern.test(lineWithoutMarkers) ||
				searchPattern.test(lowerLine);
		}

		if (matches && lineWithoutMarkers.length > EMPTY_STRING_LENGTH) {
			matchingLines.push(lineNumber);
		}
	});

	return matchingLines;
}

/**
 * Empty coverage array length constant for comparisons.
 */
const EMPTY_COVERAGE_LENGTH = 0;

/**
 * Determine node color based on source code matching to example sections.
 * Traces AST node back to example content, then determines which section it belongs to.
 * @param options - Options for color determination.
 * @returns Color for the node, or undefined if no tests.
 */

/**
 * Empty markers array length constant for comparisons.
 */
const EMPTY_MARKERS_LENGTH = 0;

/**
 * Determine node color based on source code matching to example sections.
 * Traces AST node back to example content, then determines which section it belongs to.
 * @param options - Options for color determination.
 * @returns Color for the node, or undefined if no tests.
 */
function determineNodeColor(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Options object needs to be mutable for destructuring
	options: NodeColorOptions,
): 'dark-green' | 'dark-red' | 'green' | 'orange' | 'red' | undefined {
	const {
		nodeType,
		nodeImage,
		exampleContent,
		xpath,
		validMarkers,
		violationMarkers,
		previousExamplesCoverage,
		beginLine,
		xpathMatchLines,
	} = options;

	// Map each line in example to its section (violation/valid)
	const lineSectionMap = mapLinesToSections(exampleContent);

	// Find which lines in the example contain this node's source code
	let matchingLines = findLinesContainingNodeSource(
		nodeType,
		nodeImage,
		exampleContent,
	);

	// If no matches found via pattern matching, try checking if nodeImage appears
	// anywhere in valid/violation sections as a fallback
	if (matchingLines.length === EMPTY_MARKERS_LENGTH) {
		// Try simpler fallback: if Image exists, search for it in sections
		if (nodeImage.length > EMPTY_STRING_LENGTH) {
			const allLines = exampleContent.split('\n');
			for (let i = 0; i < allLines.length; i++) {
				const line =
					allLines[i]
						?.replace(/\/\/\s*❌/g, '')
						.replace(/\/\/\s*✅/g, '')
						.trim() ?? '';
				if (line.includes(nodeImage)) {
					const lineNum = i + LINE_NUMBER_OFFSET;
					matchingLines.push(lineNum);
				}
			}
		}

		// If still no matches, can't determine color
		const matchCount = matchingLines.length;
		// EMPTY_MARKERS_LENGTH is 0, so this checks if there are no matches
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		const hasNoMatches = matchCount === EMPTY_MARKERS_LENGTH;
		if (hasNoMatches) {
			return undefined;
		}
	}

	// Determine which section(s) these lines belong to
	// Count matches in each section to determine the primary section
	let violationMatchCount = 0;
	let validMatchCount = 0;

	for (const lineNum of matchingLines) {
		const section = lineSectionMap.get(lineNum);
		if (section === 'violation') {
			violationMatchCount++;
		} else if (section === 'valid') {
			validMatchCount++;
		}
	}

	const hasViolationSection = violationMatchCount > EMPTY_MARKERS_LENGTH;
	const hasValidSection = validMatchCount > EMPTY_MARKERS_LENGTH;

	// Check if this node is actually matched by the XPath expression
	// Use PMD's actual XPath evaluation results (xpathMatchLines) if available
	// When xpathMatchLines is defined (even if empty), we use it as the authoritative source
	// Only fall back to node type checking if xpathMatchLines is undefined
	let nodeMatchesXPath = false;
	if (xpath !== null && xpath.length > EMPTY_STRING_LENGTH) {
		// If we have XPath match results (defined, even if empty), use those exclusively
		if (xpathMatchLines !== undefined) {
			// We have XPath match results - check if this node is involved in a match
			// A node matches if any violation line falls within the node's line range
			if (xpathMatchLines.size > EMPTY_MARKERS_LENGTH) {
				// We have violations - check if this node is on a violation line
				// Violation lines are from the test file (which includes wrapper),
				// and AST node line numbers are also from the test file, so they should match directly
				if (beginLine !== null) {
					const { endLine } = options;
					const nodeStartLine = beginLine;
					const nodeEndLine = endLine ?? nodeStartLine;

					// Check if any violation line falls within this node's range
					for (const violationLine of xpathMatchLines) {
						if (
							violationLine >= nodeStartLine &&
							violationLine <= nodeEndLine
						) {
							nodeMatchesXPath = true;
							break;
						}
					}
				} else {
					// Node has no line number after traversing up the tree
					// Fallback: if node type matches XPath and we have violations,
					// and for MethodCallExpression, the FullMethodName matches XPath constraints,
					// then consider it a match (nodes without line numbers but matching XPath conditions)
					const xpathNodeTypes = extractNodeTypes(xpath);
					if (xpathNodeTypes.includes(nodeType)) {
						// Node type matches XPath - for MethodCallExpression, also verify FullMethodName
						if (nodeType === 'MethodCallExpression') {
							const fullMethodNameMatches = xpath.matchAll(
								/@FullMethodName\s*=\s*['"]([^'"]+)['"]/g,
							);
							const expectedMethodNames = new Set<string>();
							const FIRST_CAPTURE_GROUP = 1;
							for (const match of fullMethodNameMatches) {
								const methodName = match[FIRST_CAPTURE_GROUP];
								if (methodName !== undefined) {
									expectedMethodNames.add(methodName);
								}
							}
							// If XPath has FullMethodName constraints, node must match
							if (
								expectedMethodNames.size > EMPTY_MARKERS_LENGTH
							) {
								const nodeFullMethodName =
									options.fullMethodName;
								if (
									nodeFullMethodName !== undefined &&
									expectedMethodNames.has(nodeFullMethodName)
								) {
									nodeMatchesXPath = true;
								}
							} else {
								// No FullMethodName constraints - any MethodCallExpression matches
								nodeMatchesXPath = true;
							}
						} else {
							// Non-MethodCallExpression node type matches XPath
							nodeMatchesXPath = true;
						}
					}
				}
			} else {
				// xpathMatchLines is defined but empty (no violations) - don't color anything
				return undefined;
			}

			// If node is on a violation line, also verify it matches XPath conditions
			// For MethodCallExpression, check if the FullMethodName matches what XPath expects
			if (nodeMatchesXPath && nodeType === 'MethodCallExpression') {
				// Extract FullMethodName values from XPath (e.g., 'Pattern.compile', 'Pattern.matches')
				const fullMethodNameMatches = xpath.matchAll(
					/@FullMethodName\s*=\s*['"]([^'"]+)['"]/g,
				);
				const expectedMethodNames = new Set<string>();
				const FIRST_CAPTURE_GROUP = 1;
				for (const match of fullMethodNameMatches) {
					const methodName = match[FIRST_CAPTURE_GROUP];
					if (methodName !== undefined) {
						expectedMethodNames.add(methodName);
					}
				}

				// Check if this node's FullMethodName matches any expected method name
				if (expectedMethodNames.size > EMPTY_MARKERS_LENGTH) {
					// We have FullMethodName constraints in XPath - check if node's FullMethodName matches
					const nodeFullMethodName = options.fullMethodName;
					// Only reject if we have a FullMethodName and it doesn't match
					// If FullMethodName is undefined, we can't verify, so allow it (might be a child node)
					if (
						nodeFullMethodName !== undefined &&
						!expectedMethodNames.has(nodeFullMethodName)
					) {
						// Node's FullMethodName doesn't match any expected method name
						nodeMatchesXPath = false;
					}
				}
				// If no FullMethodName constraints in XPath, any MethodCallExpression on violation line matches
			}

			// If xpathMatchLines is empty (no violations) or node doesn't match, don't color
			// This ensures we only color nodes that PMD actually found violations on
			if (!nodeMatchesXPath) {
				return undefined;
			}
		} else {
			// Fallback: xpathMatchLines is undefined - use node type checking
			// This happens when XPath is null/empty or PMD execution failed
			const xpathNodeTypes = extractNodeTypes(xpath);
			nodeMatchesXPath = xpathNodeTypes.includes(nodeType);
			if (!nodeMatchesXPath) {
				// Node type is not matched by XPath, so it shouldn't be tested
				return undefined;
			}
		}
	}

	// Check if this node tests XPath branches that were already tested by previous examples
	// We need to check if the EXACT same XPath branch combination was tested, not just
	// if the node type was tested. This means checking if code with the same attributes
	// (like FullMethodName for MethodCallExpression) was tested in previous examples.
	let alreadyCovered = false;

	if (
		xpath !== null &&
		previousExamplesCoverage !== undefined &&
		previousExamplesCoverage.length > EMPTY_COVERAGE_LENGTH
	) {
		// Check if this node type appears in the XPath
		const nodeTypeInXPath = xpath.includes(nodeType);

		if (nodeTypeInXPath) {
			// Check if the exact same XPath branch combination was tested
			// This means: same node type, same attributes (like method name), AND same section type
			// For MethodCallExpression, we check the exact method name
			// We also need to check if it was tested in the same section (violation vs valid)
			const isInViolationSection = hasViolationSection;
			const isInValidSection = hasValidSection;

			if (
				nodeType === 'MethodCallExpression' &&
				nodeImage.length > EMPTY_STRING_LENGTH
			) {
				// Check if previous examples tested code that would produce this exact method call
				// in the same section type (violation or valid)
				for (const prevExampleCoverage of previousExamplesCoverage) {
					const prevExampleContent =
						prevExampleCoverage.exampleContent;
					const prevExampleLines = prevExampleContent.split('\n');
					const prevLineSectionMap =
						mapLinesToSections(prevExampleContent);

					// Check violation markers if current node is in violation section
					if (isInViolationSection) {
						for (const marker of prevExampleCoverage.violationMarkers) {
							const markerLineIndex =
								marker.lineNumber - LINE_NUMBER_OFFSET;
							if (
								markerLineIndex >= MIN_ARRAY_INDEX &&
								markerLineIndex < prevExampleLines.length
							) {
								const markerLine =
									prevExampleLines[markerLineIndex]
										?.replace(/\/\/\s*❌/g, '')
										.replace(/\/\/\s*✅/g, '')
										.trim() ?? '';

								// Check if this marker line contains the exact same method call
								// and is in a violation section
								const markerSection = prevLineSectionMap.get(
									marker.lineNumber,
								);
								if (
									markerSection === 'violation' &&
									markerLine.includes(`${nodeImage}(`)
								) {
									alreadyCovered = true;
									break;
								}
							}
						}
					}

					// Check valid markers if current node is in valid section
					if (!alreadyCovered && isInValidSection) {
						for (const marker of prevExampleCoverage.validMarkers) {
							const markerLineIndex =
								marker.lineNumber - LINE_NUMBER_OFFSET;
							if (
								markerLineIndex >= MIN_ARRAY_INDEX &&
								markerLineIndex < prevExampleLines.length
							) {
								const markerLine =
									prevExampleLines[markerLineIndex]
										?.replace(/\/\/\s*❌/g, '')
										.replace(/\/\/\s*✅/g, '')
										.trim() ?? '';

								// Check if this marker line contains the exact same method call
								// and is in a valid section
								const markerSection = prevLineSectionMap.get(
									marker.lineNumber,
								);
								if (
									markerSection === 'valid' &&
									markerLine.includes(`${nodeImage}(`)
								) {
									alreadyCovered = true;
									break;
								}
							}
						}
					}

					if (alreadyCovered) {
						break;
					}
				}
			} else {
				// For other node types, check if the same node type was tested in the same section
				// This is less precise than MethodCallExpression (which checks exact method name)
				// but still ensures we check the section type for branch combination accuracy
				for (const prevExampleCoverage of previousExamplesCoverage) {
					const prevExampleContent =
						prevExampleCoverage.exampleContent;
					const prevExampleLines = prevExampleContent.split('\n');
					const prevLineSectionMap =
						mapLinesToSections(prevExampleContent);

					// Check violation markers if current node is in violation section
					if (isInViolationSection) {
						for (const marker of prevExampleCoverage.violationMarkers) {
							const markerLineIndex =
								marker.lineNumber - LINE_NUMBER_OFFSET;
							if (
								markerLineIndex >= MIN_ARRAY_INDEX &&
								markerLineIndex < prevExampleLines.length
							) {
								const markerLine =
									prevExampleLines[markerLineIndex]
										?.replace(/\/\/\s*❌/g, '')
										.replace(/\/\/\s*✅/g, '')
										.trim() ?? '';

								const markerSection = prevLineSectionMap.get(
									marker.lineNumber,
								);
								if (markerSection !== 'violation') {
									continue;
								}

								// Check if this marker line would produce a node of the same type
								let wouldMatch = false;

								switch (nodeType) {
									case 'VariableDeclaration': {
										if (
											nodeImage.length >
											EMPTY_STRING_LENGTH
										) {
											wouldMatch = new RegExp(
												`\\b${nodeImage}\\s*[=;]`,
											).test(markerLine);
										} else {
											wouldMatch =
												/\w+\s+\w+\s*[=;]/.test(
													markerLine,
												);
										}
										break;
									}
									case 'BinaryExpression': {
										wouldMatch = /[+\-*/=<>!&|]{1,2}/.test(
											markerLine,
										);
										break;
									}
									case 'LiteralExpression': {
										wouldMatch =
											/\b\d+(\.\d+)?\b|'(?:[^'\\]|\\.)*'|"[^"]*"|\bnull\b|\btrue\b|\bfalse\b/.test(
												markerLine.toLowerCase(),
											);
										break;
									}
									case 'IfBlockStatement': {
										wouldMatch = /\bif\b/.test(
											markerLine.toLowerCase(),
										);
										break;
									}
									default: {
										if (
											nodeImage.length >
											EMPTY_STRING_LENGTH
										) {
											wouldMatch =
												markerLine.includes(nodeImage);
										} else {
											wouldMatch = markerLine
												.toLowerCase()
												.includes(
													nodeType.toLowerCase(),
												);
										}
										break;
									}
								}

								if (
									wouldMatch &&
									markerLine.length > EMPTY_STRING_LENGTH
								) {
									alreadyCovered = true;
									break;
								}
							}
						}
					}

					// Check valid markers if current node is in valid section
					if (!alreadyCovered && isInValidSection) {
						for (const marker of prevExampleCoverage.validMarkers) {
							const markerLineIndex =
								marker.lineNumber - LINE_NUMBER_OFFSET;
							if (
								markerLineIndex >= MIN_ARRAY_INDEX &&
								markerLineIndex < prevExampleLines.length
							) {
								const markerLine =
									prevExampleLines[markerLineIndex]
										?.replace(/\/\/\s*❌/g, '')
										.replace(/\/\/\s*✅/g, '')
										.trim() ?? '';

								const markerSection = prevLineSectionMap.get(
									marker.lineNumber,
								);
								if (markerSection !== 'valid') {
									continue;
								}

								// Check if this marker line would produce a node of the same type
								let wouldMatch = false;

								switch (nodeType) {
									case 'VariableDeclaration': {
										if (
											nodeImage.length >
											EMPTY_STRING_LENGTH
										) {
											wouldMatch = new RegExp(
												`\\b${nodeImage}\\s*[=;]`,
											).test(markerLine);
										} else {
											wouldMatch =
												/\w+\s+\w+\s*[=;]/.test(
													markerLine,
												);
										}
										break;
									}
									case 'BinaryExpression': {
										wouldMatch = /[+\-*/=<>!&|]{1,2}/.test(
											markerLine,
										);
										break;
									}
									case 'LiteralExpression': {
										wouldMatch =
											/\b\d+(\.\d+)?\b|'(?:[^'\\]|\\.)*'|"[^"]*"|\bnull\b|\btrue\b|\bfalse\b/.test(
												markerLine.toLowerCase(),
											);
										break;
									}
									case 'IfBlockStatement': {
										wouldMatch = /\bif\b/.test(
											markerLine.toLowerCase(),
										);
										break;
									}
									default: {
										if (
											nodeImage.length >
											EMPTY_STRING_LENGTH
										) {
											wouldMatch =
												markerLine.includes(nodeImage);
										} else {
											wouldMatch = markerLine
												.toLowerCase()
												.includes(
													nodeType.toLowerCase(),
												);
										}
										break;
									}
								}

								if (
									wouldMatch &&
									markerLine.length > EMPTY_STRING_LENGTH
								) {
									alreadyCovered = true;
									break;
								}
							}
						}
					}

					if (alreadyCovered) {
						break;
					}
				}
			}
		}
	}

	// Color based on section type
	// If we have XPath match results, only color nodes that match the XPath
	// The color is determined by which section the node is in (violation = red, valid = green)
	if (
		xpathMatchLines !== undefined &&
		xpathMatchLines.size > EMPTY_MARKERS_LENGTH
	) {
		// We have XPath match results - only color nodes that actually match
		if (!nodeMatchesXPath) {
			// Node doesn't match XPath - don't color it
			return undefined;
		}

		// Node matches XPath - color based on section type
		// If in violation section, it should trigger (red)
		// If in valid section, it shouldn't trigger (green) - but if it matches XPath, that's a problem
		// If node matches XPath, color it even if there are no explicit markers
		// (PMD found a violation, so we should show it)
		if (hasViolationSection) {
			return alreadyCovered ? 'dark-red' : 'red';
		}
		if (hasValidSection) {
			// Node matches XPath but is in valid section - this indicates the rule incorrectly triggers
			// Color it green to show it's valid code, or orange to show the mismatch
			return alreadyCovered ? 'dark-green' : 'green';
		}
		// Node matches XPath but no clear section - still color it red since PMD found a violation
		return alreadyCovered ? 'dark-red' : 'red';
	}

	// Fallback: no XPath match results - use section-based coloring
	// If node matches both sections, show orange to indicate ambiguity
	// Note: We check marker existence to ensure there are actual tests defined
	if (hasViolationSection && hasValidSection) {
		// Node matches both sections - show orange to indicate ambiguity
		if (
			violationMarkers.length > EMPTY_MARKERS_LENGTH &&
			validMarkers.length > EMPTY_MARKERS_LENGTH
		) {
			return 'orange';
		}
		// If only one type of marker exists, use that color
		if (violationMarkers.length > EMPTY_MARKERS_LENGTH) {
			return alreadyCovered ? 'dark-red' : 'red';
		}
		if (validMarkers.length > EMPTY_MARKERS_LENGTH) {
			return alreadyCovered ? 'dark-green' : 'green';
		}
	} else if (
		hasViolationSection &&
		violationMarkers.length > EMPTY_MARKERS_LENGTH
	) {
		return alreadyCovered ? 'dark-red' : 'red';
	} else if (hasValidSection && validMarkers.length > EMPTY_MARKERS_LENGTH) {
		return alreadyCovered ? 'dark-green' : 'green';
	}

	// If node is in a section but no markers exist, don't color (no tests defined)
	return undefined;
}

/**
 * Options for converting XML node to tree node.
 */
interface XmlNodeToTreeNodeOptions {
	node: Element;
	xpath: string | null;
	previousExamplesCoverage?: readonly {
		validMarkers: readonly { lineNumber: number }[];
		violationMarkers: readonly { lineNumber: number }[];
		exampleContent: string;
	}[];
	validMarkers: readonly { lineNumber: number }[];
	violationMarkers: readonly { lineNumber: number }[];
	wrapperInfo?:
		| Readonly<{
				addedWrapperClass: boolean;
				wrapperClassName: string;
				addedWrapperMethod: boolean;
				wrapperMethodName: string;
				helperMethodNames: readonly string[];
		  }>
		| undefined;
	exampleContent: Readonly<string>;

	/**
	 * Set of line numbers in the test file that match the XPath (from PMD violations).
	 */
	xpathMatchLines?: ReadonlySet<number>;

	/**
	 * FullMethodName attribute for MethodCallExpression nodes (e.g., 'Pattern.compile', 'input.replaceFirst').
	 */
	fullMethodName?: string;
}

/**
 * Convert XML node to tree structure for stringify-tree.
 * @param options - Options for tree node conversion.
 * @param options.node - XML DOM node.
 * @param options.previousExamplesCoverage - Coverage data from previous examples.
 * @param options.validMarkers - Valid test markers from example.
 * @param options.violationMarkers - Violation test markers from example.
 * @param options.exampleContent - Original example content for pattern matching.
 * @returns Tree node with name, children, and color.
 */
function xmlNodeToTreeNode(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Options object needs to be mutable for destructuring
	options: XmlNodeToTreeNodeOptions,
): TreeNode {
	const {
		exampleContent,
		node,
		previousExamplesCoverage,
		validMarkers,
		violationMarkers,
		xpath,
		xpathMatchLines,
		wrapperInfo,
	} = options;
	const EQUALS_SEPARATOR = '=';
	const QUOTE_CHAR = "'";
	const EMPTY_STRING = '';
	const FALSE_VALUE = 'false';
	const EMPTY_ARRAY_VALUE = '[]';

	const { nodeName } = node;

	/**
	 * Extract BeginLine and EndLine for color determination.
	 * If the node doesn't have line numbers, traverse up to parent nodes to find them.
	 * PMD uses lowercase attribute names (beginline, endline) in violation XML,
	 * but may use PascalCase (BeginLine, EndLine) in AST XML.
	 * @param currentNode - Current XML node to check for line numbers.
	 * @returns Object with beginLine and endLine, or nulls if not found.
	 */
	function findLineNumbers(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Element is DOM type, needs to be mutable
		currentNode: Element,
	): {
		beginLine: number | null;
		endLine: number | null;
	} {
		let nodeToCheck: Element | null = currentNode;
		while (nodeToCheck !== null) {
			let beginLineAttr =
				nodeToCheck.getAttribute('BeginLine') ??
				nodeToCheck.getAttribute('beginline');
			let endLineAttr =
				nodeToCheck.getAttribute('EndLine') ??
				nodeToCheck.getAttribute('endline');

			// Return line numbers if we have at least BeginLine (EndLine is optional)
			// This handles cases where nodes only have BeginLine but not EndLine
			if (
				beginLineAttr !== null &&
				beginLineAttr.length > EMPTY_STRING.length
			) {
				return {
					beginLine: parseInt(beginLineAttr, PARSE_INT_RADIX),
					endLine:
						endLineAttr !== null &&
						endLineAttr.length > EMPTY_STRING.length
							? parseInt(endLineAttr, PARSE_INT_RADIX)
							: null,
				};
			}

			// Move to parent node
			const parentNode: Node | null = nodeToCheck.parentNode;
			if (
				parentNode !== null &&
				parentNode.nodeType === NODE_TYPE_ELEMENT
			) {
				// Type assertion is safe because we check nodeType first
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Type assertion is safe after nodeType check
				nodeToCheck = parentNode as Element;
			} else {
				nodeToCheck = null;
			}
		}

		return { beginLine: null, endLine: null };
	}

	const { beginLine, endLine } = findLineNumbers(node);

	// Extract Image attribute for source code matching (before filtering attributes)
	const IMAGE_ATTR = 'Image';
	const nodeImage = node.getAttribute(IMAGE_ATTR) ?? '';

	// Extract FullMethodName for MethodCallExpression nodes (for XPath matching)
	const FULL_METHOD_NAME_ATTR = 'FullMethodName';
	const fullMethodName =
		node.getAttribute(FULL_METHOD_NAME_ATTR) ?? undefined;

	// Get all attributes and format them, omitting empty or 'false' values
	const attributes: string[] = [];
	// xmldom doesn't have getAttributeNames, so we need to iterate through attributes
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- attributes can be null
	if (node.attributes !== null) {
		for (const attr of Array.from(node.attributes)) {
			const { name: attrName, value: attrValue } = attr;
			const REALLOC_ATTR = 'RealLoc';
			// Omit attributes with empty or 'false' values, and RealLoc
			if (
				attrName !== REALLOC_ATTR &&
				attrValue !== EMPTY_STRING &&
				attrValue !== FALSE_VALUE &&
				attrValue !== EMPTY_ARRAY_VALUE
			) {
				attributes.push(
					`${attrName}${EQUALS_SEPARATOR}${QUOTE_CHAR}${attrValue}${QUOTE_CHAR}`,
				);
			}
		}
	}

	// Format node name: NodeName(attr1='value1', attr2='value2')
	let displayName = nodeName;
	if (attributes.length > EMPTY_ARRAY_LENGTH) {
		displayName += `(${attributes.join(', ')})`;
	}

	// Get children
	const children = Array.from(node.childNodes).filter(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
		(child): child is Element => child.nodeType === NODE_TYPE_ELEMENT,
	);

	// Determine node color based on source code matching to example sections
	const color = determineNodeColor({
		beginLine,
		endLine,
		exampleContent,
		fullMethodName,
		nodeImage,
		nodeType: nodeName,
		previousExamplesCoverage,
		validMarkers,
		violationMarkers,
		wrapperInfo,
		xpath: xpath ?? null,
		xpathMatchLines,
	});

	return {
		children: children.map(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for map
			(child) => {
				// Extract FullMethodName for child MethodCallExpression nodes
				const childFullMethodName =
					child.nodeName === 'MethodCallExpression'
						? (child.getAttribute(FULL_METHOD_NAME_ATTR) ??
							undefined)
						: undefined;
				return xmlNodeToTreeNode({
					exampleContent,
					fullMethodName: childFullMethodName,
					node: child,
					previousExamplesCoverage,
					validMarkers,
					violationMarkers,
					wrapperInfo,
					xpath: xpath ?? null,
					xpathMatchLines,
				});
			},
		),
		color,
		name: displayName,
	};
}

/**
 * Apply ANSI color codes to node name based on color.
 * @param nodeName - Node name to colorize.
 * @param color - Color to apply (green, dark-green, red, dark-red, or orange).
 * @returns Colored node name string with ANSI escape codes.
 */
function applyColorToNodeName(
	nodeName: string,
	color: 'dark-green' | 'dark-red' | 'green' | 'orange' | 'red' | undefined,
): string {
	if (color === undefined) {
		return nodeName;
	}

	// Use raw ANSI codes to ensure colors always work
	const ANSI_RESET = '\x1b[0m';
	const ANSI_GREEN = '\x1b[32m';
	const ANSI_DARK_GREEN = '\x1b[32;2m';
	const ANSI_RED = '\x1b[31m';
	const ANSI_DARK_RED = '\x1b[31;2m';
	const ANSI_ORANGE = '\x1b[33m';

	if (color === 'green') {
		return `${ANSI_GREEN}${nodeName}${ANSI_RESET}`;
	}

	if (color === 'dark-green') {
		return `${ANSI_DARK_GREEN}${nodeName}${ANSI_RESET}`;
	}

	if (color === 'red') {
		return `${ANSI_RED}${nodeName}${ANSI_RESET}`;
	}

	if (color === 'dark-red') {
		return `${ANSI_DARK_RED}${nodeName}${ANSI_RESET}`;
	}

	// color === 'orange'
	return `${ANSI_ORANGE}${nodeName}${ANSI_RESET}`;
}

/**
 * Parse XML AST dump and remove wrapper elements, then render as tree with all attributes.
 * Removes ONLY the wrapper elements added by createTestFile based on tracking info.
 * @param options - Options for parsing XML AST.
 * @returns Tree text format XML with wrappers removed, showing all attributes with colors.
 */
function parseXmlAstAndStripWrappers(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Options object needs to be mutable for destructuring
	options: ParseXmlAstOptions,
): string {
	const {
		exampleIndex,
		exampleContent,
		xpath,
		previousExamplesCoverage,
		validMarkers,
		violationMarkers,
		wrapperInfo,
		xmlAstOutput,
		xpathMatchLines,
	} = options;
	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlAstOutput, 'text/xml');

	// Remove wrapper elements and helper methods from the DOM using tracking info
	removeWrappersFromXmlDom(doc, exampleIndex, wrapperInfo);

	// Find ApexFile root node and rename it to Example with Number attribute
	const apexFiles = doc.getElementsByTagName('ApexFile');
	if (apexFiles.length === EMPTY_ARRAY_LENGTH) {
		return '';
	}

	const apexFile = apexFiles[SINGLE_ELEMENT_INDEX];
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Array access can return undefined
	if (apexFile === null || apexFile === undefined) {
		return '';
	}

	// Rename ApexFile to Example and add Number attribute
	// Create a new Example element
	const exampleNode = doc.createElement('Example');
	exampleNode.setAttribute('Number', String(exampleIndex));

	// Copy all attributes from ApexFile (except DefiningType which was already removed)
	const apexFileElement = apexFile;
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- attributes can be null
	if (apexFileElement.attributes !== null) {
		for (const attr of Array.from(apexFileElement.attributes)) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Array.from can return null/undefined elements
			if (attr !== null) {
				const attrName = attr.name;
				const attrValue = attr.value;
				// Skip DefiningType as it was already removed
				if (attrName !== 'DefiningType') {
					exampleNode.setAttribute(attrName, attrValue);
				}
			}
		}
	}

	// Move all children from ApexFile to Example
	const children = Array.from(apexFileElement.childNodes);
	for (const child of children) {
		exampleNode.appendChild(child);
	}

	// Replace ApexFile with Example in the document
	const parent = apexFileElement.parentNode;
	if (parent !== null) {
		parent.replaceChild(exampleNode, apexFileElement);
	}

	// Convert XML node to tree structure with color information
	const treeNode = xmlNodeToTreeNode({
		exampleContent,
		node: exampleNode,
		previousExamplesCoverage,
		validMarkers,
		violationMarkers,
		wrapperInfo,
		xpath,
		xpathMatchLines,
	});

	// Use stringify-tree to render the tree with 2 space indent
	const treeOutput = stringifyTree(
		treeNode,
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for stringify-tree
		(node) => applyColorToNodeName(node.name, node.color),
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for stringify-tree
		(node) => node.children,
	);

	// Replace the root character (┬) with nothing for root level
	return treeOutput.replace(/^┬ /, '').replace(/^─ /, '');
}

/**
 * Run diagnostics mode: extract example, create test file, run PMD AST dump.
 * @param ruleFilePath - Path to the XML rule file.
 * @param exampleIndex - 1-based example index to dump.
 * @returns Promise that resolves when diagnostics are complete.
 */
async function runDiagnostics(
	ruleFilePath: Readonly<string>,
	exampleIndex: Readonly<number>,
): Promise<void> {
	try {
		const tester = new RuleTester(ruleFilePath);
		const examples = tester.extractExamples();

		if (examples.length === MIN_EXAMPLES_LENGTH) {
			console.error(`❌ No examples found in rule file: ${ruleFilePath}`);
			process.exit(EXIT_CODE_ERROR);
		}

		if (exampleIndex > examples.length) {
			console.error(
				`❌ Example index ${String(exampleIndex)} is out of range. Rule file has ${String(examples.length)} example(s).`,
			);
			process.exit(EXIT_CODE_ERROR);
		}

		const example = examples[exampleIndex - EXAMPLE_INDEX_OFFSET];
		if (example === undefined) {
			console.error(`❌ Example ${String(exampleIndex)} not found`);
			process.exit(EXIT_CODE_ERROR);
		}

		// Get XPath from rule metadata
		const ruleMetadata = tester.getRuleMetadata();
		const xpath = ruleMetadata.xpath ?? null;

		// Get coverage data from previous examples (examples before current index)
		const SLICE_START_INDEX = 0;
		const previousExamplesCoverage = examples
			.slice(SLICE_START_INDEX, exampleIndex - EXAMPLE_INDEX_OFFSET)
			.map(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for map
				(prevExample) => ({
					exampleContent: prevExample.content,
					validMarkers: prevExample.validMarkers,
					violationMarkers: prevExample.violationMarkers,
				}),
			);

		// Create test file for the example
		const testFileResult = createTestFile({
			exampleContent: example.content,
			exampleIndex,
			includeValids: true,
			includeViolations: true,
		});

		// Run PMD with the rule to get actual XPath matches (violations)
		// This tells us which lines in the test file match the XPath
		let xpathMatchLines: Set<number> | undefined = undefined;
		if (xpath !== null && xpath.length > EMPTY_STRING_LENGTH) {
			const pmdResult = await runPMD(
				testFileResult.filePath,
				ruleFilePath,
			);
			if (pmdResult.success && pmdResult.data) {
				const violationLines = pmdResult.data.violations.map(
					(v: Readonly<{ line: number }>) => v.line,
				);
				// Only create the set if there are violations
				// If empty, leave as undefined to fall back to node type checking
				if (violationLines.length > EMPTY_MARKERS_LENGTH) {
					xpathMatchLines = new Set(violationLines);
				}
			}
		}

		// Run PMD AST dump
		const astResult = await runPmdAstDump(
			testFileResult.filePath,
			ruleFilePath,
		);

		if (!astResult.success) {
			console.error(
				`❌ Failed to generate AST dump: ${astResult.error ?? 'Unknown error'}`,
			);
			console.error(
				`\n⚠️  The generated test file might have syntax errors. File path: ${testFileResult.filePath}`,
			);
			console.error(
				'\n💡 This might be caused by invalid example code or issues with wrapper generation.',
			);
			console.error(
				'   The test file has been preserved for debugging purposes.',
			);

			// Print the generated file content for debugging
			try {
				const { readFileSync } = await import('fs');
				const generatedContent = readFileSync(
					testFileResult.filePath,
					'utf-8',
				);
				console.error('\n📄 Generated test file content:');
				console.error('---');
				console.error(generatedContent);
				console.error('---');
			} catch {
				// Ignore errors reading the file
			}

			process.exit(EXIT_CODE_ERROR);
		}

		// Parse XML AST and strip wrappers, then render as tree with all attributes
		const rawXmlAst = astResult.data ?? '';
		const { wrapperInfo } = testFileResult;

		const cleanedAst = parseXmlAstAndStripWrappers({
			exampleContent: example.content,
			exampleIndex,
			previousExamplesCoverage,
			validMarkers: example.validMarkers,
			violationMarkers: example.violationMarkers,
			wrapperInfo,
			xmlAstOutput: rawXmlAst,
			xpath,
			xpathMatchLines,
		});

		// Print cleaned AST dump to stdout
		console.log(
			`# AST Dump for Example ${String(exampleIndex)} from ${ruleFilePath}\n`,
		);
		console.log(cleanedAst);

		// Cleanup
		tester.cleanup();
		process.exit(EXIT_CODE_SUCCESS);
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		console.error(`❌ Error running diagnostics: ${errorMessage}`);
		process.exit(EXIT_CODE_ERROR);
	}
}

/**
 * Test a single rule file.
 * @param ruleFilePath - Path to the XML rule file.
 * @param coverageTracker - Coverage tracker for this file (if coverage is enabled).
 * @param maxConcurrency - Maximum concurrency for example testing.
 * @returns Promise resolving to test result and coverage data.
 */
async function testRuleFile(
	ruleFilePath: Readonly<string>,
	coverageTracker: Readonly<CoverageTracker | null>,
	maxConcurrency: Readonly<number>,
): Promise<{
	filePath: string;
	success: boolean;
	error?: string;
	coverageData?: Readonly<CoverageData>;
}> {
	try {
		const tester = new RuleTester(ruleFilePath);
		const result = await tester.runCoverageTest(false, maxConcurrency);

		// Record coverage data if tracker is provided
		if (coverageTracker && result.xpathCoverage.coveredLineNumbers) {
			for (const lineNumber of result.xpathCoverage.coveredLineNumbers) {
				coverageTracker.recordXPathLine(lineNumber);
			}
		}

		// Display results for this file
		console.log(
			`\n🧪 Testing rule: ${ruleFilePath}${coverageTracker ? ' (with coverage)' : ''}\n`,
		);

		// Display detailed test results
		const MIN_DETAILED_RESULTS_COUNT = 0;
		if (
			result.detailedTestResults &&
			result.detailedTestResults.length > MIN_DETAILED_RESULTS_COUNT
		) {
			console.log('📋 Test Details:');

			const forbiddenExampleIndices = new Set<number>();

			// Surface forbidden method name failures as primary test failures
			if (
				result.qualityChecks &&
				result.qualityChecks.issues.length > MIN_DETAILED_RESULTS_COUNT
			) {
				const FORBIDDEN_METHOD_MESSAGE =
					"You can't call a method testMethod in examples";
				const forbiddenMethodIssues =
					result.qualityChecks.issues.filter((issue) =>
						issue.includes(FORBIDDEN_METHOD_MESSAGE),
					);
				for (const issue of forbiddenMethodIssues) {
					console.log(`   - ${issue} ❌`);

					// Extract example index from message: "... Example N: ..."
					const exampleMatch = /Example\s+(\d+):/.exec(issue);
					const FIRST_CAPTURE_GROUP = 1;
					const exampleIndexString =
						exampleMatch?.[FIRST_CAPTURE_GROUP];
					if (exampleIndexString !== undefined) {
						const exampleIndex = Number.parseInt(
							exampleIndexString,
							PARSE_INT_RADIX,
						);
						if (!Number.isNaN(exampleIndex)) {
							forbiddenExampleIndices.add(exampleIndex);
						}
					}
				}
			}

			for (const testResult of result.detailedTestResults) {
				// Skip further checks for examples that violated the testMethod rule
				if (forbiddenExampleIndices.has(testResult.exampleIndex)) {
					continue;
				}

				const status = testResult.passed ? '✅' : '❌';
				const lineNumber =
					testResult.lineNumber !== undefined
						? String(testResult.lineNumber)
						: '?';
				const message =
					testResult.testType === 'violation'
						? testResult.passed
							? 'Violation triggered'
							: 'Violation not triggered'
						: testResult.passed
							? 'Valid not triggered'
							: 'Valid triggered';
				console.log(
					`   - Line: ${lineNumber}, Example ${String(testResult.exampleIndex)}: ${message} ${status}`,
				);
			}
		}

		// Display summary
		const MIN_COUNT = 0;
		const INDEX_OFFSET = 1;

		// Show overall success
		if (result.success) {
			console.log('\n📊 Test Summary:');
			console.log(`  Examples tested: ${String(result.examplesTested)}`);
			console.log(`  Examples passed: ${String(result.examplesPassed)}`);
			console.log(
				`  Total violations: ${String(result.totalViolations)}`,
			);
			console.log(
				`  Rule triggers violations: ${result.ruleTriggersViolations ? '✅ Yes' : '❌ No'}`,
			);
		}

		// Quality Checks
		if (result.qualityChecks) {
			console.log('\n⭐ Quality Checks:');
			if (result.qualityChecks.passed) {
				console.log('  Status: ✅ Passed');
			} else {
				console.log('  Status: ⚠️ Incomplete');
				// Sort issues by line number, then by message
				const FORBIDDEN_METHOD_MESSAGE =
					"You can't call a method testMethod in examples";
				const sortedIssues = result.qualityChecks.issues
					// Exclude forbidden method name failures from Quality Checks output;
					// they are shown under Test Details instead.
					.filter(
						(issue) => !issue.includes(FORBIDDEN_METHOD_MESSAGE),
					)
					.sort((a: string, b: string) => {
						// Extract line numbers from "Line X: ..." format
						const lineMatchA = /^Line\s+(\d+):/.exec(a);
						const lineMatchB = /^Line\s+(\d+):/.exec(b);
						const lineNumberA =
							lineMatchA?.[LINE_NUMBER_MATCH_GROUP_INDEX];
						const lineNumberB =
							lineMatchB?.[LINE_NUMBER_MATCH_GROUP_INDEX];
						const lineNumA = lineMatchA
							? Number.parseInt(
									lineNumberA ?? '',
									PARSE_INT_RADIX,
								)
							: Number.MAX_SAFE_INTEGER;
						const lineNumB = lineMatchB
							? Number.parseInt(
									lineNumberB ?? '',
									PARSE_INT_RADIX,
								)
							: Number.MAX_SAFE_INTEGER;

						// Sort by line number first
						if (lineNumA !== lineNumB) {
							return lineNumA - lineNumB;
						}

						// If same line number (or both have no line), sort by message
						return a.localeCompare(b);
					});
				for (const issue of sortedIssues) {
					console.log(`  - ${issue}`);
				}
			}
		}

		// XPath Coverage Details
		console.log('\n🔍 XPath Coverage:');
		if (result.xpathCoverage.overallSuccess) {
			console.log('  Status: ✅ Complete');
		} else {
			console.log('  Status: ⚠️ Incomplete');
		}

		if (result.xpathCoverage.coverage.length > MIN_COUNT) {
			console.log(
				`  Coverage items: ${String(result.xpathCoverage.coverage.length)}`,
			);
			result.xpathCoverage.coverage.forEach(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
				(coverage, index) => {
					const itemNumber = index + INDEX_OFFSET;
					// Determine status icon: ✅ for complete, ⚠️ for incomplete, ❌ for failed
					const status: string = coverage.success
						? '✅'
						: coverage.evidence.some(
									// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for some
									(evidence) =>
										evidence.count > MIN_COUNT &&
										evidence.count < evidence.required,
							  )
							? '⚠️'
							: '❌';
					console.log(
						`    ${String(itemNumber)}. ${status} ${coverage.message}`,
					);
					if (coverage.evidence.length > MIN_COUNT) {
						coverage.evidence.forEach(
							// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
							(evidence) => {
								const { description } = evidence;
								// Only show description if it has content (not empty)
								if (description.length > MIN_COUNT) {
									// Check if description contains newlines (for conditionals, node types, etc.)
									if (description.includes('\n')) {
										// Split by newline and indent each line
										description
											.split('\n')
											.forEach(
												(line: Readonly<string>) => {
													console.log(
														`         ${line}`,
													);
												},
											);
									} else {
										console.log(`         ${description}`);
									}
								}
							},
						);
					}
				},
			);
		}

		if (result.hardcodedValues.length > MIN_COUNT) {
			console.log(
				`\n⚠️  Hardcoded values found: ${String(result.hardcodedValues.length)}`,
			);
			result.hardcodedValues.forEach(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameters for forEach
				(issue) => {
					console.log(
						`  - ${issue.type}: ${issue.value} (${issue.severity})`,
					);
				},
			);
		}

		// Determine final status based on coverage completeness
		const isCoverageIncomplete = !result.xpathCoverage.overallSuccess;
		if (result.success && !isCoverageIncomplete) {
			console.log('\n✅ All tests passed!');
		} else if (isCoverageIncomplete) {
			console.log('\n❌ Tests failed, incomplete coverage');
		}

		tester.cleanup();
		const coverageData = coverageTracker
			? coverageTracker.getCoverageData()
			: undefined;
		return {
			coverageData,
			filePath: ruleFilePath,
			success: result.success,
		};
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		console.error(`\n❌ Error testing ${ruleFilePath}: ${errorMessage}`);
		return { error: errorMessage, filePath: ruleFilePath, success: false };
	}
}

/**
 * Main CLI function that processes command line arguments and executes rule testing.
 * @returns Promise that resolves when testing is complete.
 * @throws {Error} If rule testing fails.
 */
async function main(): Promise<void> {
	const args = argv.slice(ARGV_SLICE_INDEX);
	const parsedArgs = parseCliArgs(args);

	// Handle help flag
	if (parsedArgs.help) {
		printUsage(EXIT_CODE_SUCCESS);
		return;
	}

	// Validate path argument
	if (parsedArgs.path === null) {
		console.error('❌ Path argument is required');
		printUsage(EXIT_CODE_ERROR);
		return;
	}

	const pathArg = parsedArgs.path;

	// Validate diagnostics mode requirements
	if (parsedArgs.diag !== null) {
		if (parsedArgs.coverage) {
			console.error('❌ --coverage cannot be used with --diag');
			process.exit(EXIT_CODE_ERROR);
		}

		// Diagnostics mode requires a single file, not a directory
		if (!existsSync(pathArg)) {
			console.error(`❌ Path not found: ${pathArg}`);
			process.exit(EXIT_CODE_ERROR);
		}

		const stat = statSync(pathArg);
		if (!stat.isFile()) {
			console.error(
				'❌ --diag requires a single XML rule file, not a directory',
			);
			process.exit(EXIT_CODE_ERROR);
		}

		if (!pathArg.endsWith('.xml')) {
			console.error('❌ File must be an XML rule file (.xml)');
			process.exit(EXIT_CODE_ERROR);
		}

		// Run diagnostics and exit
		await runDiagnostics(pathArg, parsedArgs.diag);
		return;
	}

	// Validate input path
	if (!existsSync(pathArg)) {
		console.error(`❌ Path not found: ${pathArg}`);
		process.exit(EXIT_CODE_ERROR);
	}

	// Determine if path is file or directory and find XML files
	const stat = statSync(pathArg);
	const xmlFiles: string[] = [];

	if (stat.isFile()) {
		// Single file
		if (!pathArg.endsWith('.xml')) {
			console.error('❌ File must be an XML rule file (.xml)');
			process.exit(EXIT_CODE_ERROR);
		}
		xmlFiles.push(pathArg);
	} else if (stat.isDirectory()) {
		// Directory - find all XML files recursively
		xmlFiles.push(...findXmlFiles(pathArg));
		const MIN_XML_FILES_COUNT = 0;
		if (xmlFiles.length === MIN_XML_FILES_COUNT) {
			console.error(`❌ No XML files found in directory: ${pathArg}`);
			process.exit(EXIT_CODE_ERROR);
		}
	} else {
		console.error(`❌ Path is neither a file nor directory: ${pathArg}`);
		process.exit(EXIT_CODE_ERROR);
	}

	// Get CPU count for concurrency
	const cpuCount = cpus().length;
	const maxFileConcurrency = Math.min(xmlFiles.length, cpuCount);

	/**
	 * Use CPU count for example concurrency - PMD processes can handle parallel execution.
	 */
	const maxExampleConcurrency = cpuCount;

	console.log(
		`\n🚀 Processing ${String(xmlFiles.length)} rule file(s) with ${String(maxFileConcurrency)} parallel workers`,
	);
	console.log(
		`   Each file will test examples with up to ${String(maxExampleConcurrency)} parallel workers\n`,
	);

	// Create coverage trackers if coverage is enabled
	const coverageTrackers = parsedArgs.coverage
		? new Map<string, CoverageTracker>()
		: null;

	// Create tasks for each file
	interface TaskResult {
		filePath: string;
		success: boolean;
		error?: string;
		coverageData?: Readonly<CoverageData>;
	}
	const tasks: (() => Promise<TaskResult>)[] = xmlFiles.map(
		(filePath: Readonly<string>) => async (): Promise<TaskResult> => {
			const tracker = coverageTrackers
				? (coverageTrackers.get(filePath) ??
					new CoverageTracker(filePath))
				: null;
			if (tracker && coverageTrackers) {
				coverageTrackers.set(filePath, tracker);
			}
			return testRuleFile(filePath, tracker, maxExampleConcurrency);
		},
	);

	// Execute tasks with concurrency limit
	const results = await limitConcurrency(tasks, maxFileConcurrency);

	// Summarize results
	const successfulFiles = results.filter(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
		(r: Readonly<TaskResult>) => r.success,
	).length;
	const failedFiles = results.filter(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
		(r: Readonly<TaskResult>) => !r.success,
	).length;

	console.log('\n' + '='.repeat(REPEAT_CHAR_COUNT));
	console.log('🎯 OVERALL RESULTS');
	console.log('='.repeat(REPEAT_CHAR_COUNT));
	console.log(`Total files processed: ${String(xmlFiles.length)}`);
	console.log(`Successful: ${String(successfulFiles)}`);
	console.log(`Failed: ${String(failedFiles)}`);

	if (failedFiles > MIN_FAILED_FILES_COUNT) {
		console.log('\n❌ Failed files:');
		results
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			.filter((r: Readonly<TaskResult>) => !r.success)
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter
			.forEach((result: Readonly<TaskResult>) => {
				const errorMessage = result.error ?? '';
				const MIN_ERROR_LENGTH = 0;
				const errorSuffix =
					errorMessage.length > MIN_ERROR_LENGTH
						? `: ${errorMessage}`
						: '';
				console.log(`  - ${result.filePath}${errorSuffix}`);
			});
	}

	// Generate coverage report if --coverage flag is set
	if (parsedArgs.coverage && coverageTrackers) {
		const coverageData = Array.from(coverageTrackers.values()).map(
			(tracker: Readonly<CoverageTracker>) => tracker.getCoverageData(),
		);
		try {
			generateLcovReport(coverageData, 'coverage/lcov.info');
			console.log('\n📊 Coverage report generated: coverage/lcov.info');
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				`\n❌ Error generating coverage report: ${errorMessage}`,
			);
			process.exit(EXIT_CODE_ERROR);
		}
	}

	process.exit(
		failedFiles === MIN_FAILED_FILES_COUNT
			? EXIT_CODE_SUCCESS
			: EXIT_CODE_ERROR,
	);
}

if (isCliInvocation()) {
	// Handle uncaught errors
	process.on('uncaughtException', (error: Readonly<Error>) => {
		console.error(`Unexpected error: ${error.message}`);
		process.exit(EXIT_CODE_ERROR);
	});

	process.on(
		'unhandledRejection',
		(_reason: Readonly<unknown>, _promise: Readonly<Promise<unknown>>) => {
			const reasonString =
				typeof _reason === 'string'
					? _reason
					: _reason instanceof Error
						? _reason.message
						: JSON.stringify(_reason);
			const promiseString = '[Promise]';
			console.error(
				`Unhandled Rejection at: ${promiseString}, reason: ${reasonString}`,
			);
			process.exit(EXIT_CODE_ERROR);
		},
	);

	// Run main if called directly
	main().catch((error: unknown) => {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		console.error(`Unexpected error: ${errorMessage}`);
		process.exit(EXIT_CODE_ERROR);
	});
}
