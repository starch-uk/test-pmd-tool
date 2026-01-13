#!/usr/bin/env node

/**
 * Standalone PMD Rule Tester
 *
 * Tests PMD rules using examples embedded in the rule XML file.
 * This script is completely standalone and can be copied to any project.
 *
 * Requirements:
 * - Node.js
 * - PMD CLI installed and available in PATH (see: https://pmd.github.io/pmd/pmd_userdocs_installation.html)
 * - @xmldom/xmldom package: npm install @xmldom/xmldom
 *
 * Installation:
 *   npm install @xmldom/xmldom
 *
 * Usage:
 *   node test-pmd-rule.js <path-to-rule.xml>
 *
 * Examples:
 *   # Test a single rule
 *   node test-pmd-rule.js rulesets/code-style/AvoidMagicNumbers.xml
 *
 *   # Use in npm scripts
 *   "scripts": {
 *     "test-rule": "node test-pmd-rule.js"
 *   }
 *   npm run test-rule rulesets/code-style/MyRule.xml
 *
 * What it does:
 * 1. Extracts examples from the PMD rule XML file
 * 2. Parses "// Violation:" and "// Valid:" comment markers
 * 3. Creates temporary Apex test files from the examples
 * 4. Runs PMD against the test files
 * 5. Validates that violations occur for violation examples (at least as many as markers) and don't occur for valid examples
 * 6. Ensures the rule triggers at least one violation overall (catches broken/ineffective rules)
 * 7. Reports comprehensive test coverage results with precise violation counting
 *
 * The script automatically cleans up temporary files and provides detailed feedback
 * on rule behavior against its documented examples.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { DOMParser } = require('@xmldom/xmldom');

/**
 * Normalize and validate file path to prevent path traversal attacks.
 * Resolves the path to an absolute path and resolves symbolic links.
 * @param {string} filePath - User-provided file path.
 * @returns {string} Normalized absolute path.
 * @throws {Error} If path cannot be resolved or contains invalid characters.
 */
function normalizePath(filePath) {
	// Resolve to absolute path, removing ".." segments
	const resolvedPath = path.resolve(filePath);
	// Resolve symbolic links to get canonical path
	const canonicalPath = fs.realpathSync(resolvedPath);
	return canonicalPath;
}

/**
 * Extract XPath expression from XML rule file
 */
function extractXPath(xmlFilePath) {
	// Normalize path to prevent path traversal attacks
	const normalizedPath = normalizePath(xmlFilePath);
	const content = fs.readFileSync(normalizedPath, 'utf-8');
	const parser = new DOMParser();
	const doc = parser.parseFromString(content, 'text/xml');

	const properties = doc.getElementsByTagName('properties')[0];
	if (!properties) return null;

	const xpathProperty = Array.from(
		properties.getElementsByTagName('property'),
	).find((prop) => prop.getAttribute('name') === 'xpath');

	if (!xpathProperty) return null;

	const valueElement = xpathProperty.getElementsByTagName('value')[0];
	if (!valueElement) return null;

	return valueElement.textContent.trim();
}

/**
 * Analyze XPath to identify node types and patterns
 */
function analyzeXPath(xpath) {
	if (!xpath) return { nodeTypes: [] };

	const nodeTypes = new Set();

	// Extract node types (e.g., IfBlockStatement, WhileLoopStatement, UserClass, ApexFile)
	// Match patterns like: //IfBlockStatement, IfBlockStatement[, IfBlockStatement/, etc.
	// Also match special types: UserClass, UserInterface, UserEnum, ApexFile, Property, Parameter, etc.
	// Focus on actual AST node types, not modifiers or attributes
	// Handle complex XPath with let expressions and nested structures

	// Pattern 1: Match nodes ending with Statement, Expression, Declaration, Node, Block
	// Pattern 2: Match standalone AST node types: Method, Field, Class, Type, Condition, Loop, Block
	// Pattern 3: Match nodes containing Method/Class/Field/etc. in their names (e.g., MethodCallExpression)
	// Handle .// (dot-slash-slash), // (slash-slash), /, space, etc. before node types
	// The trailing pattern allows whitespace, end of string, or XPath syntax characters
	const nodeTypeMatches1 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)([A-Z][a-zA-Z]*(?:Statement|Expression|Declaration|Node|Block))(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);
	const nodeTypeMatches2 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)(Method|Field|Class|Type|Condition|Loop|Block)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);
	const nodeTypeMatches3 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)([A-Z][a-zA-Z]*(?:Method|Class|Field|Condition|Loop|Type)[a-zA-Z]*)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	const allNodeTypeMatches = [
		...Array.from(nodeTypeMatches1),
		...Array.from(nodeTypeMatches2),
		...Array.from(nodeTypeMatches3),
	];

	// Pattern 2: Match special AST node types that don't match Pattern 1
	// UserClass, UserInterface, UserEnum, ApexFile, Property, Parameter, MapEntryNode, etc.
	const specialNodeTypes = [
		'UserClass',
		'UserInterface',
		'UserEnum',
		'ApexFile',
		'Property',
		'Parameter',
		'ModifierNode',
		'Annotation',
		'MapEntryNode',
		'ValueWhenBlock',
		'ElseWhenBlock',
		'Getter',
		'Setter',
		'VariableDeclaratorId',
	];

	// Combine all patterns and add special types
	let nodeTypeMatches = allNodeTypeMatches;
	for (const specialType of specialNodeTypes) {
		const specialRegex = new RegExp(
			`(?:\\.//|//|\\s|/|\\(|\\[|,|\\|)${specialType}(?=\\s|$|\\[|\\(|/|\\)|,|\\||]|or|and|not|return|let)`,
			'g',
		);
		const specialMatches = Array.from(xpath.matchAll(specialRegex));
		specialMatches.forEach((match) => {
			// Add as a match with the special type as the capture group
			nodeTypeMatches.push([match[0], specialType]);
		});
	}

	for (const match of nodeTypeMatches) {
		const nodeType = match[1] || match[0];
		// Filter out common non-node-type words and attributes
		if (
			![
				'let',
				'return',
				'if',
				'then',
				'else',
				'and',
				'or',
				'not',
				'exists',
				'count',
				'sum',
				'for',
				'in',
				'satisfies',
				'ancestor',
				'descendant',
				'following',
				'preceding',
				'parent',
				'child',
				'self',
				'sibling',
			].includes(nodeType) &&
			nodeType.length > 3 &&
			// Only include if it looks like an AST node type
			(nodeType.endsWith('Statement') ||
				nodeType.endsWith('Expression') ||
				nodeType.endsWith('Declaration') ||
				nodeType.endsWith('Node') ||
				nodeType.endsWith('Block') ||
				nodeType === 'Method' ||
				nodeType === 'Class' ||
				nodeType === 'Field' ||
				nodeType === 'Block' ||
				nodeType === 'Condition' ||
				nodeType === 'Loop' ||
				nodeType === 'Type' ||
				nodeType === 'FormalComment' ||
				nodeType === 'UserClass' ||
				nodeType === 'UserInterface' ||
				nodeType === 'UserEnum' ||
				nodeType === 'ApexFile' ||
				nodeType === 'Property' ||
				nodeType === 'Parameter' ||
				nodeType === 'ModifierNode' ||
				nodeType === 'Annotation' ||
				nodeType === 'MapEntryNode' ||
				nodeType === 'ValueWhenBlock' ||
				nodeType === 'ElseWhenBlock' ||
				nodeType === 'Getter' ||
				nodeType === 'Setter' ||
				nodeType === 'VariableDeclaratorId' ||
				// Also match any capitalized word that contains Class, Interface, Enum, File
				nodeType.includes('Class') ||
				nodeType.includes('Interface') ||
				nodeType.includes('Enum') ||
				nodeType.includes('File'))
		) {
			nodeTypes.add(nodeType);
		}
	}

	// Extract operators
	const operators = new Set();
	const opMatches = xpath.matchAll(/@Op\s*=\s*['"]([^'"]+)['"]/g);
	for (const match of opMatches) {
		operators.add(match[1]);
	}

	// Extract attribute checks
	const attributes = new Set();
	const attrMatches = xpath.matchAll(/@([A-Z][a-zA-Z]*)\s*=/g);
	for (const match of attrMatches) {
		attributes.add(match[1]);
	}

	// Extract conditionals (comprehensive extraction of all XPath 3.1 conditionals)
	const conditionals = [];

	// Extract comparison operations: @Attribute <= value, @Attribute != value, etc.
	// Match patterns like: @InputParametersSize <= $maxArgs, @BeginLine != @EndLine
	// Include all comparison operators: = != < <= > >= eq ne lt le gt ge
	const comparisonRegex =
		/@[A-Z][a-zA-Z]*\s*(<=|>=|!=|==|<|>|eq|ne|lt|le|gt|ge|=\s*[^=\s])/g;
	let match;
	while ((match = comparisonRegex.exec(xpath)) !== null) {
		const comparison = match[0].trim();
		// Skip if it's part of a let expression (variable assignment)
		if (!comparison.includes('let ') && !comparison.match(/let\s+\$/)) {
			// Extract the full comparison expression
			const fullComparison = xpath.substring(
				Math.max(0, match.index - 20),
				match.index + match[0].length + 20,
			);
			const comparisonMatch = fullComparison.match(
				/[@$A-Za-z][\w@$]*\s*(<=|>=|!=|==|<|>|eq|ne|lt|le|gt|ge)\s*[@$A-Za-z][\w@$]*/,
			);
			const expr = comparisonMatch
				? comparisonMatch[0].trim()
				: comparison;

			if (
				!conditionals.some(
					(c) => c.expression === expr && c.type === 'comparison',
				)
			) {
				conditionals.push({
					type: 'comparison',
					expression: expr,
					description: expr,
				});
			}
		}
	}

	// Extract `and` operators (each `and` connects two conditions)
	// Match standalone `and` operators (not part of `and-or-self` or other words)
	// Simple pattern: word boundary + 'and' + whitespace
	const andRegex = /\band\s+/g;
	// Extract all `and` matches first to avoid regex state issues
	const andMatches = Array.from(xpath.matchAll(andRegex));

	andMatches.forEach((andMatch, index) => {
		const position = andMatch.index;

		// Extract the full expression after `and` (may be complex with arbitrarily nested parentheses/brackets)
		// Find the end of the condition: stop at next `and`, `or`, or closing `]` at the same level
		const afterStart = position + 4; // Skip "and "
		let afterEnd = afterStart;
		let parenDepth = 0;
		let bracketDepth = 0;
		let inString = false;
		let stringChar = null;

		for (let i = afterStart; i < xpath.length; i++) {
			const char = xpath[i];
			const prevChar = i > 0 ? xpath[i - 1] : null;

			// Handle string literals (don't count parens/brackets inside strings)
			if (!inString && (char === '"' || char === "'")) {
				inString = true;
				stringChar = char;
			} else if (inString && char === stringChar && prevChar !== '\\') {
				inString = false;
				stringChar = null;
			} else if (!inString) {
				// Track parentheses (for function calls, nested conditions)
				if (char === '(') {
					parenDepth++;
				} else if (char === ')') {
					parenDepth--;
				}
				// Track brackets (for predicates, array indices)
				else if (char === '[') {
					bracketDepth++;
				} else if (char === ']') {
					bracketDepth--;
				}
				// At the same level (no nested structures), check for operators or predicate end
				else if (parenDepth === 0 && bracketDepth === 0) {
					// Check if we hit another `and` or `or` at the same level
					const remaining = xpath.substring(i);
					if (
						remaining.match(/^\s+and\s+/) ||
						remaining.match(/^\s+or\s+/)
					) {
						afterEnd = i;
						break;
					}
				}
			}
			afterEnd = i + 1;
		}

		const fullCondition = xpath.substring(afterStart, afterEnd).trim();
		// Remove trailing `]` if present (it belongs to the predicate, not the condition)
		const cleanCondition = fullCondition.replace(/\]\s*$/, '');

		// Create a description showing what follows the `and` (truncated for display)
		const displayCondition = cleanCondition.substring(0, 50);
		const description = cleanCondition
			? `and ${displayCondition}${cleanCondition.length >= 50 ? '...' : ''}`
			: `and operator ${index + 1}`;

		conditionals.push({
			type: 'and_operator',
			expression: `and_${position}`,
			description: description,
			fullExpression: cleanCondition, // Store full expression for coverage checking
			position: position,
		});
	});

	// Extract `not()` expressions (negation conditionals)
	// Handle arbitrarily nested parentheses by finding matching closing paren
	// Match patterns like: not(.//Expression), not(@Attr = 'val'), not(not(condition))
	const extractNotExpressions = (xpath, startPos = 0) => {
		const results = [];
		const notPattern = /\bnot\s*\(/g;
		notPattern.lastIndex = startPos;
		let match;

		while ((match = notPattern.exec(xpath)) !== null) {
			const notStart = match.index;
			const innerStart = match.index + match[0].length; // Position after 'not('

			// Find matching closing parenthesis by counting nesting depth
			let parenDepth = 1;
			let innerEnd = innerStart;
			let inString = false;
			let stringChar = null;

			for (let i = innerStart; i < xpath.length; i++) {
				const char = xpath[i];
				const prevChar = i > 0 ? xpath[i - 1] : null;

				// Handle string literals (don't count parens inside strings)
				if (!inString && (char === '"' || char === "'")) {
					inString = true;
					stringChar = char;
				} else if (
					inString &&
					char === stringChar &&
					prevChar !== '\\'
				) {
					inString = false;
					stringChar = null;
				} else if (!inString) {
					if (char === '(') {
						parenDepth++;
					} else if (char === ')') {
						parenDepth--;
						if (parenDepth === 0) {
							innerEnd = i;
							break;
						}
					}
				}
			}

			if (parenDepth === 0) {
				const innerExpr = xpath.substring(innerStart, innerEnd).trim();
				const cleanExpr = innerExpr.substring(0, 80);

				if (
					!conditionals.some(
						(c) =>
							c.expression === innerExpr &&
							c.type === 'not_condition',
					)
				) {
					conditionals.push({
						type: 'not_condition',
						expression: innerExpr,
						description: `not(${cleanExpr}${innerExpr.length > 80 ? '...' : ''})`,
					});
				}

				// Recursively extract nested not() expressions
				results.push(...extractNotExpressions(innerExpr, 0));
			}
		}

		return results;
	};

	extractNotExpressions(xpath, 0);

	// Extract `or` operators (which create branches)
	// Match patterns like: .//NewListLiteralExpression or .//NewMapLiteralExpression
	// Handle or inside not() expressions
	const orRegex =
		/(?:\.\/\/|\.\/|\.|^|[^|])([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Method|Class|Node|Literal|Object|Reference|List|Map|Type))\s+or\s+([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Method|Class|Node|Literal|Object|Reference|List|Map|Type))|(\.\/\/[A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Method|Class|Node|Literal|Object|Reference|List|Map|Type))\s+or\s+(\.\/\/[A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Method|Class|Node|Literal|Object|Reference|List|Map|Type))/g;
	let orMatch;
	while ((orMatch = orRegex.exec(xpath)) !== null) {
		const left = (orMatch[1] || orMatch[3] || '').trim();
		const right = (orMatch[2] || orMatch[4] || '').trim();
		if (left && right) {
			// Count each branch as a separate conditional
			[left, right].forEach((part, index) => {
				if (
					part &&
					!conditionals.some(
						(c) => c.expression === part && c.type === 'or_branch',
					)
				) {
					// Extract node type name from the expression (remove .// prefix)
					const nodeTypeName = part.replace(/^\.\/\//, '').trim();
					conditionals.push({
						type: 'or_branch',
						expression: part,
						description: `or branch ${index + 1}: ${nodeTypeName}`,
						branchIndex: index,
					});
				}
			});
		}
	}

	// Extract union operators (|) which create branches
	// Match patterns like: MethodCallExpression | NewObjectExpression
	// Handle union in paths like: ReferenceExpression[1]/(MethodCallExpression | NewObjectExpression)
	// Exclude || (logical OR in some contexts)
	const unionRegex =
		/\(([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Method|Class|Node|Literal|Object|Reference|List|Map|Type))\s*\|\s*([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Method|Class|Node|Literal|Object|Reference|List|Map|Type))\)|([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Method|Class|Node|Literal|Object|Reference|List|Map|Type))\s+\|\s+([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Method|Class|Node|Literal|Object|Reference|List|Map|Type))(?=\s*\)|$|\s|])/g;
	let unionMatch;
	while ((unionMatch = unionRegex.exec(xpath)) !== null) {
		const left = (unionMatch[1] || unionMatch[3] || '').trim();
		const right = (unionMatch[2] || unionMatch[4] || '').trim();
		if (left && right) {
			// Count each branch as a separate conditional
			[left, right].forEach((part, index) => {
				if (
					part &&
					!conditionals.some(
						(c) =>
							c.expression === part && c.type === 'union_branch',
					)
				) {
					conditionals.push({
						type: 'union_branch',
						expression: part,
						description: `union branch ${index + 1}: ${part}`,
						branchIndex: index,
					});
				}
			});
		}
	}

	// Extract `if-then-else` conditional expressions
	// Match patterns like: if ($cond) then $a else $b
	// Handle arbitrarily nested parentheses
	const extractIfExpressions = (xpath, startPos = 0) => {
		const ifPattern = /\bif\s*\(/gi;
		ifPattern.lastIndex = startPos;
		let match;

		while ((match = ifPattern.exec(xpath)) !== null) {
			const ifStart = match.index;
			const condStart = match.index + match[0].length; // Position after 'if('

			// Find matching closing parenthesis for the condition
			let parenDepth = 1;
			let condEnd = condStart;
			let inString = false;
			let stringChar = null;

			for (let i = condStart; i < xpath.length; i++) {
				const char = xpath[i];
				const prevChar = i > 0 ? xpath[i - 1] : null;

				if (!inString && (char === '"' || char === "'")) {
					inString = true;
					stringChar = char;
				} else if (
					inString &&
					char === stringChar &&
					prevChar !== '\\'
				) {
					inString = false;
					stringChar = null;
				} else if (!inString) {
					if (char === '(') parenDepth++;
					else if (char === ')') {
						parenDepth--;
						if (parenDepth === 0) {
							condEnd = i;
							break;
						}
					}
				}
			}

			if (parenDepth === 0) {
				const condition = xpath.substring(condStart, condEnd).trim();
				if (
					!conditionals.some(
						(c) =>
							c.expression === condition &&
							c.type === 'if_condition',
					)
				) {
					conditionals.push({
						type: 'if_condition',
						expression: condition,
						description: `if (${condition.substring(0, 60)}${condition.length > 60 ? '...' : ''})`,
					});
				}
			}
		}
	};

	extractIfExpressions(xpath, 0);

	// Extract quantified expressions: `some` and `every`
	// Match patterns like: some $x in $seq satisfies $expr, every $x in $seq satisfies $expr
	const quantifiedRegex =
		/\b(some|every)\s+\$[a-zA-Z][\w]*\s+in\s+[^\s]+\s+satisfies\s+[^)]+/gi;
	let quantMatch;
	while ((quantMatch = quantifiedRegex.exec(xpath)) !== null) {
		const quantifiedExpr = quantMatch[0].trim();
		const quantifier = quantMatch[1].toLowerCase(); // 'some' or 'every'
		// Extract the satisfies condition
		const satisfiesMatch = quantifiedExpr.match(/satisfies\s+(.+)/);
		if (satisfiesMatch) {
			const satisfiesCondition = satisfiesMatch[1].trim();
			if (
				!conditionals.some(
					(c) =>
						c.expression === satisfiesCondition &&
						c.type === `${quantifier}_condition`,
				)
			) {
				conditionals.push({
					type: `${quantifier}_condition`,
					expression: satisfiesCondition,
					description: `${quantifier} $x satisfies ${satisfiesCondition.substring(0, 50)}${satisfiesCondition.length > 50 ? '...' : ''}`,
				});
			}
		}
	}

	// Extract boolean functions that act as conditionals: exists(), empty()
	// Match patterns like: exists(.//Expression), empty(@Attr)
	// Handle arbitrarily nested parentheses
	const extractBooleanFunctions = (xpath, startPos = 0) => {
		const funcPattern = /\b(exists|empty)\s*\(/gi;
		funcPattern.lastIndex = startPos;
		let match;

		while ((match = funcPattern.exec(xpath)) !== null) {
			const funcName = match[1].toLowerCase(); // 'exists' or 'empty'
			const funcStart = match.index;
			const innerStart = match.index + match[0].length; // Position after 'exists(' or 'empty('

			// Find matching closing parenthesis
			let parenDepth = 1;
			let innerEnd = innerStart;
			let inString = false;
			let stringChar = null;

			for (let i = innerStart; i < xpath.length; i++) {
				const char = xpath[i];
				const prevChar = i > 0 ? xpath[i - 1] : null;

				if (!inString && (char === '"' || char === "'")) {
					inString = true;
					stringChar = char;
				} else if (
					inString &&
					char === stringChar &&
					prevChar !== '\\'
				) {
					inString = false;
					stringChar = null;
				} else if (!inString) {
					if (char === '(') parenDepth++;
					else if (char === ')') {
						parenDepth--;
						if (parenDepth === 0) {
							innerEnd = i;
							break;
						}
					}
				}
			}

			if (parenDepth === 0) {
				const innerExpr = xpath.substring(innerStart, innerEnd).trim();
				const cleanExpr = innerExpr.substring(0, 80);

				if (
					!conditionals.some(
						(c) =>
							c.expression === innerExpr &&
							c.type === `${funcName}_condition`,
					)
				) {
					conditionals.push({
						type: `${funcName}_condition`,
						expression: innerExpr,
						description: `${funcName}(${cleanExpr}${innerExpr.length > 80 ? '...' : ''})`,
					});
				}
			}
		}
	};

	extractBooleanFunctions(xpath, 0);

	// Check for union operators (|) which indicate multiple paths
	const hasUnions = xpath.includes('|') && !xpath.includes('||');

	// Check for let expressions (complex logic)
	const hasLetExpressions = xpath.includes('let ');

	return {
		nodeTypes: Array.from(nodeTypes),
		operators: Array.from(operators),
		attributes: Array.from(attributes),
		conditionals: conditionals,
		hasUnions,
		hasLetExpressions,
		patterns: [], // Reserved for future pattern analysis
	};
}

