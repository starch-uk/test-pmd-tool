/**
 * @file
 * Tree node conversion utilities for CLI diagnostics.
 * Converts XML DOM nodes to tree structures for stringify-tree rendering.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/prefer-readonly-parameter-types, @typescript-eslint/no-use-before-define, @typescript-eslint/no-redundant-type-constituents -- DOM manipulation requires unsafe any operations */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- readFileSync may be used in future implementations
import { readFileSync } from 'fs';
import { determineNodeColor } from './nodeColorDetermination.js';
import type { NodeColorOptions } from './nodeColorDetermination.js';

// Element type for xmldom DOM - matches the shape used in this module
// eslint-disable-next-line @typescript-eslint/no-type-alias, @typescript-eslint/no-explicit-any -- DOM Element type
type Element = any;

const PARSE_INT_RADIX = 10;
const NODE_TYPE_ELEMENT = 1;
const EMPTY_ARRAY_LENGTH = 0;
const EMPTY_STRING = '';
const NO_LINE = null;

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
 * Format node attributes into display strings, omitting empty or 'false' values.
 * @param node - XML DOM node element.
 * @returns Array of formatted attribute strings.
 */
function formatNodeAttributes(node: Element): string[] {
	const EQUALS_SEPARATOR = '=';
	const QUOTE_CHAR = "'";
	const FALSE_VALUE = 'false';
	const EMPTY_ARRAY_VALUE = '[]';
	const REALLOC_ATTR = 'RealLoc';
	const attributes: string[] = [];

	if (node.attributes !== null) {
		for (const attr of Array.from(node.attributes)) {
			const { name: attrName, value: attrValue } = attr as {
				name: string;
				value: string;
			};
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

	return attributes;
}

/**
 * Build display name for tree node from node name and attributes.
 * @param nodeName - Name of the XML node (e.g., 'Method', 'Field').
 * @param attributes - Array of formatted attribute strings (e.g., ['Name="test"', 'Line="5"']).
 * @returns Display name string with attributes appended if present (e.g., 'Method Name="test" Line="5"').
 */
function buildDisplayName(nodeName: string, attributes: string[]): string {
	if (attributes.length > EMPTY_ARRAY_LENGTH) {
		return `${nodeName}(${attributes.join(', ')})`;
	}
	return nodeName;
}

/**
 * Extract BeginLine and EndLine for color determination.
 * If the node doesn't have line numbers, traverse up to parent nodes to find them.
 * PMD uses lowercase attribute names (beginline, endline) in violation XML,
 * but may use PascalCase (BeginLine, EndLine) in AST XML.
 * @param currentNode - Current XML node to check for line numbers.
 * @returns Object with beginLine and endLine, or nulls if not found.
 */
function findLineNumbersInNode(currentNode: Element): {
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

		const parentNode: Node | null = nodeToCheck.parentNode;
		if (parentNode !== null && parentNode.nodeType === NODE_TYPE_ELEMENT) {
			nodeToCheck = parentNode as Element;
		} else {
			nodeToCheck = null;
		}
	}

	return { beginLine: NO_LINE, endLine: NO_LINE };
}

/**
 * Map child XML elements to tree nodes recursively.
 * @param children - Array of child XML elements.
 * @param options - Base options for tree node conversion.
 * @returns Array of tree nodes for children.
 */
function mapChildrenToTreeNodes(
	children: readonly Element[],
	options: XmlNodeToTreeNodeOptions,
): TreeNode[] {
	const FULL_METHOD_NAME_ATTR = 'FullMethodName';
	return children.map((child) => {
		const childFullMethodName =
			child.nodeName === 'MethodCallExpression'
				? (child.getAttribute(FULL_METHOD_NAME_ATTR) ?? undefined)
				: undefined;
		return xmlNodeToTreeNode({
			exampleContent: options.exampleContent,
			fullMethodName: childFullMethodName,
			node: child,
			previousExamplesCoverage: options.previousExamplesCoverage,
			validMarkers: options.validMarkers,
			violationMarkers: options.violationMarkers,
			wrapperInfo: options.wrapperInfo,
			xpath: options.xpath ?? null,
			xpathMatchLines: options.xpathMatchLines,
		});
	});
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
function xmlNodeToTreeNode(options: XmlNodeToTreeNodeOptions): TreeNode {
	const {
		node,
		exampleContent,
		previousExamplesCoverage,
		validMarkers,
		violationMarkers,
		xpath,
		xpathMatchLines,
		wrapperInfo,
	} = options;

	const { nodeName } = node;
	const { beginLine, endLine } = findLineNumbersInNode(node);
	const IMAGE_ATTR = 'Image';
	const nodeImage = node.getAttribute(IMAGE_ATTR) ?? '';
	const FULL_METHOD_NAME_ATTR = 'FullMethodName';
	const fullMethodName =
		node.getAttribute(FULL_METHOD_NAME_ATTR) ?? undefined;

	const attributes = formatNodeAttributes(node);
	const displayName = buildDisplayName(nodeName, attributes);

	const children = Array.from(node.childNodes).filter(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type predicate for DOM element
		(child: any): child is Element => child.nodeType === NODE_TYPE_ELEMENT,
	);

	const colorOptions: NodeColorOptions = {
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
	};

	const color = determineNodeColor(colorOptions);

	return {
		children: mapChildrenToTreeNodes(children, options),
		color,
		name: displayName,
	};
}

export type { TreeNode, XmlNodeToTreeNodeOptions };
export { xmlNodeToTreeNode };
