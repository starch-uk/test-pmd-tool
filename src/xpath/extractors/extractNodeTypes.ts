/**
 * @file
 * Node type extraction from XPath expressions.
 * Based on PMD Apex AST Reference (PMD 7+).
 */

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
 * @param xpath - XPath expression to analyze.
 * @returns Array of unique AST node types found.
 */
export function extractNodeTypes(xpath: string): string[] {
	const MIN_STRING_LENGTH = 0;
	if (xpath.length === MIN_STRING_LENGTH) return [];

	const nodeTypes = new Set<string>();

	// Pattern 1: Match nodes ending with Statement, Expression, Declaration, Node, Block
	// Covers: IfBlockStatement, WhileLoopStatement, BinaryExpression, FieldDeclaration, etc.
	const nodeTypeMatches1 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)([A-Z][a-zA-Z]*(?:Statement|Expression|Declaration|Node|Block))(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 2: Match standalone AST node types
	// Covers: Method, Field, Type, Condition, Loop, Block, Parameter, Property, Annotation
	const nodeTypeMatches2 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)(Method|Field|Class|Type|Condition|Loop|Block|Parameter|Property|Annotation)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 3: Match nodes containing Method/Class/Field/etc. in their names
	// Covers: MethodCallExpression, UserClass, UserInterface, UserEnum, etc.
	const nodeTypeMatches3 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)([A-Z][a-zA-Z]*(?:Method|Class|Field|Condition|Loop|Type)[a-zA-Z]*)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 4: Match root nodes (ApexFile, CompilationUnit)
	const nodeTypeMatches4 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)(ApexFile|CompilationUnit)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 5: Match User* nodes (UserClass, UserInterface, UserEnum)
	const nodeTypeMatches5 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)(UserClass|UserInterface|UserEnum)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 6: Match DML statement nodes
	// Covers: DmlInsertStatement, DmlUpdateStatement, DmlDeleteStatement, etc.
	const nodeTypeMatches6 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)(Dml(?:Insert|Update|Delete|Undelete|Upsert|Merge)Statement)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 7: Match initializer nodes
	// Covers: ConstructorInitializer, ValuesInitializer, MapInitializer, SizedArrayInitializer
	const nodeTypeMatches7 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)((?:Constructor|Values|Map|SizedArray)Initializer)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 8: Match modifier nodes
	// Covers: ModifierNode, KeywordModifier
	const nodeTypeMatches8 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)(ModifierNode|KeywordModifier)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 9: Match other important nodes
	// Covers: TypeRef, Identifier, StandardCondition, WhenValue, WhenType, WhenElse, etc.
	// Also covers: CompoundStatement, BreakStatement, ContinueStatement, EmptyStatement, TriggerDeclaration
	const nodeTypeMatches9 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)(TypeRef|Identifier|StandardCondition|WhenValue|WhenType|WhenElse|EnumValue|AnnotationParameter|SoqlOrSoslBinding|FormalComment|MapEntryNode|SuperExpression|ThisVariableExpression|CompoundStatement|BreakStatement|ContinueStatement|EmptyStatement|TriggerDeclaration)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	// Pattern 10: Match SOQL/SOSL expression nodes
	const nodeTypeMatches10 = xpath.matchAll(
		/(?:\.\/\/|\/\/|\s|\/|\(|\[|,|\|)(SoqlExpression|SoslExpression)(?=\s|$|\[|\(|\/|\)|,|\||]|or|and|not|return|let)/g,
	);

	const MATCH_INDEX = 1;

	// Add all matches to the set
	const allMatches = [
		nodeTypeMatches1,
		nodeTypeMatches2,
		nodeTypeMatches3,
		nodeTypeMatches4,
		nodeTypeMatches5,
		nodeTypeMatches6,
		nodeTypeMatches7,
		nodeTypeMatches8,
		nodeTypeMatches9,
		nodeTypeMatches10,
	];

	for (const matches of allMatches) {
		for (const match of matches) {
			// Regex capture groups require at least one character, so match[1] is always defined
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Regex capture group ensures match[1] is defined
			const nodeType = match[MATCH_INDEX]!;
			nodeTypes.add(nodeType);
		}
	}

	return Array.from(nodeTypes);
}