/**
 * Check for hardcoded values in XPath expressions that should be variables
 */
function checkXPathHardcodedValues(xpath) {
	const issues = [];
	const seenIssues = new Set();

	if (!xpath) return issues;

	// Extract variable declarations to know what values are already parameterized
	const declaredVariables = new Set();
	const letMatches = xpath.matchAll(
		/let\s+\$[a-zA-Z][a-zA-Z0-9]*\s*:=\s*([^,\n)]+)/g,
	);
	for (const match of letMatches) {
		const varValue = match[1].trim();
		// Extract the actual values from variable declarations
		if (varValue.startsWith('(') && varValue.endsWith(')')) {
			// Array/tuple values like ('==', '!=')
			const arrayValues = varValue
				.slice(1, -1)
				.split(',')
				.map((v) => v.trim().replace(/['"]/g, ''));
			arrayValues.forEach((val) => declaredVariables.add(val));
		} else {
			// Single values like 'join' or 3
			declaredVariables.add(varValue.replace(/['"]/g, ''));
		}
	}

	// Check for hardcoded attribute values that could be variables
	// Exclude XPath expressions that contain @, $, ., / as these are not hardcoded values
	const attrValueMatches = xpath.matchAll(
		/@[A-Z][a-zA-Z]*\s*=\s*(?:(['"])([^'"]+)\1|([^\s\[\]\(\),@\$./]+))/g,
	);
	for (const match of attrValueMatches) {
		const attr = match[0];
		const value = match[2] || match[3]; // quoted value or unquoted value

		// Skip common values that are typically acceptable as hardcoded
		const lowerValue = value.toLowerCase();
		const acceptableHardcoded = [
			'true',
			'false',
			'null',
			'0',
			'1',
			'-1',
			'static',
			'final',
			'abstract',
			'override',
			'public',
			'private',
			'protected',
		];

		// For @Op attributes, we want to catch operators that could be variables
		const isOperator = attr.includes('@Op');
		if (isOperator) {
			// Only skip the most basic operators that are truly universal
			acceptableHardcoded.push('==', '!=', '<', '>', '<=', '>=');
		}

		if (
			!acceptableHardcoded.includes(lowerValue) &&
			!declaredVariables.has(value)
		) {
			// Skip method names that are core API methods (join, format, etc.)
			if (
				attr.includes('@MethodName') &&
				[
					'join',
					'format',
					'valueof',
					'isblank',
					'isempty',
					'size',
					'add',
					'get',
					'set',
					'put',
					'remove',
					'contains',
					'indexof',
					'substring',
					'touppercase',
					'tolowercase',
				].includes(lowerValue)
			) {
				continue;
			}

			// Suggest variable name based on attribute and value
			let varName = '';
			const attrName = attr.match(/@([A-Z][a-zA-Z]*)/)[1];
			if (attrName === 'Op') {
				if (value === '+') varName = 'plusOp';
				else if (value === '-') varName = 'minusOp';
				else if (value === '*') varName = 'multiplyOp';
				else if (value === '/') varName = 'divideOp';
				else if (value === '%') varName = 'moduloOp';
				else if (value === '==') varName = 'equalsOp';
				else if (value === '!=') varName = 'notEqualsOp';
				else
					varName = value.toLowerCase().replace(/[^a-z]/g, '') + 'Op';
			} else if (attrName === 'Image') {
				varName = value.toLowerCase().replace(/[^a-z]/g, '') + 'Name';
			} else if (attrName === 'MethodName') {
				varName = value.toLowerCase() + 'Method';
			} else {
				varName = attrName.toLowerCase() + 'Value';
			}

			const issueKey = `${attr}=${value}`;
			if (!seenIssues.has(issueKey)) {
				seenIssues.add(issueKey);
				const quote = value.match(/['"]/) ? "'" : "'";
				issues.push({
					type: 'hardcoded_attribute',
					value: attr,
					suggestion: `let $${varName} := ${quote}${value}${quote}`,
					replacement: `$${varName}`,
				});
			}
		}
	}

	// Check for hardcoded operator arrays that could be variables
	const opArrayMatches = xpath.matchAll(
		/@Op\s*=\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"]\s*)*\)/g,
	);
	for (const match of opArrayMatches) {
		const fullMatch = match[0];
		const ops = fullMatch
			.match(/'([^']+)'|"([^"]+)"/g)
			.map((op) => op.replace(/['"]/g, ''));
		if (ops.length > 1) {
			let varName = 'comparisonOps';
			if (ops.includes('+')) varName = 'arithmeticOps';
			else if (ops.includes('++') || ops.includes('--'))
				varName = 'incrementOps';
			else if (ops.includes('==') || ops.includes('!='))
				varName = 'equalityOps';

			const issueKey = `op_array:${fullMatch}`;
			if (!seenIssues.has(issueKey)) {
				seenIssues.add(issueKey);
				issues.push({
					type: 'hardcoded_op_array',
					value: fullMatch,
					suggestion: `let $${varName} := (${ops.map((op) => `'${op}'`).join(', ')})`,
					replacement: `$${varName}`,
				});
			}
		}
	}

	// Check for hardcoded numbers that could be variables (excluding common values)
	const numberMatches = xpath.matchAll(
		/(?:count|>=|<=|=|>|<)\s*([0-9]+(?:\.[0-9]+)?)/g,
	);
	for (const match of numberMatches) {
		const fullMatch = match[0];
		const number = match[1];

		// Skip numbers that are already in let expressions
		// Check if the XPath contains any let expressions at all
		if (xpath.includes('let $')) {
			continue; // Skip all numbers if there are any let expressions (conservative approach)
		}

		// Flag common numbers that should be variables for configurability
		const shouldBeVariableNumbers = ['0', '1'];
		if (shouldBeVariableNumbers.includes(number)) {
			// Get more context by looking at text around the match
			const matchIndex = xpath.indexOf(fullMatch);
			const contextStart = Math.max(0, matchIndex - 100);
			const contextEnd = Math.min(
				xpath.length,
				matchIndex + fullMatch.length + 100,
			);
			const broaderContext = xpath.substring(contextStart, contextEnd);

			let varName = 'threshold';
			const operator = fullMatch.trim().split(/\s+/)[0];

			// Try to provide more context-specific variable names
			if (broaderContext.includes('count(BlockStatement/*)')) {
				varName =
					operator === '=' ? 'exactStatements' : 'minStatements';
			} else if (broaderContext.includes('count(.//Parameter)')) {
				varName = 'minParams';
			} else if (broaderContext.includes('count(ValueWhenBlock)')) {
				varName =
					operator === '=' ? 'exactWhenBlocks' : 'minWhenBlocks';
			} else if (broaderContext.includes('count(')) {
				varName = operator === '=' ? 'exactCount' : 'minCount';
			} else if (operator === '>=') {
				varName = 'minValue';
			} else if (operator === '<=') {
				varName = 'maxValue';
			} else if (operator === '=') {
				varName = 'exactValue';
			}

			const issueKey = `number:${fullMatch.trim()}`;
			if (!seenIssues.has(issueKey)) {
				seenIssues.add(issueKey);
				issues.push({
					type: 'hardcoded_number',
					value: fullMatch.trim(),
					suggestion: `let $${varName} := ${number}`,
					replacement: `$${varName}`,
				});
			}
		}
	}

	return issues;
}

/**
 * Check if test file content contains relevant code patterns for XPath coverage
 */
function checkXPathCoverageInContent(content, xpathAnalysis) {
	const coverage = {
		coveredNodeTypes: new Set(),
		missingNodeTypes: [],
		coveredConditionals: new Set(),
		missingConditionals: [],
		conditionalCoverage: [], // Detailed coverage info for each conditional
	};

	const lowerContent = content.toLowerCase();

	// Check if node types are covered in the content
	// This is a simple heuristic - check if the content contains code that would match
	const nodeTypeMap = {
		IfBlockStatement: ['if', 'else if'],
		IfElseBlockStatement: ['if', 'else if', 'else'],
		WhileLoopStatement: ['while'],
		ForLoopStatement: ['for'],
		SwitchStatement: ['switch'],
		TernaryExpression: ['?', ':', 'ternary'],
		MethodCallExpression: ['(', 'method'],
		VariableExpression: [
			'variable',
			'var',
			'=',
			'String',
			'Integer',
			'Boolean',
			'Object',
			'List',
			'Map',
			'Set',
		],
		VariableDeclaration: [
			'=',
			'declaration',
			'String',
			'Integer',
			'Boolean',
		],
		Method: ['method', 'function', 'void', 'public', 'private'],
		Field: ['field', 'property', 'static', 'final'],
		FieldDeclaration: [
			'field',
			'property',
			'static',
			'final',
			'private',
			'protected',
			'public',
		],
		Class: ['class'],
		UserClass: ['class'],
		UserInterface: ['interface'],
		UserEnum: ['enum'],
		Property: ['property', 'get', 'set'],
		StandardCondition: ['if', 'while', 'for', 'condition'],
		ExpressionStatement: ['expression', 'statement'],
		ApexFile: ['apex', 'file'],
		FieldDeclarationStatements: ['field', 'declaration'],
		VariableDeclarationStatements: ['variable', 'declaration'],
		ValueWhenBlock: ['when', 'case'],
		ElseWhenBlock: ['else', 'when'],
		BlockStatement: ['{', '}', 'block'],
		NewMapInitExpression: ['new Map', 'Map<', 'Map('],
		ReferenceExpression: ['reference', 'ref', '.', 'this.', 'super.'],
		FormalComment: ['/**', '*/', 'apexdoc'],
		BinaryExpression: ['==', '!=', '<', '>', '<=', '>='],
		AssignmentExpression: ['=', 'assignment'],
		UnaryExpression: ['++', '--', '!', '+', '-'],
		ReturnStatement: ['return'],
		ThrowStatement: ['throw'],
		BreakStatement: ['break'],
		ContinueStatement: ['continue'],
		EmptyStatement: [';'],
		ThisVariableExpression: ['this'],
		InstanceOfExpression: ['instanceof'],
		BooleanExpression: ['&&', '||', 'and', 'or'],
		PrimaryExpression: ['primary', 'expression'],
		ForEachStatement: ['for', ':'],
		DoLoopStatement: ['do', 'while'],
		CatchBlockStatement: ['catch'],
		NewListLiteralExpression: ['new List', 'List<'],
		NewMapLiteralExpression: ['new Map', 'Map<'],
		NewObjectExpression: ['new ', 'constructor'],
		AnnotationParameter: ['@', 'annotation'],
		MapEntryNode: ['=>', 'map.entry'],
		ModifierNode: ['public', 'private', 'static', 'final', 'abstract'],
		Parameter: ['parameter', 'arg'],
		VariableDeclaration: ['int', 'String', 'Boolean', 'var'],
		Annotation: ['@Test', '@SuppressWarnings', '@IsTest'],
		LiteralExpression: ['null', 'true', 'false', '0', '1', 'literal'],
	};

	xpathAnalysis.nodeTypes.forEach((nodeType) => {
		const keywords = nodeTypeMap[nodeType] || [];
		const isCovered = keywords.some((keyword) =>
			lowerContent.includes(keyword.toLowerCase()),
		);
		if (isCovered) {
			coverage.coveredNodeTypes.add(nodeType);
		} else {
			coverage.missingNodeTypes.push(nodeType);
		}
	});

	// Check conditional coverage
	if (xpathAnalysis.conditionals && xpathAnalysis.conditionals.length > 0) {
		xpathAnalysis.conditionals.forEach((conditional) => {
			const coverageResult = checkConditionalCoverage(
				conditional,
				content,
				lowerContent,
				xpathAnalysis,
			);

			// A conditional is considered covered if:
			// 1. It's marked as covered AND
			// 2. We have evidence that it's actually exercised (not just "assuming covered" or "verified with test content")
			// 3. BOTH true and false branches are covered
			const hasActualCoverageEvidence = coverageResult.evidence.some(
				(ev) => {
					const evLower = ev.toLowerCase();
					return (
						evLower.includes('found') ||
						evLower.includes('exercises') ||
						evLower.includes('branch') ||
						evLower.includes('patterns') ||
						evLower.includes('detected') ||
						(evLower.includes('method calls') &&
							(evLower.includes('0-1') ||
								evLower.includes('2+') ||
								evLower.includes('multi-line') ||
								evLower.includes('single-line'))) ||
						(evLower.includes('literals') &&
							evLower.includes('found')) ||
						(evLower.includes('expressions') &&
							evLower.includes('found'))
					);
				},
			);

			// Check if both branches are covered
			const bothBranchesCovered =
				coverageResult.branches.true === true &&
				coverageResult.branches.false === true;

			const isActuallyCovered =
				coverageResult.covered &&
				hasActualCoverageEvidence &&
				!coverageResult.evidence.some((ev) =>
					ev.includes('no test content found'),
				) &&
				bothBranchesCovered;

			if (isActuallyCovered) {
				coverage.coveredConditionals.add(
					conditional.expression || conditional.description,
				);
				coverage.conditionalCoverage.push({
					conditional: conditional,
					covered: true,
					evidence: coverageResult.evidence,
					branches: coverageResult.branches,
				});
			} else {
				coverage.missingConditionals.push(conditional);
				coverage.conditionalCoverage.push({
					conditional: conditional,
					covered: false,
					evidence: coverageResult.evidence,
					branches: coverageResult.branches,
				});
			}
		});
	}

	return coverage;
}

/**
 * Check if a specific conditional is covered in the test content
 */
function checkConditionalCoverage(
	conditional,
	content,
	lowerContent,
	xpathAnalysis,
) {
	const result = {
		covered: false,
		evidence: [],
		branches: { true: false, false: false },
	};

	// Ensure branches are boolean (not undefined)
	if (result.branches.true === undefined) result.branches.true = false;
	if (result.branches.false === undefined) result.branches.false = false;

	switch (conditional.type) {
		case 'comparison':
			result.covered = checkComparisonCoverage(
				conditional,
				content,
				lowerContent,
				result,
			);
			break;
		case 'and_operator':
			result.covered = checkAndOperatorCoverage(
				conditional,
				content,
				lowerContent,
				result,
			);
			break;
		case 'not_condition':
			result.covered = checkNotConditionCoverage(
				conditional,
				content,
				lowerContent,
				result,
			);
			break;
		case 'or_branch':
			result.covered = checkOrBranchCoverage(
				conditional,
				content,
				lowerContent,
				result,
			);
			break;
		case 'union_branch':
			result.covered = checkUnionBranchCoverage(
				conditional,
				content,
				lowerContent,
				result,
			);
			break;
		case 'if_condition':
			result.covered = checkIfConditionCoverage(
				conditional,
				content,
				lowerContent,
				result,
			);
			break;
		case 'some_condition':
		case 'every_condition':
			result.covered = checkQuantifiedConditionCoverage(
				conditional,
				content,
				lowerContent,
				result,
			);
			break;
		case 'exists_condition':
		case 'empty_condition':
			result.covered = checkBooleanFunctionCoverage(
				conditional,
				content,
				lowerContent,
				result,
			);
			break;
		default:
			// Unknown conditional type - can't automatically verify both branches
			const hasTestContent = content.trim().length > 0;
			result.branches.true = false;
			result.branches.false = false;
			result.covered = false;
			if (!hasTestContent) {
				result.evidence.push(
					'Unknown conditional type - no test content found',
				);
			} else {
				result.evidence.push(
					'Unknown conditional type - cannot automatically verify both branches',
				);
			}
	}

	return result;
}

/**
 * Check coverage for comparison conditionals (e.g., @Attribute <= value)
 */
function checkComparisonCoverage(conditional, content, lowerContent, result) {
	const expr = conditional.expression || conditional.description;

	// Extract attribute name and operator
	const attrMatch = expr.match(
		/@([A-Z][a-zA-Z]*)\s*(<=|>=|!=|==|<|>|eq|ne|lt|le|gt|ge)\s*/,
	);
	if (!attrMatch) {
		result.evidence.push('Could not parse comparison expression');
		return false;
	}

	const attrName = attrMatch[1];
	const operator = attrMatch[2];

	// Check for patterns that would exercise this comparison
	// For @InputParametersSize, check for method calls with different argument counts
	if (attrName === 'InputParametersSize') {
		// Check for method calls with 0-1 args (true branch) and 2+ args (false branch)
		const hasZeroArgs = /\w+\s*\(\s*\)/.test(content);
		const hasOneArg =
			/\w+\s*\(\s*[^)]+\s*\)/.test(content) &&
			!/\w+\s*\(\s*[^,]+\s*,\s*[^)]+\)/.test(content);
		const hasMultipleArgs = /\w+\s*\(\s*[^,]+\s*,\s*[^)]+\)/.test(content);

		if (operator === '<=') {
			result.branches.true = hasZeroArgs || hasOneArg;
			result.branches.false = hasMultipleArgs;
			if (hasZeroArgs || hasOneArg)
				result.evidence.push(
					'Found method calls with 0-1 arguments (true branch)',
				);
			if (hasMultipleArgs)
				result.evidence.push(
					'Found method calls with 2+ arguments (false branch)',
				);
			// Only covered if BOTH branches are exercised
			result.covered = result.branches.true && result.branches.false;
			return result.covered;
		}
	}

	// For @BeginLine != @EndLine, check for multi-line and single-line method calls
	if (attrName === 'BeginLine') {
		// Check for multi-line method calls (BeginLine != EndLine) - violations
		// Pattern: method call with opening paren on one line and closing paren on another
		const hasMultiLine =
			/\w+\s*\(\s*\n\s*[^)]+\s*\n\s*\)/.test(content) ||
			/\w+\s*\(\s*\n\s*\)/.test(content);

		// Check for single-line method calls (BeginLine == EndLine) - valid
		// Pattern: method call with opening and closing paren on same line, no newlines between
		const singleLinePattern = /\w+\s*\(\s*[^\n)]+\s*\)/;
		const hasSingleLine = singleLinePattern.test(content);

		if (operator === '!=') {
			result.branches.true = hasMultiLine; // BeginLine != EndLine (true when lines differ)
			result.branches.false = hasSingleLine; // BeginLine == EndLine (false when lines are same)
			if (hasMultiLine)
				result.evidence.push(
					'Found multi-line method calls (BeginLine != EndLine) - true branch',
				);
			if (hasSingleLine)
				result.evidence.push(
					'Found single-line method calls (BeginLine == EndLine) - false branch',
				);
			// Only covered if BOTH branches are exercised
			result.covered = result.branches.true && result.branches.false;
			return result.covered;
		}
	}

	// For other attributes, we can't automatically verify both branches
	const hasTestContent = content.trim().length > 0;
	result.branches.true = false;
	result.branches.false = false;
	result.covered = false;

	if (!hasTestContent) {
		result.evidence.push(`Comparison ${expr} - no test content found`);
	} else {
		// Cannot automatically verify both branches for this comparison
		result.evidence.push(
			`Comparison ${expr} - cannot automatically verify both branches`,
		);
	}

	return result.covered;
}

/**
 * Check coverage for and operators
 */
function checkAndOperatorCoverage(conditional, content, lowerContent, result) {
	// For `and` operators, we need to check if the conditions on both sides are covered
	// Extract what comes after the `and` to understand what condition it connects
	// Use fullExpression if available (not truncated), otherwise try to extract from description
	const fullExpr =
		conditional.fullExpression ||
		(conditional.description || conditional.expression)
			.replace(/^and\s+/, '')
			.replace(/\s*\.\.\.\s*$/, '');

	// Try to extract the condition that follows the `and`
	// If we have fullExpression, use it directly; otherwise try to match from description
	const afterCondition = fullExpr.trim();

	if (!afterCondition) {
		// Could not extract condition
		result.branches.true = false;
		result.branches.false = false;
		result.covered = false;
		result.evidence.push('and operator - cannot extract condition');
		return false;
	}

	// Check if this condition is covered based on what it contains
	let isCovered = false;
	let evidenceMessage = '';

	// Check for attribute comparisons (e.g., @BeginLine != @EndLine)
	if (
		afterCondition.includes('@') &&
		(afterCondition.includes('!=') ||
			afterCondition.includes('=') ||
			afterCondition.includes('<') ||
			afterCondition.includes('>'))
	) {
		// Parse and check the specific comparison
		const attrMatch = afterCondition.match(
			/@([A-Z][a-zA-Z]*)\s*(<=|>=|!=|==|<|>)/,
		);
		if (attrMatch) {
			const attrName = attrMatch[1];
			const operator = attrMatch[2];

			// Check for patterns that would exercise this comparison
			if (attrName === 'BeginLine' && operator === '!=') {
				const hasMultiLine = /\w+\s*\(\s*\n\s*[^)]+\s*\n\s*\)/.test(
					content,
				);
				const hasSingleLine = /\w+\s*\(\s*[^\n)]+\s*\)/.test(content);
				result.branches.true = hasMultiLine; // BeginLine != EndLine (true when lines differ)
				result.branches.false = hasSingleLine; // BeginLine == EndLine (false when lines are same)
				isCovered = result.branches.true && result.branches.false;
				if (hasMultiLine)
					evidenceMessage =
						'Found multi-line code patterns (true branch)';
				if (hasSingleLine)
					evidenceMessage =
						'Found single-line code patterns (false branch)';
			} else if (attrName === 'InputParametersSize') {
				const hasZeroArgs = /\w+\s*\(\s*\)/.test(content);
				const hasOneArg =
					/\w+\s*\(\s*[^)]+\s*\)/.test(content) &&
					!/\w+\s*\(\s*[^,]+\s*,\s*[^)]+\)/.test(content);
				const hasMultipleArgs = /\w+\s*\(\s*[^,]+\s*,\s*[^)]+\)/.test(
					content,
				);
				if (operator === '<=') {
					result.branches.true = hasZeroArgs || hasOneArg; // True when args <= threshold
					result.branches.false = hasMultipleArgs; // False when args > threshold
					isCovered = result.branches.true && result.branches.false;
					if (hasZeroArgs || hasOneArg)
						evidenceMessage =
							'Found method calls with 0-1 arguments (true branch)';
					if (hasMultipleArgs)
						evidenceMessage =
							'Found method calls with 2+ arguments (false branch)';
				} else {
					// Generic - can't verify both branches
					result.branches.true = false;
					result.branches.false = false;
					isCovered = false;
					evidenceMessage = `and connects to comparison: ${afterCondition.substring(0, 40)} - cannot verify both branches`;
				}
			} else {
				// Generic - can't verify both branches automatically
				result.branches.true = false;
				result.branches.false = false;
				isCovered = false;
				evidenceMessage = `and connects to comparison: ${afterCondition.substring(0, 40)} - cannot verify both branches`;
			}
		} else {
			// Can't parse - can't verify both branches
			result.branches.true = false;
			result.branches.false = false;
			isCovered = false;
			evidenceMessage = `and connects to condition: ${afterCondition.substring(0, 40)} - cannot verify both branches`;
		}
	} else if (afterCondition.includes('not(')) {
		// Extract what's inside not() and check if it's covered
		// Handle arbitrarily nested parentheses by counting opening and closing parens
		// Also handle strings to avoid counting parens inside string literals
		let parenCount = 0;
		let startIdx = afterCondition.indexOf('not(');
		if (startIdx !== -1) {
			const notStartPos = startIdx + 4; // Position after 'not('
			let endIdx = notStartPos;
			let inString = false;
			let stringChar = null;

			for (let i = notStartPos; i < afterCondition.length; i++) {
				const char = afterCondition[i];
				const prevChar = i > 0 ? afterCondition[i - 1] : null;

				// Handle string literals
				if (!inString && (char === '"' || char === "'")) {
					inString = true;
					stringChar = char;
				} else if (
					inString &&
					char === stringChar &&
					prevChar !== '\\'
				) {
					inString = false;
					stringChar = null;
				} else if (!inString) {
					if (char === '(') parenCount++;
					else if (char === ')') {
						if (parenCount === 0) {
							endIdx = i;
							break;
						}
						parenCount--;
					}
				}
			}
			const notInner = afterCondition.substring(notStartPos, endIdx);

			// Check for node types inside not()
			// For not(), we need both branches:
			// - False branch: the condition is true (node exists)
			// - True branch: the condition is false (node doesn't exist)

			// Check for complex not() expressions with 'or' (e.g., not(.//NewListLiteralExpression or .//NewMapLiteralExpression))
			if (
				notInner.includes(' or ') &&
				(notInner.includes('NewListLiteralExpression') ||
					notInner.includes('NewMapLiteralExpression'))
			) {
				const hasListLiteral = /new\s+List\s*</.test(content);
				const hasMapLiteral = /new\s+Map\s*</.test(content);
				const hasEitherLiteral = hasListLiteral || hasMapLiteral;

				// Need substantial code without List/Map literals
				const hasMethodCalls = /\w+\s*\(/.test(content);
				const hasVariableDeclarations =
					/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(
						content,
					);
				const hasOtherCode =
					content.length > 100 &&
					(hasMethodCalls || hasVariableDeclarations);
				// Check if we have substantial code that doesn't contain List/Map literal patterns
				const contentWithoutLiterals = content
					.replace(/new\s+List\s*</g, '')
					.replace(/List\s*</g, '')
					.replace(/new\s+Map\s*</g, '')
					.replace(/Map\s*<\s*String/g, '');
				const hasNonLiteralCode =
					hasOtherCode &&
					contentWithoutLiterals.length > 100 &&
					(/\w+\s*\(/.test(contentWithoutLiterals) ||
						/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(
							contentWithoutLiterals,
						));

				result.branches.false = hasEitherLiteral; // not(hasList or hasMap) = false when either exists
				result.branches.true = hasNonLiteralCode; // not(hasList or hasMap) = true when neither exists
				isCovered = result.branches.true && result.branches.false;
				if (hasEitherLiteral) {
					if (hasListLiteral)
						evidenceMessage =
							'Found List literals (exercises false branch of not())';
					if (hasMapLiteral)
						evidenceMessage =
							'Found Map literals (exercises false branch of not())';
				}
				if (hasNonLiteralCode)
					evidenceMessage =
						'Found code without List/Map literals (exercises true branch of not())';
				if (
					!hasEitherLiteral &&
					!hasNonLiteralCode &&
					content.trim().length > 0
				) {
					evidenceMessage =
						'Cannot verify both branches - need code with and without List/Map literals';
				}
			} else if (notInner.includes('NewListLiteralExpression')) {
				const hasListLiteral = /new\s+List\s*</.test(content);
				// Need substantial code without List literals
				const hasMethodCalls = /\w+\s*\(/.test(content);
				const hasVariableDeclarations =
					/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(
						content,
					);
				const hasOtherCode =
					content.length > 100 &&
					(hasMethodCalls || hasVariableDeclarations);
				// Check if we have substantial code that doesn't contain List literal patterns
				const contentWithoutList = content
					.replace(/new\s+List\s*</g, '')
					.replace(/List\s*</g, '');
				const hasNonListCode =
					hasOtherCode &&
					contentWithoutList.length > 100 &&
					(/\w+\s*\(/.test(contentWithoutList) ||
						/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(
							contentWithoutList,
						));

				result.branches.false = hasListLiteral; // not(hasList) = false when hasList is true
				result.branches.true = hasNonListCode; // not(hasList) = true when hasList is false
				isCovered = result.branches.true && result.branches.false;
				if (hasListLiteral)
					evidenceMessage =
						'Found List literals (exercises false branch of not())';
				if (hasNonListCode)
					evidenceMessage =
						'Found code without List literals (exercises true branch of not())';
				if (
					!hasListLiteral &&
					!hasNonListCode &&
					content.trim().length > 0
				) {
					evidenceMessage =
						'Cannot verify both branches - need code with and without List literals';
				}
			} else if (notInner.includes('NewMapLiteralExpression')) {
				const hasMapLiteral = /new\s+Map\s*</.test(content);
				// Need substantial code without Map literals
				const hasMethodCalls = /\w+\s*\(/.test(content);
				const hasVariableDeclarations =
					/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(
						content,
					);
				const hasOtherCode =
					content.length > 100 &&
					(hasMethodCalls || hasVariableDeclarations);
				// Check if we have substantial code that doesn't contain Map literal patterns
				const contentWithoutMap = content
					.replace(/new\s+Map\s*</g, '')
					.replace(/Map\s*<\s*String/g, '');
				const hasNonMapCode =
					hasOtherCode &&
					contentWithoutMap.length > 100 &&
					(/\w+\s*\(/.test(contentWithoutMap) ||
						/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(
							contentWithoutMap,
						));

				result.branches.false = hasMapLiteral; // not(hasMap) = false when hasMap is true
				result.branches.true = hasNonMapCode; // not(hasMap) = true when hasMap is false
				isCovered = result.branches.true && result.branches.false;
				if (hasMapLiteral)
					evidenceMessage =
						'Found Map literals (exercises false branch of not())';
				if (hasNonMapCode)
					evidenceMessage =
						'Found code without Map literals (exercises true branch of not())';
				if (
					!hasMapLiteral &&
					!hasNonMapCode &&
					content.trim().length > 0
				) {
					evidenceMessage =
						'Cannot verify both branches - need code with and without Map literals';
				}
			} else {
				// Generic not() condition - try to extract node types
				// Check for union patterns like: ReferenceExpression[1]/(MethodCallExpression | NewObjectExpression)
				if (notInner.includes('/(') && notInner.includes('|')) {
					const unionMatch = notInner.match(
						/([A-Z][a-zA-Z]*)\[.*?\]\/\(([A-Z][a-zA-Z]*)\s*\|\s*([A-Z][a-zA-Z]*)/,
					);
					if (unionMatch) {
						const parentType = unionMatch[1];
						const branch1 = unionMatch[2];
						const branch2 = unionMatch[3];

						// Check for both branches using the same logic as the main check
						const methodCallWithMethodCall =
							/\w+\s*\(\s*[a-zA-Z_]\w*\s*\(/.test(content);
						const methodCallWithNewObject =
							/\w+\s*\(\s*new\s+[A-Z]\w*/.test(content);
						const hasPattern =
							methodCallWithMethodCall || methodCallWithNewObject;

						const simpleVarPattern =
							/\w+\s*\(\s*[a-zA-Z_]\w*\s*\)/.test(content);
						const literalArgPattern =
							/\w+\s*\(\s*['"]/.test(content) ||
							/\w+\s*\(\s*\d+/.test(content);
						const hasNonPattern =
							(simpleVarPattern &&
								!methodCallWithMethodCall &&
								!methodCallWithNewObject) ||
							(literalArgPattern && content.length > 100);

						result.branches.false = hasPattern;
						result.branches.true = hasNonPattern;
						isCovered =
							result.branches.true && result.branches.false;

						if (hasPattern) {
							if (methodCallWithMethodCall) {
								evidenceMessage = `Found method calls with ${branch1} as first argument (exercises false branch of not())`;
							}
							if (methodCallWithNewObject) {
								evidenceMessage = `Found method calls with ${branch2} as first argument (exercises false branch of not())`;
							}
						}
						if (hasNonPattern) {
							if (
								simpleVarPattern &&
								!methodCallWithMethodCall &&
								!methodCallWithNewObject
							) {
								evidenceMessage = `Found method calls with simple variable as first argument (exercises true branch of not())`;
							}
							if (literalArgPattern) {
								evidenceMessage = `Found method calls with literal as first argument (exercises true branch of not())`;
							}
						}
					} else {
						// Can't parse - can't verify both branches
						result.branches.true = false;
						result.branches.false = false;
						isCovered = false;
						evidenceMessage =
							'and connects to not() condition - cannot verify both branches (parsing failed)';
					}
				} else {
					const nodeTypeMatch = notInner.match(
						/([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Node|Block))/,
					);
					if (nodeTypeMatch) {
						const nodeType = nodeTypeMatch[1];
						const nodeTypeLower = nodeType
							.toLowerCase()
							.replace(/expression|statement|declaration/g, '');
						const hasNodeType =
							lowerContent.includes(nodeTypeLower) ||
							content.includes(nodeType);
						const hasNonNodeCode =
							!hasNodeType && content.trim().length > 0;

						result.branches.false = hasNodeType; // not(hasNode) = false when hasNode is true
						result.branches.true = hasNonNodeCode; // not(hasNode) = true when hasNode is false
						isCovered =
							result.branches.true && result.branches.false;
						if (hasNodeType)
							evidenceMessage = `Found ${nodeType} in content (exercises false branch of not())`;
						if (hasNonNodeCode)
							evidenceMessage = `No ${nodeType} found (exercises true branch of not())`;
					} else {
						// Check for union patterns like: ReferenceExpression[1]/(MethodCallExpression | NewObjectExpression)
						if (notInner.includes('/(') && notInner.includes('|')) {
							const unionMatch = notInner.match(
								/([A-Z][a-zA-Z]*)\[.*?\]\/\(([A-Z][a-zA-Z]*)\s*\|\s*([A-Z][a-zA-Z]*)/,
							);
							if (unionMatch) {
								const parentType = unionMatch[1];
								const branch1 = unionMatch[2];
								const branch2 = unionMatch[3];

								// Check for both branches
								const methodCallWithMethodCall =
									/\w+\s*\(\s*[a-zA-Z_]\w*\s*\(/.test(
										content,
									);
								const methodCallWithNewObject =
									/\w+\s*\(\s*new\s+[A-Z]\w*/.test(content);
								const hasPattern =
									methodCallWithMethodCall ||
									methodCallWithNewObject;

								const simpleVarPattern =
									/\w+\s*\(\s*[a-zA-Z_]\w*\s*\)/.test(
										content,
									);
								const literalArgPattern =
									/\w+\s*\(\s*['"]/.test(content) ||
									/\w+\s*\(\s*\d+/.test(content);
								const hasNonPattern =
									(simpleVarPattern &&
										!methodCallWithMethodCall &&
										!methodCallWithNewObject) ||
									(literalArgPattern && content.length > 100);

								result.branches.false = hasPattern;
								result.branches.true = hasNonPattern;
								isCovered =
									result.branches.true &&
									result.branches.false;

								if (hasPattern) {
									evidenceMessage = `Found method calls with ${branch1} or ${branch2} as first argument (exercises false branch of not())`;
								}
								if (hasNonPattern) {
									evidenceMessage = `Found method calls without ${branch1} or ${branch2} as first argument (exercises true branch of not())`;
								}
							} else {
								// Can't parse - can't verify both branches
								result.branches.true = false;
								result.branches.false = false;
								isCovered = false;
								evidenceMessage =
									'and connects to not() condition - cannot verify both branches (parsing failed)';
							}
						} else {
							// Can't parse - can't verify both branches
							result.branches.true = false;
							result.branches.false = false;
							isCovered = false;
							evidenceMessage =
								'and connects to not() condition - cannot verify both branches';
						}
					}
				}
			}
		} else {
			// Could not extract not() condition properly
			result.branches.true = false;
			result.branches.false = false;
			isCovered = false;
			evidenceMessage =
				'and connects to not() condition - cannot extract condition';
		}
	} else {
		// Generic - can't verify both branches automatically
		result.branches.true = false;
		result.branches.false = false;
		isCovered = false;
		evidenceMessage = `and connects condition - cannot verify both branches`;
	}

	if (evidenceMessage) {
		result.evidence.push(evidenceMessage);
	}
	// For `and` operators, both branches are checked above for not() conditions
	// For other conditions, we need both branches: true (both sides true) and false (at least one side false)
	if (
		result.branches.true !== undefined &&
		result.branches.false !== undefined
	) {
		// Already set by not() condition checking
		result.covered = result.branches.true && result.branches.false;
	} else {
		// For other `and` conditions, we can't easily verify both branches automatically
		result.branches.true = isCovered;
		result.branches.false = false; // Can't automatically verify false branch for `and`
		result.covered = false; // Not fully covered without both branches
	}
	return result.covered;

	// If we can't parse the condition, we can't verify both branches
	result.branches.true = content.trim().length > 0;
	result.branches.false = false;
	result.covered = false;
	if (!result.branches.true) {
		result.evidence.push('and operator - no test content found');
	} else {
		result.evidence.push(
			'and operator - cannot automatically verify both branches',
		);
	}
	return result.covered;
}

/**
 * Check coverage for not() conditions
 */
function checkNotConditionCoverage(conditional, content, lowerContent, result) {
	const expr = conditional.expression;

	// Check if the condition inside not() is both present (false branch of not)
	// and absent (true branch of not)
	// For .//NewListLiteralExpression, check for List literals
	if (expr.includes('NewListLiteralExpression')) {
		const hasListLiteral =
			/new\s+List\s*</.test(content) || /List\s*</.test(content);
		// Check for code without List literals to exercise true branch
		// Need substantial code that doesn't contain List literals
		const hasMethodCalls = /\w+\s*\(/.test(content);
		const hasVariableDeclarations =
			/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(content);
		const hasOtherCode =
			content.length > 100 && (hasMethodCalls || hasVariableDeclarations);
		// Check if we have substantial code that doesn't contain List literal patterns
		const contentWithoutList = content
			.replace(/new\s+List\s*</g, '')
			.replace(/List\s*</g, '');
		const hasNonListCode =
			hasOtherCode &&
			contentWithoutList.length > 100 &&
			(/\w+\s*\(/.test(contentWithoutList) ||
				/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(
					contentWithoutList,
				));

		result.branches.false = hasListLiteral; // not(hasList) = false when hasList is true
		result.branches.true = hasNonListCode; // not(hasList) = true when hasList is false
		if (hasListLiteral)
			result.evidence.push(
				'Found List literals (exercises false branch)',
			);
		if (hasNonListCode)
			result.evidence.push(
				'Found code without List literals (exercises true branch)',
			);
		if (!hasListLiteral && !hasNonListCode && content.trim().length > 0) {
			result.evidence.push(
				'Cannot verify both branches - need code with and without List literals',
			);
		}
		// Only covered if BOTH branches are exercised
		result.covered = result.branches.true && result.branches.false;
		return result.covered;
	}

	// For .//NewMapLiteralExpression
	if (expr.includes('NewMapLiteralExpression')) {
		const hasMapLiteral =
			/new\s+Map\s*</.test(content) || /Map\s*<\s*String/.test(content);
		// Check for code without Map literals to exercise true branch
		// Need substantial code that doesn't contain Map literals
		const hasMethodCalls = /\w+\s*\(/.test(content);
		const hasVariableDeclarations =
			/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(content);
		const hasOtherCode =
			content.length > 100 && (hasMethodCalls || hasVariableDeclarations);
		// Check if we have substantial code that doesn't contain Map literal patterns
		const contentWithoutMap = content
			.replace(/new\s+Map\s*</g, '')
			.replace(/Map\s*<\s*String/g, '');
		const hasNonMapCode =
			hasOtherCode &&
			contentWithoutMap.length > 100 &&
			(/\w+\s*\(/.test(contentWithoutMap) ||
				/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(
					contentWithoutMap,
				));

		result.branches.false = hasMapLiteral; // not(hasMap) = false when hasMap is true
		result.branches.true = hasNonMapCode; // not(hasMap) = true when hasMap is false
		if (hasMapLiteral)
			result.evidence.push('Found Map literals (exercises false branch)');
		if (hasNonMapCode)
			result.evidence.push(
				'Found code without Map literals (exercises true branch)',
			);
		if (!hasMapLiteral && !hasNonMapCode && content.trim().length > 0) {
			result.evidence.push(
				'Cannot verify both branches - need code with and without Map literals',
			);
		}
		// Only covered if BOTH branches are exercised
		result.covered = result.branches.true && result.branches.false;
		return result.covered;
	}

	// For not() with union conditions like: not(ReferenceExpression[1]/(MethodCallExpression | NewObjectExpression))
	// Check if the union pattern exists
	if (expr.includes('/(') && expr.includes('|')) {
		const unionMatch = expr.match(
			/([A-Z][a-zA-Z]*)\[.*?\]\/\(([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Node|Block))\s*\|\s*([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Node|Block))/,
		);
		if (unionMatch) {
			const parentType = unionMatch[1]; // e.g., ReferenceExpression
			const branch1 = unionMatch[2]; // e.g., MethodCallExpression
			const branch2 = unionMatch[3]; // e.g., NewObjectExpression

			// Check if we have code matching this pattern
			// For not(ReferenceExpression[1]/(MethodCallExpression | NewObjectExpression)):
			// - False branch: First argument is MethodCallExpression or NewObjectExpression (e.g., processValue(getId()) or processValue(new MyClass()))
			// - True branch: First argument is NOT MethodCallExpression or NewObjectExpression (e.g., processValue(id) where id is a simple variable)
			// We need both: code with the pattern AND code without the pattern
			// Check for method calls where first argument is a method call or new object
			const methodCallWithMethodCall =
				/\w+\s*\(\s*[a-zA-Z_]\w*\s*\(/.test(content); // e.g., processValue(getId())
			const methodCallWithNewObject = /\w+\s*\(\s*new\s+[A-Z]\w*/.test(
				content,
			); // e.g., processValue(new MyClass())
			const hasPattern =
				methodCallWithMethodCall || methodCallWithNewObject;

			// Check for method calls where first argument is a simple variable (not a method call or new object)
			// Match patterns like: processValue(id), calculate(num), updateUser(name) where the argument is a simple identifier
			const simpleVarPattern = /\w+\s*\(\s*[a-zA-Z_]\w*\s*\)/.test(
				content,
			); // Method call with simple identifier as arg
			const hasSimpleVar =
				simpleVarPattern &&
				!methodCallWithMethodCall &&
				!methodCallWithNewObject;

			// Also check for method calls with string/number literals as arguments (not method calls or new objects)
			const literalArgPattern =
				/\w+\s*\(\s*['"]/.test(content) ||
				/\w+\s*\(\s*\d+/.test(content); // Method call with string/number literal

			// True branch: method calls with simple variables or literals (not method calls or new objects)
			const hasNonPattern =
				(hasSimpleVar || literalArgPattern) && content.length > 100;

			result.branches.false = hasPattern; // not(pattern) = false when pattern exists
			result.branches.true = hasNonPattern; // not(pattern) = true when pattern doesn't exist

			if (hasPattern) {
				if (methodCallWithMethodCall) {
					result.evidence.push(
						`Found method calls with method call as first argument (e.g., processValue(getId())) - exercises false branch of not()`,
					);
				}
				if (methodCallWithNewObject) {
					result.evidence.push(
						`Found method calls with new object as first argument (e.g., processValue(new MyClass())) - exercises false branch of not()`,
					);
				}
			}
			if (hasNonPattern) {
				if (hasSimpleVar) {
					result.evidence.push(
						`Found method calls with simple variable as first argument (e.g., processValue(id)) - exercises true branch of not()`,
					);
				}
				if (literalArgPattern) {
					result.evidence.push(
						`Found method calls with literal as first argument (e.g., processValue('123')) - exercises true branch of not()`,
					);
				}
			}
			if (!hasPattern && !hasNonPattern && content.trim().length > 0) {
				// We have test content but can't verify both branches
				result.evidence.push(
					`Cannot verify both branches for ${parentType} union pattern`,
				);
			}

			// Only covered if BOTH branches are exercised
			result.covered = result.branches.true && result.branches.false;
			return result.covered;
		}
	}

	// For not() with or conditions like: not(.//NewListLiteralExpression or .//NewMapLiteralExpression)
	// We need both branches:
	// - False branch: either NewListLiteralExpression OR NewMapLiteralExpression exists
	// - True branch: neither NewListLiteralExpression nor NewMapLiteralExpression exists (and we have other code)
	if (expr.includes(' or ')) {
		const orParts = expr.split(/\s+or\s+/);
		let hasAnyNodeType = false;
		const foundTypes = [];
		const allTypes = [];

		orParts.forEach((part) => {
			const nodeTypeMatch = part.match(
				/([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Node|Block))/,
			);
			if (nodeTypeMatch) {
				const nodeType = nodeTypeMatch[1];
				allTypes.push(nodeType);
				const nodeTypeLower = nodeType
					.toLowerCase()
					.replace(/expression|statement|declaration/g, '');

				// Check for specific patterns in code
				if (nodeType.includes('NewListLiteralExpression')) {
					const hasListLiteral = /new\s+List\s*</.test(content);
					if (hasListLiteral) {
						hasAnyNodeType = true;
						foundTypes.push(nodeType);
					}
				} else if (nodeType.includes('NewMapLiteralExpression')) {
					const hasMapLiteral = /new\s+Map\s*</.test(content);
					if (hasMapLiteral) {
						hasAnyNodeType = true;
						foundTypes.push(nodeType);
					}
				} else {
					const hasNodeType =
						lowerContent.includes(nodeTypeLower) ||
						content.includes(nodeType);
					if (hasNodeType) {
						hasAnyNodeType = true;
						foundTypes.push(nodeType);
					}
				}
			}
		});

		// Check for code without any of these node types (true branch)
		// We need substantial code that doesn't contain these types
		// Even if List/Map literals exist elsewhere, we need to verify we have substantial code without them
		const hasMethodCalls = /\w+\s*\(/.test(content);
		const hasVariableDeclarations =
			/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(content);
		const hasOtherCode =
			content.length > 100 && (hasMethodCalls || hasVariableDeclarations);
		// Check if we have substantial code that doesn't contain List/Map literal patterns
		// Split content to check for sections without List/Map literals
		const contentWithoutListMap = content
			.replace(/new\s+List\s*</g, '')
			.replace(/new\s+Map\s*</g, '')
			.replace(/Map\s*<\s*String/g, '');
		const hasNonNodeCode =
			hasOtherCode &&
			contentWithoutListMap.length > 100 &&
			(/\w+\s*\(/.test(contentWithoutListMap) ||
				/(String|Integer|Boolean|List|Map|Set)\s+\w+\s*=/.test(
					contentWithoutListMap,
				));

		result.branches.false = hasAnyNodeType; // not(or condition) = false when any node type exists
		result.branches.true = hasNonNodeCode; // not(or condition) = true when no node types exist

		if (hasAnyNodeType) {
			result.evidence.push(
				`Found ${foundTypes.join(' or ')} in content (exercises false branch of not())`,
			);
		}
		if (hasNonNodeCode) {
			result.evidence.push(
				`Found code without ${allTypes.join(' or ')} (exercises true branch of not())`,
			);
		}
		if (!hasAnyNodeType && !hasNonNodeCode && content.trim().length > 0) {
			result.evidence.push(
				`Cannot verify both branches - need code with and without ${allTypes.join(' or ')}`,
			);
		}

		// Only covered if BOTH branches are exercised
		result.covered = result.branches.true && result.branches.false;
		return result.covered;
	}

	// Generic check - try to parse the expression and check for coverage
	// Extract node types or patterns from the expression
	const nodeTypeMatch = expr.match(
		/([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Node|Block))/,
	);
	if (nodeTypeMatch) {
		const nodeType = nodeTypeMatch[1];
		// Check if this node type appears in the content
		const nodeTypeLower = nodeType
			.toLowerCase()
			.replace(/expression|statement|declaration/g, '');
		const hasNodeType =
			lowerContent.includes(nodeTypeLower) || content.includes(nodeType);
		const hasNonNodeCode = !hasNodeType && content.trim().length > 0;

		result.branches.false = hasNodeType; // not(hasNode) = false when hasNode is true
		result.branches.true = hasNonNodeCode; // not(hasNode) = true when hasNode is false

		if (hasNodeType) {
			result.evidence.push(
				`Found ${nodeType} in content (exercises false branch of not())`,
			);
		}
		if (hasNonNodeCode) {
			result.evidence.push(
				`No ${nodeType} found (exercises true branch of not())`,
			);
		}
		if (!hasNodeType && content.trim().length === 0) {
			result.evidence.push(`not(${nodeType}) - no test content found`);
		}

		// Only covered if BOTH branches are exercised
		result.covered = result.branches.true && result.branches.false;
		return result.covered;
	}

	// If we can't parse, we can't verify both branches
	result.branches.true = false;
	result.branches.false = false;
	result.covered = false;
	if (content.trim().length === 0) {
		result.evidence.push(
			`not(${expr.substring(0, 50)}) - no test content found`,
		);
	} else {
		result.evidence.push(
			`not(${expr.substring(0, 50)}) - cannot verify both branches (parsing failed)`,
		);
	}
	return result.covered;
}

/**
 * Check coverage for or branches
 */
function checkOrBranchCoverage(conditional, content, lowerContent, result) {
	const expr = conditional.expression || conditional.description;
	const nodeType = expr
		.replace(/^\.\/\//, '')
		.replace(/\s+or\s+.*$/, '')
		.trim();

	// Check if this node type appears in the content
	// For or branches, we need to check both:
	// - True branch: this branch is taken (node type exists)
	// - False branch: other branch is taken (this node type doesn't exist, but other does)
	if (nodeType.includes('NewListLiteralExpression')) {
		const hasListLiteral = /new\s+List\s*</.test(content);
		const hasMapLiteral = /new\s+Map\s*</.test(content);
		result.branches.true = hasListLiteral; // This branch taken
		result.branches.false = hasMapLiteral; // Other branch taken
		if (hasListLiteral)
			result.evidence.push('Found List literals (true branch)');
		if (hasMapLiteral)
			result.evidence.push(
				'Found Map literals (other branch, false branch)',
			);
		result.covered = result.branches.true && result.branches.false;
		return result.covered;
	}

	if (nodeType.includes('NewMapLiteralExpression')) {
		const hasMapLiteral = /new\s+Map\s*</.test(content);
		const hasListLiteral = /new\s+List\s*</.test(content);
		result.branches.true = hasMapLiteral; // This branch taken
		result.branches.false = hasListLiteral; // Other branch taken
		if (hasMapLiteral)
			result.evidence.push('Found Map literals (true branch)');
		if (hasListLiteral)
			result.evidence.push(
				'Found List literals (other branch, false branch)',
			);
		result.covered = result.branches.true && result.branches.false;
		return result.covered;
	}

	// Generic check - look for the node type name in content
	// Can't automatically verify both branches for generic cases
	const nodeTypeLower = nodeType
		.toLowerCase()
		.replace(/expression|statement|declaration/g, '');
	result.branches.true =
		lowerContent.includes(nodeTypeLower) || content.includes(nodeType);
	result.branches.false = false; // Can't automatically verify false branch
	result.covered = false;
	if (result.branches.true)
		result.evidence.push(`Found ${nodeType} in content`);
	else
		result.evidence.push(
			`No ${nodeType} found - cannot verify both branches`,
		);
	return result.covered;
}

/**
 * Check coverage for union branches (|)
 */
function checkUnionBranchCoverage(conditional, content, lowerContent, result) {
	const expr = conditional.expression || conditional.description;
	const nodeType = expr.trim();

	// Check if this node type appears in the content
	// For union branches, we need to check both:
	// - True branch: this branch is taken (node type exists)
	// - False branch: other branch is taken (this node type doesn't exist, but other does)
	if (nodeType.includes('MethodCallExpression')) {
		const hasMethodCall = /\w+\s*\(/.test(content);
		const hasNewObject = /new\s+\w+/.test(content);
		result.branches.true = hasMethodCall; // This branch taken
		result.branches.false = hasNewObject; // Other branch taken
		if (hasMethodCall)
			result.evidence.push('Found method calls (true branch)');
		if (hasNewObject)
			result.evidence.push(
				'Found new object expressions (other branch, false branch)',
			);
		result.covered = result.branches.true && result.branches.false;
		return result.covered;
	}

	if (nodeType.includes('NewObjectExpression')) {
		const hasNewObject = /new\s+\w+/.test(content);
		const hasMethodCall = /\w+\s*\(/.test(content);
		result.branches.true = hasNewObject; // This branch taken
		result.branches.false = hasMethodCall; // Other branch taken
		if (hasNewObject)
			result.evidence.push('Found new object expressions (true branch)');
		if (hasMethodCall)
			result.evidence.push(
				'Found method calls (other branch, false branch)',
			);
		result.covered = result.branches.true && result.branches.false;
		return result.covered;
	}

	// Generic check - can't automatically verify both branches
	const nodeTypeLower = nodeType.toLowerCase();
	result.branches.true =
		lowerContent.includes(nodeTypeLower) || content.includes(nodeType);
	result.branches.false = false; // Can't automatically verify false branch
	result.covered = false;
	if (result.branches.true)
		result.evidence.push(`Found ${nodeType} in content`);
	else
		result.evidence.push(
			`No ${nodeType} found - cannot verify both branches`,
		);
	return result.covered;
}

/**
 * Check coverage for if-then-else conditions
 */
function checkIfConditionCoverage(conditional, content, lowerContent, result) {
	// For if-then-else in XPath, we need to check if both branches are exercised
	// This requires understanding what the condition is and checking for both true/false cases
	const expr = conditional.expression || '';

	// Try to extract the condition
	const conditionMatch = expr.match(/if\s*\((.*?)\)/);
	if (conditionMatch) {
		const condition = conditionMatch[1].trim();

		// Check if we have code that would exercise both branches
		// This is complex - we need to understand what would make the condition true/false
		// For if-then-else, we need both branches covered
		// This is difficult to verify automatically, so we mark as not fully covered
		const hasTestContent = content.trim().length > 0;

		result.branches.true = false;
		result.branches.false = false;
		result.covered = false;

		if (hasTestContent) {
			result.evidence.push(
				`if-then-else conditional - cannot automatically verify both branches`,
			);
		} else {
			result.evidence.push(
				`if-then-else conditional - no test content found`,
			);
		}

		return result.covered;
	}

	// If we can't parse, we can't verify both branches
	result.branches.true = false;
	result.branches.false = false;
	result.covered = false;
	const hasTestContent = content.trim().length > 0;
	if (!hasTestContent) {
		result.evidence.push(
			'if-then-else conditional - no test content found',
		);
	} else {
		result.evidence.push(
			'if-then-else conditional - cannot automatically verify both branches (parsing failed)',
		);
	}
	return result.covered;
}

/**
 * Check coverage for quantified conditions (some/every)
 */
function checkQuantifiedConditionCoverage(
	conditional,
	content,
	lowerContent,
	result,
) {
	// For some/every, we need to check if the condition is exercised
	// Extract what's being checked in the quantifier
	const expr = conditional.expression || '';
	const quantifier = conditional.type.replace('_condition', '');

	// Try to extract the sequence and condition
	const sequenceMatch = expr.match(/\$\w+\s+in\s+(.+?)\s+satisfies/);
	const conditionMatch = expr.match(/satisfies\s+(.+?)$/);

	const hasTestContent = content.trim().length > 0;

	if (sequenceMatch && conditionMatch) {
		const sequence = sequenceMatch[1].trim();
		const condition = conditionMatch[1].trim();

		// Check if we have code that would exercise this
		// This is complex - we'd need to understand what the sequence is and what satisfies it
		// Can't automatically verify both branches for quantified expressions
		result.branches.true = false;
		result.branches.false = false;
		result.covered = false;

		if (hasTestContent) {
			result.evidence.push(
				`${quantifier} $x in ${sequence} satisfies ${condition.substring(0, 30)} - cannot automatically verify both branches`,
			);
		} else {
			result.evidence.push(
				`${quantifier} $x in ${sequence} satisfies ${condition.substring(0, 30)} - no test content found`,
			);
		}

		return result.covered;
	}

	// If we can't parse, we can't verify both branches
	result.branches.true = false;
	result.branches.false = false;
	result.covered = false;
	if (!hasTestContent) {
		result.evidence.push(
			`${quantifier} conditional - no test content found`,
		);
	} else {
		result.evidence.push(
			`${quantifier} conditional - cannot automatically verify both branches (parsing failed)`,
		);
	}
	return result.covered;
}

/**
 * Check coverage for boolean function conditions (exists/empty)
 */
function checkBooleanFunctionCoverage(
	conditional,
	content,
	lowerContent,
	result,
) {
	const funcName = conditional.type.replace('_condition', '');
	const expr = conditional.expression || '';

	// Extract what's being checked in exists()/empty()
	const innerMatch = expr.match(/(.*?)(?:\s*or\s*|$)/);
	let innerExpr = innerMatch ? innerMatch[1].trim() : expr.trim();

	// Remove leading .// or //
	innerExpr = innerExpr.replace(/^(\.\/\/|\/\/)/, '').trim();

	// Extract node type if present
	const nodeTypeMatch = innerExpr.match(
		/([A-Z][a-zA-Z]*(?:Expression|Statement|Declaration|Node|Block))/,
	);

	const hasTestContent = content.trim().length > 0;

	if (nodeTypeMatch) {
		const nodeType = nodeTypeMatch[1];
		const nodeTypeLower = nodeType
			.toLowerCase()
			.replace(/expression|statement|declaration/g, '');
		const hasNodeType =
			lowerContent.includes(nodeTypeLower) || content.includes(nodeType);

		// For exists(), true when node exists; false when it doesn't
		// For empty(), true when sequence is empty; false when it's not
		if (funcName === 'exists') {
			result.branches.true = hasNodeType; // exists() = true when node exists
			result.branches.false = !hasNodeType && hasTestContent; // exists() = false when node doesn't exist

			if (hasNodeType) {
				result.evidence.push(
					`exists(${nodeType}) - found ${nodeType} in content (true branch)`,
				);
			}
			if (!hasNodeType && hasTestContent) {
				result.evidence.push(
					`exists(${nodeType}) - no ${nodeType} found (false branch)`,
				);
			}
		} else if (funcName === 'empty') {
			result.branches.true = !hasNodeType && hasTestContent; // empty() = true when sequence is empty
			result.branches.false = hasNodeType; // empty() = false when sequence is not empty

			if (!hasNodeType && hasTestContent) {
				result.evidence.push(
					`empty(${nodeType}) - no ${nodeType} found (true branch)`,
				);
			}
			if (hasNodeType) {
				result.evidence.push(
					`empty(${nodeType}) - found ${nodeType} in content (false branch)`,
				);
			}
		}

		if (!hasNodeType && !hasTestContent) {
			result.evidence.push(
				`${funcName}(${nodeType}) - no test content found`,
			);
		}

		// Only covered if BOTH branches are exercised
		result.covered = result.branches.true && result.branches.false;
		return result.covered;
	}

	// If we can't parse, we can't verify both branches
	result.branches.true = false;
	result.branches.false = false;
	result.covered = false;
	if (!hasTestContent) {
		result.evidence.push(
			`${funcName}() conditional - no test content found`,
		);
	} else {
		result.evidence.push(
			`${funcName}() conditional - cannot automatically verify both branches (parsing failed)`,
		);
	}
	return result.covered;
}

/**
 * Run PMD CLI against an Apex file with a ruleset
 *
 * @param {string} rulesetPath - Path to the PMD ruleset XML file
 * @param {string} apexFilePath - Path to the Apex file to test
 * @returns {Promise<Array>} Array of violations
 */
async function runPMD(rulesetPath, apexFilePath) {
	// Get absolute paths for better compatibility
	const absoluteApexPath = path.isAbsolute(apexFilePath)
		? apexFilePath
		: path.resolve(process.cwd(), apexFilePath);
	const absoluteRulesetPath = path.isAbsolute(rulesetPath)
		? rulesetPath
		: path.resolve(process.cwd(), rulesetPath);

	try {
		// Use execFileSync instead of execSync to prevent command injection
		// Arguments are passed as an array, avoiding shell interpretation of special characters
		// Use --no-cache to avoid cache issues
		// Use --no-progress to disable progress bar
		// Capture both stdout and stderr
		const result = execFileSync(
			'pmd',
			[
				'check',
				'--no-cache',
				'--no-progress',
				'-d',
				absoluteApexPath,
				'-R',
				absoluteRulesetPath,
				'-f',
				'xml',
			],
			{
				encoding: 'utf-8',
				timeout: 30000,
				stdio: ['pipe', 'pipe', 'pipe'], // Capture stdout, stderr, and stdin
				cwd: process.cwd(),
			},
		);

		// PMD outputs XML to stdout when using -f xml without -r
		return parseViolations(result);
	} catch (error) {
		// PMD may exit with non-zero if violations found, but still output XML
		// Check if stdout contains XML data
		if (error.stdout) {
			try {
				const xmlMatch = error.stdout.match(/<\?xml[\s\S]*$/);
				if (xmlMatch) {
					return parseViolations(xmlMatch[0]);
				}
				return parseViolations(error.stdout);
			} catch {
				// If we can't parse stdout, fall through to throw the original error
			}
		}

		// PMD CLI is required - throw error if not available
		if (error.code === 'ENOENT') {
			throw new Error(
				'PMD CLI not available. Please install PMD to run tests. Visit: https://pmd.github.io/pmd/pmd_userdocs_installation.html',
			);
		}

		// If there's stderr or stdout, include it in the error message for debugging
		const stderr = error.stderr
			? `\nPMD stderr:\n${error.stderr.toString()}`
			: '';
		const stdout = error.stdout
			? `\nPMD stdout:\n${error.stdout.toString()}`
			: '';
		throw new Error(
			`Error running PMD CLI: ${error.message}${stderr}${stdout}`,
		);
	}
}

/**
 * Parse PMD XML output into violation objects
 * @param {string} xmlOutput - XML output from PMD
 * @returns {Array} Array of violation objects
 */
function parseViolations(xmlOutput) {
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(xmlOutput, 'text/xml');
		const violations = [];

		// PMD format (<pmd><file><violation>)
		const fileNodes = doc.getElementsByTagName('file');
		for (let i = 0; i < fileNodes.length; i++) {
			const fileNode = fileNodes[i];
			const violationNodes = fileNode.getElementsByTagName('violation');

			for (let j = 0; j < violationNodes.length; j++) {
				const violationNode = violationNodes[j];
				violations.push({
					file: fileNode.getAttribute('name'),
					rule: violationNode.getAttribute('rule'),
					message:
						violationNode.getAttribute('message') ||
						violationNode.textContent.trim(),
					line: parseInt(violationNode.getAttribute('beginline'), 10),
					column: parseInt(
						violationNode.getAttribute('begincol'),
						10,
					),
				});
			}
		}

		return violations;
	} catch (error) {
		throw new Error(`Error parsing XML output: ${error.message}`);
	}
}

/**
 * Standalone script to test PMD rules using examples embedded in the rule file
 *
 * Usage:
 *   node scripts/test-rule-coverage.js <rule.xml>
 *
 * This script:
 * 1. Extracts examples from the PMD rule XML file
 * 2. Creates temporary test files from the examples
 * 3. Runs PMD directly (no temporary output files needed)
 * 4. Validates that violations occur for "// Violation:" examples and don't occur for "// Valid:" examples
 * 5. Ensures violations ONLY occur on lines following "// Violation: ..." comments
 * 6. Ensures no violations occur on lines following "// Valid: ..." comments
 * 7. Analyzes XPath coverage to ensure test files exercise the rule's AST node types
 * 8. Ensures the rule triggers at least one violation overall (catches broken/ineffective rules)
 * 9. Reports comprehensive test coverage results including XPath coverage metrics
 */

class RuleTester {
	constructor(ruleFilePath) {
		this.ruleFilePath = path.resolve(ruleFilePath);
		this.ruleName = path.basename(ruleFilePath, '.xml');
		this.category = path.basename(path.dirname(ruleFilePath));
		this.tempFiles = [];
		this.results = {
			examples: [],
			testResults: [],
			xpathCoverage: null,
			hardcodedValues: null,
			qualityChecks: {
				passed: true,
				issues: [],
				warnings: [], // Warnings that don't fail tests
			},
			exampleBranchCombinations: [], // Track branch combinations per example
			overallSuccess: false,
		};
		// Extract rule metadata
		this.ruleMetadata = this.extractRuleMetadata();
	}

	/**
	 * Extract examples from the rule XML file for display purposes
	 */
	extractExamples() {
		try {
			const content = fs.readFileSync(this.ruleFilePath, 'utf-8');
			const parser = new DOMParser();
			const doc = parser.parseFromString(content, 'text/xml');

			const examples = [];
			const exampleNodes = doc.getElementsByTagName('example');

			for (let i = 0; i < exampleNodes.length; i++) {
				const exampleNode = exampleNodes[i];
				const cdata = exampleNode.textContent.trim();
				if (cdata) {
					examples.push(cdata);
				}
			}

			return examples;
		} catch (error) {
			console.warn(
				`Warning: Could not extract examples from rule file: ${error.message}`,
			);
			return [];
		}
	}

	/**
	 * Extract rule metadata from XML file
	 */
	extractRuleMetadata() {
		try {
			const content = fs.readFileSync(this.ruleFilePath, 'utf-8');
			const parser = new DOMParser();
			const doc = parser.parseFromString(content, 'text/xml');

			const ruleElement = doc.getElementsByTagName('rule')[0];
			if (!ruleElement) {
				return {
					ruleName: null,
					message: null,
					description: null,
					xpath: null,
				};
			}

			const ruleName = ruleElement.getAttribute('name') || null;
			const message = ruleElement.getAttribute('message') || null;

			const descriptionNode =
				ruleElement.getElementsByTagName('description')[0];
			const description = descriptionNode
				? descriptionNode.textContent.trim()
				: null;

			const xpath = extractXPath(this.ruleFilePath);

			return { ruleName, message, description, xpath };
		} catch (error) {
			return {
				ruleName: null,
				message: null,
				description: null,
				xpath: null,
			};
		}
	}

	/**
	 * Extract examples from the rule XML file
	 */
	extractExamples() {
		try {
			const content = fs.readFileSync(this.ruleFilePath, 'utf-8');
			const parser = new DOMParser();
			const doc = parser.parseFromString(content, 'text/xml');

			const examples = [];
			const exampleNodes = doc.getElementsByTagName('example');

			for (let i = 0; i < exampleNodes.length; i++) {
				const exampleNode = exampleNodes[i];
				const cdata = exampleNode.textContent.trim();
				if (cdata) {
					examples.push(cdata);
				}
			}

			return examples;
		} catch (error) {
			console.warn(
				`Warning: Could not extract examples from rule file: ${error.message}`,
			);
			return [];
		}
	}

	/**
	 * Run quality checks on the rule
	 */
	runQualityChecks() {
		const issues = [];
		const { ruleName, message, description, xpath } = this.ruleMetadata;

		// 1. Check rule name is PascalCase
		if (!ruleName || !/^[A-Z][a-zA-Z0-9]*$/.test(ruleName)) {
			issues.push(
				`Rule name must be PascalCase (found: "${ruleName || 'missing'}")`,
			);
		}

		// 2. Check rule message exists and is <= 80 characters
		if (!message) {
			issues.push('Rule message is missing');
		} else if (message.length > 80) {
			issues.push(
				`Rule message must be 80 characters or fewer (found ${message.length} characters)`,
			);
		}

		// 3. Check description has version number in semver format
		if (!description) {
			issues.push('Rule description is missing');
		} else {
			const versionMatch = description.match(
				/Version:\s*(\d+\.\d+\.\d+)/i,
			);
			if (!versionMatch) {
				issues.push(
					'Rule description must include a version number in semver format (e.g., "Version: 1.0.0")',
				);
			} else {
				const version = versionMatch[1];
				if (!/^\d+\.\d+\.\d+$/.test(version)) {
					issues.push(
						`Version must be in semver format (found: "${version}")`,
					);
				}
			}
		}

		// 4. Check all let variables in XPath have descriptions
		if (xpath) {
			const letMatches = xpath.matchAll(
				/let\s+\$([a-zA-Z_][a-zA-Z0-9_]*)\s*:=\s*/g,
			);
			const declaredVars = new Set();
			for (const match of letMatches) {
				declaredVars.add(match[1]);
			}

			if (declaredVars.size > 0 && description) {
				for (const varName of declaredVars) {
					// Look for "$varName: ..." pattern in description (may have whitespace before)
					const varPattern = new RegExp(
						`\\$\\s*${varName}\\s*:\\s*[^\\s]`,
						'i',
					);
					if (!varPattern.test(description)) {
						issues.push(
							`XPath variable \$${varName} must have a description entry in format '\$${varName}: ...'`,
						);
					}
				}
			}
		}

		// 5. Check for duplicate violation messages across all examples
		const examples = this.extractExamples();
		const violationMessages = new Set();
		const violationMessageCounts = new Map();

		for (const example of examples) {
			const lines = example.split('\n');
			for (const line of lines) {
				const trimmed = line.trim();
				// Extract messages after "// Violation: " or "// ❌"
				let violationMsg = null;
				if (trimmed.startsWith('// Violation:')) {
					violationMsg = trimmed
						.substring('// Violation:'.length)
						.trim();
				} else if (trimmed.includes('// ❌')) {
					const parts = trimmed.split('// ❌');
					if (parts.length > 1) {
						violationMsg = parts[1].trim();
					}
				}

				if (violationMsg) {
					const count = violationMessageCounts.get(violationMsg) || 0;
					violationMessageCounts.set(violationMsg, count + 1);
					if (count > 0) {
						violationMessages.add(violationMsg);
					}
				}
			}
		}

		for (const msg of violationMessages) {
			issues.push(
				`Duplicate violation message found: "${msg}" (appears ${violationMessageCounts.get(msg)} times)`,
			);
		}

		// 6. Check for duplicate valid messages across all examples
		const validMessages = new Set();
		const validMessageCounts = new Map();

		for (const example of examples) {
			const lines = example.split('\n');
			for (const line of lines) {
				const trimmed = line.trim();
				// Extract messages after "// Valid: " or "// ✅"
				let validMsg = null;
				if (trimmed.startsWith('// Valid:')) {
					validMsg = trimmed.substring('// Valid:'.length).trim();
				} else if (trimmed.includes('// ✅')) {
					const parts = trimmed.split('// ✅');
					if (parts.length > 1) {
						validMsg = parts[1].trim();
					}
				}

				if (validMsg) {
					const count = validMessageCounts.get(validMsg) || 0;
					validMessageCounts.set(validMsg, count + 1);
					if (count > 0) {
						validMessages.add(validMsg);
					}
				}
			}
		}

		for (const msg of validMessages) {
			issues.push(
				`Duplicate valid message found: "${msg}" (appears ${validMessageCounts.get(msg)} times)`,
			);
		}

		// 7. Check that all code lines in examples have Valid/Violation comments
		// Code lines should either have inline markers or be part of a section started by a section marker
		for (let exampleIdx = 0; exampleIdx < examples.length; exampleIdx++) {
			const example = examples[exampleIdx];
			const lines = example.split('\n');
			let currentSection = null; // 'violation', 'valid', or null
			let sectionStartLine = -1;

			for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
				const line = lines[lineIdx];
				const trimmed = line.trim();

				// Check for section markers - these start a section that continues until next section or end
				if (trimmed.startsWith('// Violation:')) {
					currentSection = 'violation';
					sectionStartLine = lineIdx;

					// Check if next line is empty or only whitespace/comment
					if (lineIdx + 1 < lines.length) {
						const nextLine = lines[lineIdx + 1].trim();
						// Check if next line is empty, only whitespace, or only a comment
						if (
							nextLine === '' ||
							nextLine.startsWith('//') ||
							/^\s*$/.test(nextLine)
						) {
							issues.push(
								`Example ${exampleIdx + 1}, line ${lineIdx + 1}: // Violation: marker must be followed by code, not empty line or comment`,
							);
						}
					} else {
						// Violation marker at end of example with no following code
						issues.push(
							`Example ${exampleIdx + 1}, line ${lineIdx + 1}: // Violation: marker must be followed by code`,
						);
					}
					continue;
				} else if (trimmed.startsWith('// Valid:')) {
					currentSection = 'valid';
					sectionStartLine = lineIdx;

					// Check if next line is empty or only whitespace/comment
					if (lineIdx + 1 < lines.length) {
						const nextLine = lines[lineIdx + 1].trim();
						// Check if next line is empty, only whitespace, or only a comment
						if (
							nextLine === '' ||
							nextLine.startsWith('//') ||
							/^\s*$/.test(nextLine)
						) {
							issues.push(
								`Example ${exampleIdx + 1}, line ${lineIdx + 1}: // Valid: marker must be followed by code, not empty line or comment`,
							);
						}
					} else {
						// Valid marker at end of example with no following code
						issues.push(
							`Example ${exampleIdx + 1}, line ${lineIdx + 1}: // Valid: marker must be followed by code`,
						);
					}
					continue;
				}

				// Check for inline markers - these override section markers for that line
				const hasInlineMarker =
					trimmed.includes('// ❌') || trimmed.includes('// ✅');
				if (hasInlineMarker) {
					continue; // This line has an inline marker, skip it
				}

				// Skip comment lines and empty lines (but don't reset section - sections continue)
				if (trimmed.startsWith('//') || trimmed === '') {
					continue;
				}

				// This is a code line - check if it has a marker
				// A code line has a marker if:
				// 1. It has an inline marker (already checked above)
				// 2. It's in a section started by a section marker
				const hasSectionMarker =
					currentSection !== null && lineIdx > sectionStartLine;
				const hasMarker = hasInlineMarker || hasSectionMarker;

				if (!hasMarker) {
					// Code line without marker - check if it exercises XPath branches
					const codeOnly = trimmed.split('//')[0].trim();
					if (codeOnly && codeOnly.length > 0) {
						// Exclude lines that are just braces, semicolons, or closing statements (structural only)
						const isStructuralOnly =
							/^\s*[{}]\s*$/.test(codeOnly) ||
							/^\s*}\s*;?\s*$/.test(codeOnly) ||
							/^\s*;\s*$/.test(codeOnly) ||
							/^\s*\}\s*$/.test(codeOnly);

						if (!isStructuralOnly) {
							// Check if this code line exercises an XPath branch
							// We'll check if the line contains patterns that match XPath node types
							if (
								xpath &&
								this.results.xpathCoverage &&
								this.results.xpathCoverage.analysis
							) {
								// Extract context around this line for better analysis (include a few lines before/after)
								const contextStart = Math.max(0, lineIdx - 2);
								const contextEnd = Math.min(
									lines.length,
									lineIdx + 3,
								);
								const codeContext = lines
									.slice(contextStart, contextEnd)
									.filter((l) => {
										const t = l.trim();
										return t && !t.startsWith('//');
									})
									.map((l) => l.split('//')[0].trim())
									.filter((l) => l)
									.join('\n');

								if (codeContext) {
									// Check if this code context exercises any XPath branches
									try {
										const contextCoverage =
											checkXPathCoverageInContent(
												codeContext,
												this.results.xpathCoverage
													.analysis,
											);

										// If it exercises conditionals (has branch coverage) or matches node types, it exercises XPath
										const hasConditionalCoverage =
											contextCoverage.conditionalCoverage &&
											contextCoverage.conditionalCoverage
												.length > 0 &&
											contextCoverage.conditionalCoverage.some(
												(c) =>
													(c.branches &&
														(c.branches.true ===
															true ||
															c.branches.false ===
																true)) ||
													c.covered === true,
											);

										// Also check if it matches any node types from the XPath
										const hasNodeTypeCoverage =
											contextCoverage.coveredNodeTypes &&
											contextCoverage.coveredNodeTypes
												.size > 0;

										// Check if any conditionals are partially or fully covered
										const hasAnyCoverage =
											(contextCoverage.conditionalCoverage &&
												contextCoverage
													.conditionalCoverage
													.length > 0) ||
											(contextCoverage.coveredConditionals &&
												contextCoverage
													.coveredConditionals.size >
													0);

										const exercisesXPath =
											hasConditionalCoverage ||
											hasNodeTypeCoverage ||
											hasAnyCoverage;

										if (exercisesXPath) {
											// This code exercises XPath but isn't marked - add warning
											this.results.qualityChecks.warnings.push(
												`Example ${exampleIdx + 1}, line ${lineIdx + 1}: Code line exercises XPath branches but is not marked as Valid/Violation: "${codeOnly.substring(0, 60)}${codeOnly.length > 60 ? '...' : ''}"`,
											);
										}
									} catch (error) {
										// If we can't check coverage, don't warn (might be incomplete code snippet)
									}
								}
							}
							// If we can't check XPath coverage (no analysis available), don't warn
							// We only warn when we can verify the code actually exercises XPath branches
						}
					}
				}
			}
		}

		// 8. Check for duplicate branch combinations across examples (WARNING only, doesn't fail)
		// This should only run after tests have been executed and branch combinations are tracked
		if (
			this.results.exampleBranchCombinations &&
			this.results.exampleBranchCombinations.length > 0
		) {
			const branchSignatureCounts = new Map();

			// Count occurrences of each branch signature
			this.results.exampleBranchCombinations.forEach((combo) => {
				const sig = combo.branchSignature || '';
				const count = branchSignatureCounts.get(sig) || 0;
				branchSignatureCounts.set(sig, count + 1);
			});

			// Find duplicate branch combinations (count > 1 and signature is not empty)
			const duplicateSignatures = [];
			branchSignatureCounts.forEach((count, sig) => {
				if (count > 1 && sig && sig.trim() !== '') {
					// Empty signature means no coverage, ignore
					duplicateSignatures.push({ signature: sig, count: count });
				}
			});

			// Add warnings for duplicate branch combinations (across all examples)
			if (duplicateSignatures.length > 0) {
				const examples = this.extractExamples();

				duplicateSignatures.forEach((dup) => {
					const matchingCombos =
						this.results.exampleBranchCombinations.filter(
							(c) => (c.branchSignature || '') === dup.signature,
						);

					// Build detailed output with example number, line number, and line text
					const details = matchingCombos
						.map((c) => {
							const exampleIndex = c.exampleIndex;
							const exampleContent = examples[exampleIndex] || '';
							const exampleLines = exampleContent.split('\n');

							let lineNumber = 0;
							let lineText = '';

							if (
								c.type === 'violation' &&
								c.violationIndex !== undefined
							) {
								// For violations, get the violation line from PMD results
								// We'll use the test result details to get the actual code line that violates
								const testResult =
									this.results.testResults.find(
										(r) => r.exampleIndex === exampleIndex,
									);
								if (
									testResult &&
									testResult.details &&
									testResult.details[c.violationIndex]
								) {
									const violation =
										testResult.details[c.violationIndex];
									// PMD line numbers are 1-based and include class declaration (line 1)
									// Map back to example line (subtract class declaration offset)
									const testFileLineNum = violation.line - 1; // Convert to 0-based, subtract class declaration
									// Example content doesn't have class declaration, so line numbers should match
									// But test file has class declaration, so we need to map correctly
									// The test file has: line 1 = class declaration, line 2+ = example content
									// So violation.line in test file - 1 = line in example content
									if (
										testFileLineNum >= 0 &&
										testFileLineNum < exampleLines.length
									) {
										lineNumber = testFileLineNum + 1; // Convert to 1-based for display
										lineText =
											exampleLines[
												testFileLineNum
											].trim();
									} else {
										// Try to find the violation by looking at test file
										const testContent = testResult.file
											? fs.readFileSync(
													testResult.file,
													'utf-8',
												)
											: '';
										if (testContent) {
											const testLines =
												testContent.split('\n');
											if (
												violation.line > 0 &&
												violation.line <=
													testLines.length
											) {
												const testLineText =
													testLines[
														violation.line - 1
													].trim();
												// Try to find this line in the example
												const exampleLineIndex =
													exampleLines.findIndex(
														(l) =>
															l.trim() ===
																testLineText ||
															l
																.trim()
																.includes(
																	testLineText
																		.split(
																			'//',
																		)[0]
																		.trim(),
																),
													);
												if (exampleLineIndex >= 0) {
													lineNumber =
														exampleLineIndex + 1;
													lineText =
														exampleLines[
															exampleLineIndex
														].trim();
												} else {
													// Use test file line directly
													lineNumber = violation.line;
													lineText = testLineText;
												}
											}
										}
									}
								}
								// Fallback: use violation index and try to find violation markers
								if (!lineText) {
									// Look for violation markers in the example
									const { violationMarkers } =
										this.parseExample(exampleContent);
									if (
										violationMarkers &&
										violationMarkers.length >
											c.violationIndex
									) {
										const marker =
											violationMarkers[c.violationIndex];
										lineNumber = marker.line;
										if (lineNumber <= exampleLines.length) {
											// Get the code line after the marker (violation is typically on the next line)
											const codeLineIndex = Math.min(
												lineNumber,
												exampleLines.length - 1,
											);
											lineText =
												exampleLines[
													codeLineIndex
												].trim();
											if (
												!lineText ||
												lineText.startsWith('//')
											) {
												// If marker line is the violation, try the next line
												if (
													codeLineIndex + 1 <
													exampleLines.length
												) {
													lineText =
														exampleLines[
															codeLineIndex + 1
														].trim();
												}
											}
										}
									}
									// Last fallback
									if (!lineText) {
										lineNumber = c.violationIndex + 1;
										lineText = `violation ${c.violationIndex + 1}`;
									}
								}
							} else if (c.type === 'valid') {
								// For valid markers, get the actual code line (not the marker comment line)
								if (c.markerLine && c.markerLine > 0) {
									lineNumber = c.markerLine;
									// Find the first code line after the marker (skip comments and empty lines)
									let codeLineIndex = -1;
									for (
										let j = c.markerLine;
										j < exampleLines.length;
										j++
									) {
										const trimmed = exampleLines[j].trim();
										if (
											trimmed &&
											!trimmed.startsWith('//')
										) {
											codeLineIndex = j;
											break;
										}
									}
									// If no code line found after marker, try the marker line itself (for inline markers)
									if (codeLineIndex === -1) {
										codeLineIndex = c.markerLine - 1; // Convert to 0-based
									}
									if (
										codeLineIndex >= 0 &&
										codeLineIndex < exampleLines.length
									) {
										const candidateLine =
											exampleLines[codeLineIndex].trim();
										// For inline markers (// ✅ on same line as code), get the code part
										if (
											c.markerType === 'inline' &&
											candidateLine.includes('// ✅')
										) {
											lineText = candidateLine
												.split('// ✅')[0]
												.trim();
										} else if (
											candidateLine &&
											!candidateLine.startsWith('//')
										) {
											// For section markers, get the first code line after the marker
											lineText = candidateLine;
											lineNumber = codeLineIndex + 1; // Update to show code line number
										} else {
											// Fallback: use marker line
											lineText =
												candidateLine ||
												c.markerDescription ||
												'valid code';
										}
									} else {
										// Fallback: use marker description
										lineText =
											c.markerDescription || 'valid code';
									}
								} else {
									// Fallback: use marker description
									lineText =
										c.markerDescription || 'valid code';
								}
							}

							return {
								exampleIndex: exampleIndex + 1,
								lineNumber: lineNumber,
								lineText: lineText,
								type: c.type,
								violationIndex: c.violationIndex,
								markerType: c.markerType,
							};
						})
						.sort((a, b) => {
							// Sort by example number, then by line number
							if (a.exampleIndex !== b.exampleIndex) {
								return a.exampleIndex - b.exampleIndex;
							}
							return a.lineNumber - b.lineNumber;
						});

					// Deduplicate: remove entries where the same example/line/code appears multiple times
					// (e.g., when both section and inline markers refer to the same code line)
					const seen = new Set();
					const deduplicatedDetails = details.filter((detail) => {
						// Create a unique key based on example, line number, and code text
						const key = `${detail.exampleIndex}:${detail.lineNumber}:${detail.lineText}`;
						if (seen.has(key)) {
							return false; // Skip duplicate
						}
						seen.add(key);
						return true; // Keep this entry
					});

					// Only show warning if there are still duplicates after deduplication
					if (deduplicatedDetails.length > 1) {
						// Format the warning with indented details
						const warningParts = [];
						warningParts.push(
							`The following ${deduplicatedDetails.length} marker(s) exercise the exact same branch combination:`,
						);

						deduplicatedDetails.forEach((detail) => {
							const markerType =
								detail.type === 'violation'
									? 'Violation'
									: detail.markerType === 'inline'
										? 'Valid (inline)'
										: detail.markerType === 'section'
											? 'Valid (section)'
											: 'Valid';

							warningParts.push(
								`      - Example ${detail.exampleIndex}, line ${detail.lineNumber} (${markerType}):`,
							);
							// Truncate long lines for display
							const displayText =
								detail.lineText.length > 80
									? detail.lineText.substring(0, 77) + '...'
									: detail.lineText;
							warningParts.push(`        ${displayText}`);
						});

						this.results.qualityChecks.warnings.push(
							warningParts.join('\n'),
						);
					}
				});
			}
		}

		this.results.qualityChecks.passed = issues.length === 0;
		this.results.qualityChecks.issues = issues;

		// Debug: Log branch combinations for troubleshooting
		if (
			this.results.exampleBranchCombinations &&
			this.results.exampleBranchCombinations.length > 0 &&
			process.env.DEBUG_BRANCHES
		) {
			console.log('\n🔍 Debug: Branch combinations tracked:');
			this.results.exampleBranchCombinations.forEach((combo) => {
				const typeInfo =
					combo.type === 'violation'
						? 'violation'
						: combo.type === 'valid'
							? 'valid'
							: 'unknown';
				const violationInfo =
					combo.violationIndex !== undefined
						? `, ${typeInfo} ${combo.violationIndex + 1}`
						: combo.type === 'valid'
							? ', valid code'
							: '';
				const sectionInfo =
					combo.sectionIndex !== undefined
						? `, section ${combo.sectionIndex + 1}`
						: '';
				console.log(
					`  Example ${combo.exampleIndex + 1}${violationInfo}${sectionInfo}: ${combo.branchSignature || '(empty)'}`,
				);
			});

			const branchSignatureCounts = new Map();
			this.results.exampleBranchCombinations.forEach((combo) => {
				const sig = combo.branchSignature || '';
				const count = branchSignatureCounts.get(sig) || 0;
				branchSignatureCounts.set(sig, count + 1);
			});

			console.log(
				`  Total branch signatures: ${branchSignatureCounts.size}`,
			);

			const duplicateSignatures = [];
			branchSignatureCounts.forEach((count, sig) => {
				if (count > 1 && sig && sig.trim() !== '') {
					duplicateSignatures.push({ signature: sig, count: count });
				}
			});

			if (duplicateSignatures.length > 0) {
				console.log(
					`  Duplicate signatures found: ${duplicateSignatures.length}`,
				);
			}
		}
	}

	/**
	 * Create a branch combination signature from coverage data
	 */
	createBranchSignature(coverage) {
		if (
			!coverage ||
			!coverage.conditionalCoverage ||
			!Array.isArray(coverage.conditionalCoverage)
		) {
			return '';
		}

		// Create signature from conditional branch coverage
		// Format: "cond1:TT,cond2:TF,..." where TT means both true and false branches, TF means only true branch, etc.
		const branchParts = coverage.conditionalCoverage
			.filter(
				(c) =>
					c.branches &&
					(c.branches.true !== undefined ||
						c.branches.false !== undefined),
			)
			.map((c) => {
				const trueBranch = c.branches.true === true ? 'T' : 'F';
				const falseBranch = c.branches.false === true ? 'T' : 'F';
				// Use a stable identifier for the conditional - prefer expression if available, fallback to description
				const condId =
					(c.conditional &&
						(c.conditional.expression ||
							c.conditional.description)) ||
					(typeof c.conditional === 'string' ? c.conditional : '');
				// Only include if we have a valid conditional identifier
				if (condId) {
					return `${condId}:${trueBranch}${falseBranch}`;
				}
				return null;
			})
			.filter((part) => part !== null) // Remove null entries
			.sort() // Sort for consistent ordering
			.join(',');

		return branchParts;
	}

	/**
	 * Parse example content and identify expected violations
	 */
	parseExample(exampleContent) {
		const lines = exampleContent.split('\n');
		const violations = [];
		const valids = [];
		const violationMarkers = [];
		const validMarkers = [];
		let currentMode = null; // null, 'violation', or 'valid'

		lines.forEach((line, index) => {
			const trimmed = line.trim();
			let lineMode = currentMode; // Default to current mode

			// Check for inline violation/valid markers
			if (trimmed.includes('// ❌')) {
				// Inline violation marker - expect violation on this line
				lineMode = 'violation';
				violationMarkers.push({
					line: index + 1, // 1-based line number in the example
					description: 'Inline violation marker // ❌',
				});
			} else if (trimmed.includes('// ✅')) {
				// Inline valid marker - do not expect violation on this line
				lineMode = 'valid';
				validMarkers.push({
					line: index + 1, // 1-based line number in the example
					description: 'Inline valid marker // ✅',
				});
			}

			const hasInlineMarkersInExample =
				exampleContent.includes('// ❌') ||
				exampleContent.includes('// ✅');

			if (trimmed.startsWith('// Violation:')) {
				currentMode = 'violation';
				// Section headers create markers only when there are no inline markers
				if (!hasInlineMarkersInExample) {
					violationMarkers.push({
						line: index + 1, // 1-based line number where the marker appears (violation is on next code line)
						description: trimmed
							.substring('// Violation:'.length)
							.trim(),
					});
				}
			} else if (trimmed.startsWith('// Valid:')) {
				currentMode = 'valid';
				// Section headers create markers only when there are no inline markers
				if (!hasInlineMarkersInExample) {
					validMarkers.push({
						line: index + 1, // 1-based line number in the example
						description: trimmed
							.substring('// Valid:'.length)
							.trim(),
					});
				}
			} else if (trimmed && !trimmed.startsWith('//') && trimmed !== '') {
				// This is a code line - it belongs to the determined mode (inline markers override)
				// Remove inline comment markers from the code
				let codeLine = line;
				if (line.includes('// ❌')) {
					codeLine = line.split('// ❌')[0].trim();
				} else if (line.includes('// ✅')) {
					codeLine = line.split('// ✅')[0].trim();
				}

				if (codeLine && codeLine !== '') {
					if (lineMode === 'violation') {
						violations.push(codeLine);
					} else if (lineMode === 'valid') {
						valids.push(codeLine);
					}
				}
			}
		});

		return { violations, valids, violationMarkers, validMarkers };
	}

	/**
	 * Create a test file from example content
	 */
	createTestFileFromExample(
		exampleContent,
		exampleIndex,
		includeViolations = true,
		includeValids = true,
	) {
		const tempFile = path.join(
			os.tmpdir(),
			`rule-test-${this.ruleName}-example-${exampleIndex}-${Date.now()}.cls`,
		);

		// Parse the example to get violation and valid code
		const { violations, valids } = this.parseExample(exampleContent);

		// Check if this example uses inline markers - if so, include full content
		const hasInlineMarkers =
			exampleContent.includes('// ❌') ||
			exampleContent.includes('// ✅');

		let classContent;
		const exampleHasInlineMarkers =
			exampleContent.includes('// ❌') ||
			exampleContent.includes('// ✅');
		if (exampleHasInlineMarkers) {
			// For examples with inline markers, parse and respect include parameters
			const { violations, valids } = this.parseExample(exampleContent);

			if (includeViolations && !includeValids) {
				// Violation-only file for mixed examples
				classContent = `public class TestClass${exampleIndex} {\n`;
				violations.forEach((line) => {
					classContent += `    ${line}\n`;
				});
				classContent += `}\n`;
			} else if (includeValids && !includeViolations) {
				// Valid-only file for mixed examples
				classContent = `public class TestClass${exampleIndex} {\n`;
				valids.forEach((line) => {
					classContent += `    ${line}\n`;
				});
				classContent += `}\n`;
			} else {
				// Full content for mixed examples
				const lines = exampleContent.split('\n');
				const cleanedLines = lines
					.filter(
						(line) =>
							!line.trim().startsWith('// Violation:') &&
							!line.trim().startsWith('// Valid:'),
					)
					.map((line) => {
						if (line.includes('// ❌')) {
							return line.split('// ❌')[0].trim();
						} else if (line.includes('// ✅')) {
							return line.split('// ✅')[0].trim();
						}
						return line;
					})
					.filter((line) => line.trim() !== '');

				const content = cleanedLines.join('\n');
				// Handle multiple classes (use first class only for Apex)
				const classMatches =
					content.match(/^public class\s+\w+/gm) || [];
				if (classMatches.length > 1) {
					const firstClassEnd = content.indexOf(
						'\n}\n',
						content.indexOf('\n}\n') + 1,
					);
					classContent = content.substring(0, firstClassEnd + 3);
				} else {
					classContent = content + '\n';
				}
			}
		} else {
			// Legacy behavior for examples without inline markers
			classContent = `public class TestClass${exampleIndex} {\n`;

			// Choose which code to include based on parameters
			let codeToInclude = [];
			if (includeViolations && !includeValids) {
				// Only violations
				codeToInclude = violations;
			} else if (includeValids && !includeViolations) {
				codeToInclude = valids;
			} else {
				// Both or neither
				codeToInclude = [...violations, ...valids];
			}

			// Process all the parsed code lines
			const allLines = codeToInclude;
			let inMethod = false;
			let methodHasParams = false;
			let methodLineCount = 0;

			allLines.forEach((line, index) => {
				let processedLine = line;

				// Check if this is a method signature
				if (
					line.includes('public') &&
					line.includes('(') &&
					line.includes('{')
				) {
					inMethod = true;
					methodHasParams =
						line.includes('(') && !line.includes('()');
					methodLineCount = 0;

					// For violation methods, ensure they have at least one parameter (required by AvoidOneLinerMethods rule)
					if (
						includeViolations &&
						!includeValids &&
						!methodHasParams
					) {
						processedLine = line.replace('()', '(Integer param)');
					}
				} else if (line.trim() === '}') {
					inMethod = false;
				} else if (
					inMethod &&
					line.trim() !== '' &&
					!line.trim().startsWith('//')
				) {
					methodLineCount++;
				}

				classContent += `    ${processedLine}\n`;
			});

			classContent += `}\n`;
		}

		fs.writeFileSync(tempFile, classContent, 'utf-8');
		this.tempFiles.push(tempFile);

		return {
			filePath: tempFile,
			hasViolations: violations.length > 0,
			hasValids: valids.length > 0,
			violationCount: violations.length,
			validCount: valids.length,
		};
	}

	/**
	 * Clean up temporary files
	 */
	cleanup() {
		this.tempFiles.forEach((file) => {
			try {
				if (fs.existsSync(file)) {
					fs.unlinkSync(file);
				}
			} catch (error) {
				console.warn(`Failed to cleanup ${file}: ${error.message}`);
			}
		});
		this.tempFiles = [];
	}

	/**
	 * Test the rule against examples from the rule file
	 */
	async testRuleExamples() {
		const examples = this.extractExamples();
		this.results.examples = examples;
		this.results.testResults = [];

		if (examples.length === 0) {
			throw new Error(
				'No examples found in the rule file. Cannot perform automated testing.',
			);
		}

		console.log(`📋 Found ${examples.length} examples to test\n`);

		for (let i = 0; i < examples.length; i++) {
			const example = examples[i];
			const {
				violations: exampleViolations,
				valids: exampleValids,
				violationMarkers,
				validMarkers,
			} = this.parseExample(example);
			const exampleHasViolations = violationMarkers.length > 0;
			const exampleHasValids = validMarkers.length > 0;

			console.log(`Testing Example ${i + 1}/${examples.length}...`);
			// Create test file from this example
			let testFile;
			let isMixedExampleViolationFile = false;
			if (exampleHasViolations && exampleHasValids) {
				// For mixed examples, create separate files for violations only
				const violationFileInfo = this.createTestFileFromExample(
					example,
					i,
					true,
					false,
				); // violations only
				testFile = violationFileInfo.filePath;
				isMixedExampleViolationFile = true;
			} else {
				const testFileInfo = this.createTestFileFromExample(
					example,
					i,
					exampleHasViolations,
					exampleHasValids,
				);
				testFile = testFileInfo.filePath;
			}

			try {
				const violations = await runPMD(this.ruleFilePath, testFile);
				const ruleViolations = violations.filter(
					(v) => v.rule === this.ruleName,
				);
				const actualViolationCount = ruleViolations.length;

				// Track branch combinations for each violation/validation across all examples
				if (
					this.results.xpathCoverage &&
					this.results.xpathCoverage.analysis
				) {
					try {
						// Read the test file content to check branch coverage
						const testContent = fs.readFileSync(testFile, 'utf-8');
						const testLines = testContent.split('\n');

						// Track each violation separately (across all examples)
						ruleViolations.forEach((violation, vIndex) => {
							// Extract code around this violation (violation line +/- 5 lines for context)
							const startLine = Math.max(0, violation.line - 6);
							const endLine = Math.min(
								testLines.length,
								violation.line + 5,
							);
							const violationSnippet = testLines
								.slice(startLine, endLine)
								.join('\n');

							const violationCoverage =
								checkXPathCoverageInContent(
									violationSnippet,
									this.results.xpathCoverage.analysis,
								);
							const branchSignature =
								this.createBranchSignature(violationCoverage);

							this.results.exampleBranchCombinations.push({
								exampleIndex: i,
								type: 'violation',
								violationIndex: vIndex,
								branchSignature: branchSignature || '',
								coverage: violationCoverage,
							});
						});

						// Track valid code cases (code that should NOT trigger violations)
						// Track each individual "// Valid:" marker or "// ✅" marker separately
						const exampleLines = example.split('\n');

						// Track each "// Valid:" section header marker individually
						exampleLines.forEach((line, lineIndex) => {
							if (line.trim().startsWith('// Valid:')) {
								// Extract code after this valid marker until next section or end
								let startLine = lineIndex + 1; // Start after the marker
								let endLine = exampleLines.length;

								// Find next section marker (Violation or Valid) or end of example
								for (
									let j = lineIndex + 1;
									j < exampleLines.length;
									j++
								) {
									const trimmed = exampleLines[j].trim();
									if (
										trimmed.startsWith('// Violation:') ||
										trimmed.startsWith('// Valid:')
									) {
										endLine = j;
										break;
									}
								}

								if (endLine > startLine) {
									// Extract valid code snippet
									const validSnippet = exampleLines
										.slice(startLine, endLine)
										.filter((line) => {
											const trimmed = line.trim();
											// Exclude comments and empty lines
											return (
												trimmed &&
												!trimmed.startsWith('//')
											);
										})
										.join('\n');

									if (validSnippet.trim()) {
										// Map example line numbers to test file line numbers
										// Test file has class declaration, so add offset
										const testFileStartLine = startLine + 1; // +1 for class declaration
										const testFileEndLine = Math.min(
											testLines.length,
											endLine + 1,
										);
										const testFileSnippet = testLines
											.slice(
												testFileStartLine,
												testFileEndLine,
											)
											.join('\n');

										if (testFileSnippet.trim()) {
											const validCoverage =
												checkXPathCoverageInContent(
													testFileSnippet,
													this.results.xpathCoverage
														.analysis,
												);
											const branchSignature =
												this.createBranchSignature(
													validCoverage,
												);

											// Track each valid marker separately
											this.results.exampleBranchCombinations.push(
												{
													exampleIndex: i,
													type: 'valid',
													markerType: 'section',
													markerLine: lineIndex + 1, // 1-based line number of the marker
													markerDescription: line
														.trim()
														.substring(
															'// Valid:'.length,
														)
														.trim(),
													branchSignature:
														branchSignature || '',
													coverage: validCoverage,
												},
											);
										}
									}
								}
							}
						});

						// Track each "// ✅" inline marker individually
						validMarkers.forEach((marker, mIndex) => {
							if (marker.line <= exampleLines.length) {
								// Extract code around this valid marker (marker line +/- 5 lines)
								const startLine = Math.max(0, marker.line - 1);
								const endLine = Math.min(
									exampleLines.length,
									marker.line + 5,
								);

								const validSnippet = exampleLines
									.slice(startLine, endLine)
									.filter((line) => {
										const trimmed = line.trim();
										// Exclude comments and empty lines
										return (
											trimmed && !trimmed.startsWith('//')
										);
									})
									.join('\n');

								if (validSnippet.trim()) {
									// Map example line numbers to test file line numbers
									// Test file has class declaration, so add offset
									const testFileStartLine = startLine + 1; // +1 for class declaration
									const testFileEndLine = Math.min(
										testLines.length,
										endLine + 1,
									);
									const testFileSnippet = testLines
										.slice(
											testFileStartLine,
											testFileEndLine,
										)
										.join('\n');

									if (testFileSnippet.trim()) {
										const validCoverage =
											checkXPathCoverageInContent(
												testFileSnippet,
												this.results.xpathCoverage
													.analysis,
											);
										const branchSignature =
											this.createBranchSignature(
												validCoverage,
											);

										// Track each inline valid marker separately
										this.results.exampleBranchCombinations.push(
											{
												exampleIndex: i,
												type: 'valid',
												markerType: 'inline',
												markerLine: marker.line,
												markerDescription:
													marker.description ||
													'Inline valid marker // ✅',
												branchSignature:
													branchSignature || '',
												coverage: validCoverage,
											},
										);
									}
								}
							}
						});

						// If no violations and no valid markers, track entire example as valid (fallback case)
						if (
							!exampleHasViolations &&
							actualViolationCount === 0 &&
							validMarkers.length === 0 &&
							!example.includes('// Valid:')
						) {
							const validSnippet = exampleLines
								.filter((line) => {
									const trimmed = line.trim();
									// Exclude comments and empty lines
									return trimmed && !trimmed.startsWith('//');
								})
								.join('\n');

							if (validSnippet.trim()) {
								const testFileSnippet = testLines
									.slice(1)
									.join('\n'); // Skip class declaration

								if (testFileSnippet.trim()) {
									const validCoverage =
										checkXPathCoverageInContent(
											testFileSnippet,
											this.results.xpathCoverage.analysis,
										);
									const branchSignature =
										this.createBranchSignature(
											validCoverage,
										);

									// Track entire example as valid (no markers)
									this.results.exampleBranchCombinations.push(
										{
											exampleIndex: i,
											type: 'valid',
											markerType: 'full',
											markerLine: 1,
											markerDescription:
												'Entire example (no markers)',
											branchSignature:
												branchSignature || '',
											coverage: validCoverage,
										},
									);
								}
							}
						}
					} catch (error) {
						// Ignore errors when tracking branch combinations
					}
				}

				// Determine if this test passed
				let passed = true;
				let issues = [];
				let failingLines = [];

				// We expect violations if the example contains violation markers
				const expectedViolationCount = violationMarkers.length;

				if (expectedViolationCount > 0) {
					// Check that we found at least as many violations as expected markers
					// (since one marker can apply to multiple lines of violating code)
					if (actualViolationCount < expectedViolationCount) {
						passed = false;
						issues.push(
							`Expected at least ${expectedViolationCount} violations but found ${actualViolationCount}`,
						);

						// Identify which violation markers weren't satisfied
						// For now, just show the first unsatisfied marker
						if (violationMarkers.length > 0) {
							const exampleLines = example.split('\n');
							const marker = violationMarkers[0]; // Show first unsatisfied marker
							if (marker.line <= exampleLines.length) {
								const codeLine =
									exampleLines[marker.line - 1].trim();
								failingLines.push(codeLine);
							}
						}
					}
				} else if (actualViolationCount > 0) {
					passed = false;
					issues.push(
						`Expected no violations but found ${actualViolationCount}`,
					);

					// For unexpected violations, show a valid code line from the example
					const exampleLines = example.split('\n');
					for (const line of exampleLines) {
						const trimmed = line.trim();
						if (
							trimmed &&
							!trimmed.startsWith('//') &&
							!trimmed.includes('class ') &&
							!trimmed.includes('{') &&
							!trimmed.includes('}')
						) {
							failingLines.push(trimmed);
							break; // Show the first code line
						}
					}
				}

				// Additional validation: Check that violations ONLY occur on lines following "// Violation: ..." comments
				// Skip this check for examples with inline markers since they indicate expectations directly
				const hasInlineMarkers =
					example.includes('// ❌') || example.includes('// ✅');
				if (actualViolationCount > 0 && !hasInlineMarkers) {
					const unexpectedViolations = [];

					// For mixed example violation files, all violations are expected since the file contains only violation code
					if (!isMixedExampleViolationFile) {
						// For regular examples, check that violations are associated with violation markers
						ruleViolations.forEach((violation) => {
							let isExpected = false;

							if (violationMarkers.length > 0) {
								// Check if this violation is near where we expect violations
								// Map example line numbers to file line numbers
								// The marker is on the comment line, violation is on the next code line
								const fileLineOffset = 1; // Class declaration is line 1
								const violationLineOffset = 1; // Violation is on the line after the marker

								violationMarkers.forEach((marker) => {
									// Marker is at the comment line, violation is at marker.line + violationLineOffset in example
									// Then add fileLineOffset to get the file line number
									const expectedViolationLine =
										marker.line +
										violationLineOffset +
										fileLineOffset;
									// Allow some tolerance for line number mapping (e.g., blank lines, multiple lines per violation)
									if (
										Math.abs(
											violation.line -
												expectedViolationLine,
										) <= 5
									) {
										isExpected = true;
									}
								});
							}

							if (!isExpected) {
								unexpectedViolations.push(
									`Unexpected violation at line ${violation.line}: ${violation.message}`,
								);
							}
						});
					}

					if (unexpectedViolations.length > 0) {
						passed = false;
						issues.push(...unexpectedViolations);

						// For unexpected violations, show the first unexpected violation
						if (ruleViolations.length > 0) {
							const violation = ruleViolations[0];
							// Try to find the corresponding line in the example
							const exampleLines = example.split('\n');
							// Look for lines with inline markers that might correspond
							for (let i = 0; i < exampleLines.length; i++) {
								const line = exampleLines[i];
								if (
									line.includes('// ❌') ||
									line.includes('// ✅')
								) {
									const codeLine = line
										.split('// ')[0]
										.trim();
									if (codeLine) {
										failingLines.push(codeLine);
										break;
									}
								}
							}
						}
					}
				}

				// Additional validation: Check that no violations occur on lines following "// Valid: ..." comments
				if (validMarkers.length > 0) {
					const violationLines = ruleViolations.map((v) => v.line);
					const invalidValidViolations = [];

					validMarkers.forEach((marker) => {
						// Look for violations that might correspond to valid code
						// We need to map example line numbers to file line numbers
						const fileLineOffset = 10; // Approximate offset for class declaration and template
						const expectedValidLine = marker.line + fileLineOffset;

						// Check for violations near the expected valid line (with tolerance)
						const nearbyViolations = violationLines.filter(
							(line) => Math.abs(line - expectedValidLine) <= 3,
						);

						if (nearbyViolations.length > 0) {
							invalidValidViolations.push(
								`Violation found near valid code at example line ${marker.line} (${marker.description})`,
							);
						}
					});

					if (invalidValidViolations.length > 0) {
						passed = false;
						issues.push(...invalidValidViolations);

						// For violations near valid markers, show the valid marker line
						if (validMarkers.length > 0) {
							const exampleLines = example.split('\n');
							const marker = validMarkers[0]; // Show first problematic valid marker
							if (marker.line <= exampleLines.length) {
								const codeLine =
									exampleLines[marker.line - 1].trim();
								failingLines.push(codeLine);
							}
						}
					}
				}

				this.results.testResults.push({
					exampleIndex: i,
					file: testFile,
					violations: actualViolationCount,
					expectedViolations: expectedViolationCount,
					expectedValids: exampleHasValids,
					passed,
					issues,
					failingLines: failingLines.slice(0, 1), // Show only the first failing line
					details: ruleViolations,
				});

				if (passed) {
					console.log(
						`  ✅ Passed (${actualViolationCount} violations found)`,
					);
				} else {
					console.log(`  ❌ Failed (${issues.join(', ')})`);
				}
			} catch (error) {
				this.results.testResults.push({
					exampleIndex: i,
					file: testFile,
					error: error.message,
					passed: false,
				});
				console.log(`  ❌ Error: ${error.message}`);
			}

			console.log('');
		}
	}

	/**
	 * Run full coverage test
	 */
	async runCoverageTest() {
		console.log(`\n🧪 Testing Rule: ${this.category}/${this.ruleName}`);
		console.log(`📁 Rule File: ${this.ruleFilePath}`);

		// Analyze XPath coverage and hardcoded values
		const xpath = extractXPath(this.ruleFilePath);
		if (xpath) {
			const xpathAnalysis = analyzeXPath(xpath);
			this.results.xpathCoverage = {
				xpath,
				analysis: xpathAnalysis,
				coverage: null, // Will be filled after testing
			};
			console.log(
				`📊 XPath Analysis: Found ${xpathAnalysis.nodeTypes.length} AST node types, ${xpathAnalysis.conditionals.length} conditionals`,
			);

			// Check for hardcoded values
			const hardcodedIssues = checkXPathHardcodedValues(xpath);
			this.results.hardcodedValues = {
				issues: hardcodedIssues,
				hasIssues: hardcodedIssues.length > 0,
			};
		} else {
			console.log(`⚠️  No XPath expression found in rule`);
		}

		await this.testRuleExamples();

		// Analyze XPath coverage across all generated test files
		if (this.results.xpathCoverage) {
			let allContent = '';
			// Read all temp files to check XPath coverage
			this.tempFiles.forEach((tempFile) => {
				try {
					if (fs.existsSync(tempFile)) {
						const content = fs.readFileSync(tempFile, 'utf-8');
						allContent += content + '\n';
					}
				} catch (error) {
					// Ignore read errors
				}
			});

			if (allContent) {
				this.results.xpathCoverage.coverage =
					checkXPathCoverageInContent(
						allContent,
						this.results.xpathCoverage.analysis,
					);
			}
		}

		const passedTests = this.results.testResults.filter(
			(r) => r.passed,
		).length;
		const totalTests = this.results.testResults.length;
		const successRate =
			totalTests > 0
				? ((passedTests / totalTests) * 100).toFixed(1)
				: '0.0';

		// Check if the rule triggered any violations at all
		const totalViolations = this.results.testResults.reduce(
			(sum, result) => sum + result.violations,
			0,
		);
		const totalExpectedViolations = this.results.testResults.reduce(
			(sum, result) => sum + result.expectedViolations,
			0,
		);
		const ruleTriggersViolations = totalViolations > 0;

		// Determine different types of failures
		const testsPassed =
			passedTests === totalTests && ruleTriggersViolations;
		const hasHardcodedIssues =
			this.results.hardcodedValues?.hasIssues || false;
		const hasNodeTypeCoverageIssues = this.results.xpathCoverage?.coverage
			? this.results.xpathCoverage.coverage.missingNodeTypes.length > 0
			: false;
		const hasConditionalCoverageIssues = this.results.xpathCoverage
			?.coverage
			? this.results.xpathCoverage.coverage.missingConditionals.length > 0
			: false;
		const hasCoverageIssues =
			hasNodeTypeCoverageIssues || hasConditionalCoverageIssues;

		// Run quality checks
		this.runQualityChecks();
		const hasQualityIssues = !this.results.qualityChecks.passed;

		const hasOtherIssues =
			hasHardcodedIssues || hasCoverageIssues || hasQualityIssues;

		// Overall success requires all tests pass AND no other issues
		this.results.overallSuccess = testsPassed && !hasOtherIssues;

		console.log('📊 Test Summary:');
		console.log(`  Examples tested: ${totalTests}`);
		console.log(`  Passed: ${passedTests}/${totalTests} (${successRate}%)`);
		console.log(
			`  Total violations found: ${totalViolations} (expected: ${totalExpectedViolations})`,
		);

		// Show hardcoded values section (if any)
		if (
			this.results.hardcodedValues &&
			this.results.hardcodedValues.hasIssues
		) {
			console.log('\n🔧 Hardcoded Values Found:');
			this.results.hardcodedValues.issues.forEach((issue, index) => {
				console.log(`  ${index + 1}. ${issue.value}`);
				console.log(`     → Suggested: ${issue.suggestion}`);
			});
		}

		// Show success or failure messages
		if (this.results.overallSuccess) {
			console.log('\n  ✅ All examples passed!');
			console.log(
				'  ✅ Rule correctly identifies violations and valid code',
			);
			console.log(
				`  ✅ Rule triggers violations (${totalViolations} total)`,
			);
		} else {
			// Show failure reasons (excluding hardcoded values which are shown separately above)
			if (passedTests !== totalTests) {
				console.log('\n  📝 Failed examples:');
				this.results.testResults.forEach((result, index) => {
					if (!result.passed) {
						if (result.error) {
							console.log(
								`    - Example ${result.exampleIndex + 1}: Error - ${result.error}`,
							);
						} else {
							console.log(
								`    - Example ${result.exampleIndex + 1}: ${result.issues.join(', ')} (${result.violations} violations found)`,
							);
							if (
								result.failingLines &&
								result.failingLines.length > 0
							) {
								console.log(`      ${result.failingLines[0]}`);
							}
						}
					}
				});
			}

			if (!ruleTriggersViolations) {
				console.log('  🚫 Rule never triggered any violations');
				console.log(
					'     This suggests the rule may be broken or ineffective',
				);
			}
		}

		// Analyze XPath coverage across all generated test files
		if (this.results.xpathCoverage && this.results.xpathCoverage.coverage) {
			const coverage = this.results.xpathCoverage.coverage;
			const coveredCount = coverage.coveredNodeTypes.size;
			const totalCount =
				this.results.xpathCoverage.analysis.nodeTypes.length;
			const coveragePercent =
				totalCount > 0
					? ((coveredCount / totalCount) * 100).toFixed(1)
					: '0.0';

			console.log(
				`\n📊 XPath Coverage: ${coveredCount}/${totalCount} (${coveragePercent}%)`,
			);
			if (coverage.missingNodeTypes.length > 0) {
				console.log(
					`  ⚠️  Missing coverage for: ${coverage.missingNodeTypes.join(', ')}`,
				);
			}

			// Report conditional coverage
			const conditionalCount =
				this.results.xpathCoverage.analysis.conditionals.length;
			// Only count conditionals where BOTH branches are covered
			const fullyCoveredCount = coverage.conditionalCoverage.filter(
				(c) =>
					c.covered &&
					c.branches &&
					c.branches.true === true &&
					c.branches.false === true,
			).length;
			const missingConditionalCount = coverage.missingConditionals.length;
			const conditionalCoveragePercent =
				conditionalCount > 0
					? ((fullyCoveredCount / conditionalCount) * 100).toFixed(1)
					: '0.0';

			if (conditionalCount > 0) {
				console.log(
					`\n📊 Conditional Coverage: ${fullyCoveredCount}/${conditionalCount} (${conditionalCoveragePercent}%) [both branches required]`,
				);

				// Show covered conditionals (only those with both branches covered)
				if (
					coverage.conditionalCoverage &&
					coverage.conditionalCoverage.length > 0
				) {
					const fullyCovered = coverage.conditionalCoverage.filter(
						(c) =>
							c.covered &&
							c.branches &&
							c.branches.true === true &&
							c.branches.false === true,
					);
					const partialCovered = coverage.conditionalCoverage.filter(
						(c) =>
							c.covered &&
							!(
								c.branches &&
								c.branches.true === true &&
								c.branches.false === true
							),
					);
					const missing = coverage.conditionalCoverage.filter(
						(c) => !c.covered,
					);

					if (fullyCovered.length > 0) {
						console.log(`  ✅ Covered (${fullyCovered.length}):`);
						fullyCovered.forEach((item, index) => {
							console.log(
								`     ${index + 1}. ${item.conditional.description}`,
							);
							if (item.evidence && item.evidence.length > 0) {
								item.evidence.forEach((evidence) => {
									console.log(`        → ${evidence}`);
								});
							}
							// Show branch coverage - both branches should be covered
							if (item.branches) {
								const branches = [];
								if (item.branches.true === true)
									branches.push('true branch');
								if (item.branches.false === true)
									branches.push('false branch');
								if (branches.length === 2) {
									console.log(
										`        → Branches: ${branches.join(', ')}`,
									);
								}
							}
						});
					}

					if (missing.length > 0) {
						console.log(`  ⚠️  Missing (${missing.length}):`);
						missing.forEach((item, index) => {
							console.log(
								`     ${index + 1}. ${item.conditional.description}`,
							);
							if (item.evidence && item.evidence.length > 0) {
								item.evidence.forEach((evidence) => {
									console.log(`        → ${evidence}`);
								});
							}
							// Show which branches are missing
							if (item.branches) {
								const missingBranches = [];
								if (item.branches.true !== true)
									missingBranches.push('true branch');
								if (item.branches.false !== true)
									missingBranches.push('false branch');
								if (missingBranches.length > 0) {
									console.log(
										`        → Missing branches: ${missingBranches.join(', ')}`,
									);
								}
							}
						});
					}

					// Check for conditionals that have only partial branch coverage
					const partialCoverage = coverage.conditionalCoverage.filter(
						(c) =>
							c.covered &&
							!(
								c.branches &&
								c.branches.true === true &&
								c.branches.false === true
							),
					);
					if (partialCoverage.length > 0) {
						console.log(
							`  ⚠️  Partial Coverage (${partialCoverage.length} - missing one or both branches):`,
						);
						partialCoverage.forEach((item, index) => {
							console.log(
								`     ${index + 1}. ${item.conditional.description}`,
							);
							if (item.evidence && item.evidence.length > 0) {
								item.evidence.forEach((evidence) => {
									console.log(`        → ${evidence}`);
								});
							}
							if (item.branches) {
								const coveredBranches = [];
								const missingBranches = [];
								if (item.branches.true === true)
									coveredBranches.push('true branch');
								else if (item.branches.true === false)
									missingBranches.push('true branch');
								if (item.branches.false === true)
									coveredBranches.push('false branch');
								else if (item.branches.false === false)
									missingBranches.push('false branch');
								if (coveredBranches.length > 0) {
									console.log(
										`        → Covered: ${coveredBranches.join(', ')}`,
									);
								}
								if (missingBranches.length > 0) {
									console.log(
										`        → Missing: ${missingBranches.join(', ')}`,
									);
								}
							}
						});
					}
				} else {
					// Fallback to simple list if detailed coverage not available
					this.results.xpathCoverage.analysis.conditionals.forEach(
						(conditional, index) => {
							const isCovered = coverage.coveredConditionals.has(
								conditional.expression ||
									conditional.description,
							);
							const status = isCovered ? '✅' : '⚠️';
							console.log(
								`  ${status} ${index + 1}. ${conditional.description}`,
							);
						},
					);
				}

				const partialCoverageCheck =
					coverage.conditionalCoverage.filter(
						(c) =>
							c.covered &&
							!(
								c.branches &&
								c.branches.true === true &&
								c.branches.false === true
							),
					);
				if (
					missingConditionalCount > 0 ||
					partialCoverageCheck.length > 0
				) {
					console.log(
						`  ℹ️  Full coverage requires both true and false branches to be exercised`,
					);
				}
			}
		}

		// Final failure message at the very end if there are any issues
		// Show quality check results (reuse hasQualityIssues from above)
		const hasQualityWarnings =
			this.results.qualityChecks.warnings &&
			this.results.qualityChecks.warnings.length > 0;
		if (hasQualityIssues || hasQualityWarnings) {
			console.log('\n📋 Quality Checks:');
			if (hasQualityIssues) {
				console.log('  ❌ Quality checks failed:');
				this.results.qualityChecks.issues.forEach((issue, index) => {
					console.log(`     ${index + 1}. ${issue}`);
				});
			}
			if (hasQualityWarnings) {
				console.log('  ⚠️  Warnings (non-failing):');
				this.results.qualityChecks.warnings.forEach(
					(warning, index) => {
						console.log(`     ${index + 1}. ${warning}`);
					},
				);
			}
		}

		if (!this.results.overallSuccess) {
			console.log('\n❌ Testing failed');
		} else {
			console.log('\n🎉 Rule testing complete!');
		}

		return {
			success: this.results.overallSuccess,
			testResults: this.results.testResults,
			examplesTested: totalTests,
			examplesPassed: passedTests,
			totalViolations,
			ruleTriggersViolations,
			xpathCoverage: this.results.xpathCoverage,
			hardcodedValues: this.results.hardcodedValues,
		};
	}
}

/**
 * Main execution
 */
async function main() {
	const args = process.argv.slice(2);

	if (args.length !== 1) {
		console.log('Usage: node test-pmd-rule.js <rule.xml>');
		console.log(
			'\nThis script tests a PMD rule using examples embedded in the rule file.',
		);
		console.log(
			'It extracts examples, creates test files, and validates the rule behavior.',
		);
		console.log('\nRequirements:');
		console.log('- PMD CLI installed and in PATH');
		console.log('- @xmldom/xmldom package installed');
		process.exit(1);
	}

	const ruleFilePath = args[0];

	if (!fs.existsSync(ruleFilePath)) {
		console.error(`❌ Rule file not found: ${ruleFilePath}`);
		process.exit(1);
	}

	if (!ruleFilePath.endsWith('.xml')) {
		console.error('❌ File must be an XML rule file (.xml)');
		process.exit(1);
	}

	const tester = new RuleTester(ruleFilePath);

	try {
		const result = await tester.runCoverageTest();

		// Clean up temporary files
		tester.cleanup();

		// Exit with appropriate code
		process.exit(result.success ? 0 : 1);
	} catch (error) {
		console.error(`\n❌ Error: ${error.message}`);
		tester.cleanup();
		process.exit(1);
	}
}

// Run if called directly
if (require.main === module) {
	main().catch((error) => {
		console.error(`Unexpected error: ${error.message}`);
		process.exit(1);
	});
}

module.exports = { RuleTester };
