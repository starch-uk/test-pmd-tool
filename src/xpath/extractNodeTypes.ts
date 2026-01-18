/**
 * @file
 * Node type extraction from XPath expressions.
 * Based on PMD Apex AST Reference (PMD 7+).
 */

/**
 * PMD attribute names that should be filtered out from node type extraction.
 * These are XPath attribute names (e.g., `@ReferenceType`, `@Image`) not AST node types.
 * Based on PMD.md documentation section "Attributes".
 */
const PMD_ATTRIBUTE_NAMES = new Set([
	// Names
	'Image',
	'Name',
	'SimpleName',
	'MethodName',
	'FullMethodName',
	'VariableName',
	// Location
	'BeginLine',
	'EndLine',
	'BeginColumn',
	'EndColumn',
	// Operators
	'Op',
	// Types
	'Type',
	'ReturnType',
	'LiteralType',
	// Modifiers
	'Static',
	'Final',
	'Abstract',
	'Public',
	'Private',
	'Protected',
	'Override',
	'Global',
	'WebService',
	// Flags
	'Constructor',
	'Interface',
	'Nested',
	'Null',
	'String',
	'Boolean',
	'isSafe',
	// Counts
	'InputParametersSize',
	// Additional attributes found in XPath expressions
	'ReferenceType',
	'AccessLevel',
	'DefiningType',
]);

/**
 * XPath axis patterns for matching node types after axes (self::, ancestor::, etc.).
 */
const XPATH_AXIS_PATTERN =
	'self::|ancestor::|parent::|child::|descendant::|following::|preceding::|following-sibling::|preceding-sibling::';

/**
 * Common XPath prefix pattern for matching node types in various contexts.
 */
const XPATH_PREFIX_PATTERN =
	'(?:\\.\\/\\/|\\/\\/|\\s|\\/|\\(|\\[|,|\\||' + XPATH_AXIS_PATTERN + ')';

/**
 * Common XPath suffix pattern for matching node types boundaries.
 */
const XPATH_SUFFIX_PATTERN =
	'(?=\\s|$|\\[|\\(|\\/|\\)|,|\\||]|or|and|not|return|let)';

/**
 * Create a regex pattern for matching node types with XPath context.
 * @param nodeTypePattern - Pattern for node types to match.
 * @returns Compiled RegExp for matching.
 */
function createNodeTypeRegex(nodeTypePattern: Readonly<string>): RegExp {
	return new RegExp(
		XPATH_PREFIX_PATTERN + nodeTypePattern + XPATH_SUFFIX_PATTERN,
		'g',
	);
}

/**
 * Extract node types from regex matches and add to set.
 * @param matches - Iterator of regex matches.
 * @param nodeTypes - Set to add node types to.
 */
function extractMatchesToSet(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- IterableIterator cannot be Readonly
	matches: IterableIterator<RegExpMatchArray>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Set is mutated via add()
	nodeTypes: Set<string>,
): void {
	const MATCH_INDEX = 1;
	for (const match of matches) {
		const nodeType = match[MATCH_INDEX];
		if (nodeType !== undefined && !PMD_ATTRIBUTE_NAMES.has(nodeType)) {
			nodeTypes.add(nodeType);
		}
	}
}

/**
 * Get all regex patterns for node type extraction.
 * @param xpath - XPath expression to match against.
 * @returns Array of regex match iterators.
 */
function getAllNodeTypePatterns(
	xpath: Readonly<string>,
): IterableIterator<RegExpMatchArray>[] {
	return [
		xpath.matchAll(
			/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\||self::|ancestor::|parent::|child::|descendant::|following::|preceding::|following-sibling::|preceding-sibling::)([A-Z][a-zA-Z]*(?:Statement|Expression|Declaration|Node|Block))(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
		),
		xpath.matchAll(
			/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\||self::|ancestor::|parent::|child::|descendant::|following::|preceding::|following-sibling::|preceding-sibling::)(Method|Field|Class|Type|Condition|Loop|Block|Parameter|Property|Annotation)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
		),
		xpath.matchAll(
			/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\||self::|ancestor::|parent::|child::|descendant::|following::|preceding::|following-sibling::|preceding-sibling::)([A-Z][a-zA-Z]*(?:Method|Class|Field|Condition|Loop|Type)[a-zA-Z]*)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
		),
		xpath.matchAll(createNodeTypeRegex('(ApexFile|CompilationUnit)')),
		xpath.matchAll(
			createNodeTypeRegex('(UserClass|UserInterface|UserEnum)'),
		),
		xpath.matchAll(
			createNodeTypeRegex(
				'(Dml(?:Insert|Update|Delete|Undelete|Upsert|Merge)Statement)',
			),
		),
		xpath.matchAll(
			createNodeTypeRegex(
				'((?:Constructor|Values|Map|SizedArray)Initializer)',
			),
		),
		xpath.matchAll(createNodeTypeRegex('(ModifierNode|KeywordModifier)')),
		xpath.matchAll(
			createNodeTypeRegex(
				'(TypeRef|Identifier|StandardCondition|WhenValue|WhenType|WhenElse|EnumValue|AnnotationParameter|SoqlOrSoslBinding|FormalComment|MapEntryNode|SuperExpression|ThisVariableExpression|CompoundStatement|BreakStatement|ContinueStatement|EmptyStatement|TriggerDeclaration)',
			),
		),
		xpath.matchAll(createNodeTypeRegex('(SoqlExpression|SoslExpression)')),
	];
}

/**
 * Extract AST node types from XPath expression.
 * Comprehensive extraction covering all PMD AST node types:
 * - Root: ApexFile, CompilationUnit
 * - Declarations: Method, FieldDeclaration, UserClass, UserInterface, UserEnum, etc.
 * - Expressions: LiteralExpression, BinaryExpression, MethodCallExpression, etc.
 * - Statements: IfBlockStatement, WhileLoopStatement, ForLoopStatement, etc.
 * - Initializers: ConstructorInitializer, ValuesInitializer, MapInitializer, etc.
 * - Modifiers: ModifierNode, KeywordModifier
 * - Other: TypeRef, Identifier, StandardCondition, WhenValue, WhenType, WhenElse, etc.
 * Filters out PMD attribute names (e.g., ReferenceType, Image, Name) which are not node types.
 * @param xpath - XPath expression to analyze.
 * @returns Array of unique AST node types found.
 */
export function extractNodeTypes(xpath: Readonly<string>): string[] {
	const MIN_STRING_LENGTH = 0;
	if (xpath.length === MIN_STRING_LENGTH) {
		return [];
	}

	const nodeTypes = new Set<string>();
	const allMatches = getAllNodeTypePatterns(xpath);

	for (const matches of allMatches) {
		extractMatchesToSet(matches, nodeTypes);
	}

	return Array.from(nodeTypes);
}
