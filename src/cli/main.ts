/**
 * @file
 * CLI entry point for PMD Rule Tester. Tests PMD rules using examples embedded in XML rule files.
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { extname, resolve } from 'path';
import { argv } from 'process';
import { cpus } from 'os';
import { pathToFileURL } from 'url';
import { DOMParser } from '@xmldom/xmldom';
import { stringifyTree } from 'stringify-tree';
import { RuleTester } from '../tester/RuleTester.js';
import { limitConcurrency } from '../utils/concurrency.js';
import {
	CoverageTracker,
	type CoverageData,
} from '../coverage/trackCoverage.js';
import { generateLcovReport } from '../coverage/generateLcov.js';
import { runPmdAstDump } from '../pmd/runPMD.js';
import { createTestFile } from '../parser/createTestFile.js';
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

/**
 * Determine if this module is being executed as the CLI entrypoint.
 * @returns True if the current module is the Node entry file.
 */
function isCliInvocation(): boolean {
	const [, entryPath] = argv;
	if (entryPath === undefined) {
		return false;
	}
	return import.meta.url === pathToFileURL(entryPath).href;
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
			if (definingType === wrapperClassName) {
				node.removeAttribute('DefiningType');
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

	// Remove DefiningType attribute from all nodes if it references the wrapper class
	const allNodes = doc.getElementsByTagName('*');
	for (const node of Array.from(allNodes)) {
		const definingType = node.getAttribute('DefiningType');
		if (definingType === wrapperClassName) {
			node.removeAttribute('DefiningType');
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
	name: string;
}

/**
 * Convert XML node to tree structure for stringify-tree.
 * @param node - XML DOM node.
 * @returns Tree node with name and children.
 */
function xmlNodeToTreeNode(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Element is DOM type, Readonly has no effect
	node: Element,
): TreeNode {
	const EQUALS_SEPARATOR = '=';
	const QUOTE_CHAR = "'";
	const EMPTY_STRING = '';
	const FALSE_VALUE = 'false';
	const EMPTY_ARRAY_VALUE = '[]';

	const { nodeName } = node;

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

	return {
		children: children.map(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for map
			(child) => xmlNodeToTreeNode(child),
		),
		name: displayName,
	};
}

/**
 * Parse XML AST dump and remove wrapper elements, then render as tree with all attributes.
 * Removes ONLY the wrapper elements added by createTestFile based on tracking info.
 * @param xmlAstOutput - Raw XML AST dump output from PMD.
 * @param exampleIndex - 1-based example index used for wrapper names.
 * @param wrapperInfo - Tracking information about what was added by createTestFile.
 * @returns Tree text format XML with wrappers removed, showing all attributes.
 */
function parseXmlAstAndStripWrappers(
	xmlAstOutput: Readonly<string>,
	exampleIndex: Readonly<number>,
	wrapperInfo:
		| Readonly<{
				addedWrapperClass: boolean;
				wrapperClassName: string;
				addedWrapperMethod: boolean;
				wrapperMethodName: string;
				helperMethodNames: readonly string[];
		  }>
		| undefined,
): string {
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

	// Convert XML node to tree structure
	const treeNode = xmlNodeToTreeNode(exampleNode);

	// Use stringify-tree to render the tree with 2 space indent
	const treeOutput = stringifyTree(
		treeNode,
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Callback parameter for stringify-tree
		(node) => node.name,
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

		// Create test file for the example
		const testFileResult = createTestFile({
			exampleContent: example.content,
			exampleIndex,
			includeValids: true,
			includeViolations: true,
		});

		// Run PMD AST dump
		const astResult = await runPmdAstDump(
			testFileResult.filePath,
			ruleFilePath,
		);

		if (!astResult.success) {
			console.error(
				`❌ Failed to generate AST dump: ${astResult.error ?? 'Unknown error'}`,
			);
			process.exit(EXIT_CODE_ERROR);
		}

		// Parse XML AST and strip wrappers, then render as tree with all attributes
		const rawXmlAst = astResult.data ?? '';
		const { wrapperInfo } = testFileResult;
		const cleanedAst = parseXmlAstAndStripWrappers(
			rawXmlAst,
			exampleIndex,
			wrapperInfo,
		);

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
			for (const testResult of result.detailedTestResults) {
				const status = testResult.passed ? '✅' : '❌';
				const testType =
					testResult.testType === 'violation' ? 'Violation' : 'Valid';
				const lineInfo =
					testResult.lineNumber !== undefined
						? ` Line: ${String(testResult.lineNumber)}`
						: '';
				console.log(
					`   - Example ${String(testResult.exampleIndex)} Test: ${testType} ${status}${lineInfo}`,
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
				const sortedIssues = [...result.qualityChecks.issues].sort(
					(a: string, b: string) => {
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
					},
				);
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
