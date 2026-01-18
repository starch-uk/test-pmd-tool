/**
 * @file
 * Output formatting utilities for CLI diagnostics.
 */
import { DOMParser } from '@xmldom/xmldom';
import { stringifyTree } from 'stringify-tree';
import { removeWrappersFromXmlDom } from './xmlWrapperRemoval.js';
import { applyColorToNodeName } from './nodeColorDetermination.js';
import { xmlNodeToTreeNode } from './treeNodeConversion.js';

const EMPTY_ARRAY_LENGTH = 0;
const SINGLE_ELEMENT_INDEX = 0;

/**
 * Options for parsing XML AST and stripping wrappers.
 */
export interface ParseXmlAstOptions {
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
 * Parse XML AST dump and remove wrapper elements, then render as tree with all attributes.
 * Removes ONLY the wrapper elements added by createTestFile based on tracking info.
 * @param options - Options for parsing XML AST.
 * @returns Tree text format XML with wrappers removed, showing all attributes with colors.
 */
export function parseXmlAstAndStripWrappers(
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
