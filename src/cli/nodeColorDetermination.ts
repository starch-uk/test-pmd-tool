/**
 * @file
 * Node color determination utilities for CLI diagnostics.
 * Determines color coding for AST nodes based on example sections and XPath matching.
 */
import { extractNodeTypes } from '../xpath/extractNodeTypes.js';

const LINE_NUMBER_OFFSET = 1;
const EMPTY_STRING_LENGTH = 0;
const EMPTY_COVERAGE_LENGTH = 0;
const EMPTY_MARKERS_LENGTH = 0;
const MIN_ARRAY_INDEX = 0;

/**
 * Options for determining node color.
 */
interface NodeColorOptions {
	readonly beginLine: number | null;
	readonly endLine: number | null;
	readonly exampleContent: string;
	readonly nodeImage: string;
	readonly nodeType: string;
	readonly xpath: string | null;
	readonly previousExamplesCoverage?: readonly {
		readonly validMarkers: readonly { readonly lineNumber: number }[];
		readonly violationMarkers: readonly { readonly lineNumber: number }[];
		readonly exampleContent: string;
	}[];
	readonly validMarkers: readonly { readonly lineNumber: number }[];
	readonly violationMarkers: readonly { readonly lineNumber: number }[];
	readonly wrapperInfo?:
		| Readonly<{
				readonly addedWrapperClass: boolean;
				readonly wrapperClassName: string;
				readonly addedWrapperMethod: boolean;
				readonly wrapperMethodName: string;
				readonly helperMethodNames: readonly string[];
		  }>
		| undefined;

	/**
	 * Set of line numbers in the test file that match the XPath (from PMD violations).
	 */
	readonly xpathMatchLines?: ReadonlySet<number>;

	/**
	 * FullMethodName attribute for MethodCallExpression nodes (e.g., 'Pattern.compile', 'input.replaceFirst').
	 */
	readonly fullMethodName?: string;
}

/**
 * Map each line in example content to its section type (violation/valid/null).
 * Uses the same logic as parseExample to categorize lines based on markers and content.
 * @param exampleContent - Original example content.
 * @returns Map with line numbers (1-based) as keys and section types ('violation', 'valid', or null) as values. The map associates each line number with its corresponding section type for color determination.
 */
function mapLinesToSections(
	exampleContent: Readonly<string>,
): Map<number, 'valid' | 'violation'> {
	const lines = exampleContent.split('\n');
	const lineSectionMap = new Map<number, 'valid' | 'violation'>();
	let currentMode: 'valid' | 'violation' | null = null;

	lines.forEach((line: Readonly<string>, index: Readonly<number>) => {
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
 * Searches for the node's image (method name, variable name, etc.) within the example content.
 * @param nodeType - AST node type name (e.g., 'MethodCallExpression', 'VariableExpression').
 * @param nodeImage - Image attribute from node (method name, variable name, etc.).
 * @param exampleContent - Original example content to search within.
 * @returns Array of line numbers (1-based) where the node's source code appears in the example.
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
	lines.forEach((line: Readonly<string>, index: Readonly<number>) => {
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
 * Determine color for a node based on example sections and XPath matching.
 * Analyzes the node's source location and matches it against violation/valid sections in example content.
 * @param options - Options for color determination including line number mappings and section definitions.
 * @returns Color code string (e.g., 'red', 'green', 'blue', 'orange') indicating the section type, or undefined if no color should be applied.
 */
function determineNodeColor(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Parameter is already Readonly<NodeColorOptions> with readonly properties, false positive from nested type checks
	options: Readonly<NodeColorOptions>,
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

	// First, check if the node type matches the XPath (regardless of PMD results)
	// This determines if the node is relevant to the rule
	let nodeTypeMatchesXPath = false;
	if (xpath !== null && xpath.length > EMPTY_STRING_LENGTH) {
		const xpathNodeTypes = extractNodeTypes(xpath);
		nodeTypeMatchesXPath = xpathNodeTypes.includes(nodeType);

		// For MethodCallExpression, also check FullMethodName constraints
		if (
			nodeTypeMatchesXPath &&
			nodeType === 'MethodCallExpression' &&
			options.fullMethodName !== undefined
		) {
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
			if (expectedMethodNames.size > EMPTY_MARKERS_LENGTH) {
				nodeTypeMatchesXPath = expectedMethodNames.has(
					options.fullMethodName,
				);
			}
		}
	}

	// If node type doesn't match XPath, don't color it (not relevant to the rule)
	if (!nodeTypeMatchesXPath) {
		return undefined;
	}

	// Check if this node is actually matched by the XPath expression (PMD's violation detection)
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
				// xpathMatchLines is defined but empty (no violations found)
				// Don't return early - let the coloring logic below handle it
				nodeMatchesXPath = false;
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
			// Don't return early here - let the coloring logic below handle it based on nodeMatchesXPath and section
		} else {
			// Fallback: xpathMatchLines is undefined - use node type checking
			// This happens when XPath is null/empty or PMD execution failed
			// Set nodeMatchesXPath based on node type, but don't return early
			// The coloring logic below will handle it
			const xpathNodeTypes = extractNodeTypes(xpath);
			nodeMatchesXPath = xpathNodeTypes.includes(nodeType);
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

	// Color based on XPath match results (PMD's actual violation detection)
	// If we have XPath match results, use PMD's actual results to determine color
	if (xpathMatchLines !== undefined) {
		if (xpathMatchLines.size > EMPTY_MARKERS_LENGTH) {
			// PMD found violations - check if this node is involved
			if (nodeMatchesXPath) {
				// PMD found a violation on this node - color it red
				// (regardless of section type, because PMD's actual results take precedence)
				return alreadyCovered ? 'dark-red' : 'red';
			}
			// PMD found violations but not on this node
			// If node is in violation section, it should have triggered but didn't → green (actually valid)
			if (hasViolationSection) {
				return alreadyCovered ? 'dark-green' : 'green';
			}
			// Node is in valid section and PMD didn't find violation → green (correctly didn't trigger)
			if (hasValidSection) {
				return alreadyCovered ? 'dark-green' : 'green';
			}
			// No clear section - don't color
			return undefined;
		}
		// xpathMatchLines is defined but empty (no violations found)
		// If node is in violation section, it should have triggered but didn't → green (actually valid)
		if (hasViolationSection) {
			return alreadyCovered ? 'dark-green' : 'green';
		}
		// Node is in valid section and PMD didn't find violation → green (correctly didn't trigger)
		if (hasValidSection) {
			return alreadyCovered ? 'dark-green' : 'green';
		}
		// No clear section - don't color
		return undefined;
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
 * Apply color formatting to a node name string.
 * @param nodeName - The node name to colorize.
 * @param color - The color to apply ('dark-green', 'dark-red', 'green', 'orange', 'red', or undefined).
 * @returns Node name formatted with ANSI color codes applied.
 */
function applyColorToNodeName(
	nodeName: Readonly<string>,
	color: Readonly<
		'dark-green' | 'dark-red' | 'green' | 'orange' | 'red' | undefined
	>,
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

export {
	applyColorToNodeName,
	determineNodeColor,
	findLinesContainingNodeSource,
	mapLinesToSections,
};

export type { NodeColorOptions };
