/**
 * @file
 * Unit tests for extractNodeTypes function.
 */
import { describe, it, expect } from 'vitest';
import { extractNodeTypes } from '../../src/xpath/extractNodeTypes.js';

describe('extractNodeTypes', () => {
	it('should extract Statement node types', () => {
		const xpath = '//IfBlockStatement[condition]//WhileLoopStatement';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('IfBlockStatement');
		expect(result).toContain('WhileLoopStatement');
	});

	it('should extract Expression node types', () => {
		const xpath = '//MethodCallExpression//BinaryExpression';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('MethodCallExpression');
		expect(result).toContain('BinaryExpression');
	});

	it('should extract Declaration node types', () => {
		const xpath = '//FieldDeclaration//MethodDeclaration';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('FieldDeclaration');
		expect(result).toContain('MethodDeclaration');
	});

	it('should extract Node types', () => {
		const xpath = '//ASTNode//BlockStatement';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('ASTNode');
		expect(result).toContain('BlockStatement');
	});

	it('should extract standalone node types', () => {
		const xpath = '//Method//Field//Class';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('Method');
		expect(result).toContain('Field');
		expect(result).toContain('Class');
	});

	it('should extract complex node names with qualifiers', () => {
		const xpath = '//NewObjectLiteralExpression//MethodCallExpression';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('NewObjectLiteralExpression');
		expect(result).toContain('MethodCallExpression');
	});

	it('should handle different xpath axes and selectors', () => {
		const xpath =
			'.//IfBlockStatement | //WhileLoopStatement | /MethodDeclaration';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('IfBlockStatement');
		expect(result).toContain('WhileLoopStatement');
		expect(result).toContain('MethodDeclaration');
	});

	it('should deduplicate node types', () => {
		const xpath = '//IfBlockStatement//IfBlockStatement//MethodDeclaration';
		const result = extractNodeTypes(xpath);

		const ifStatements = result.filter(
			(type) => type === 'IfBlockStatement',
		);
		expect(ifStatements).toHaveLength(1);
	});

	it('should handle node types in predicates', () => {
		const xpath = '//Method[BlockStatement]';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('Method');
		expect(result).toContain('BlockStatement');
	});

	it('should handle node types with attributes', () => {
		const xpath =
			"//Method[@Name='test']//FieldDeclaration[@Type='String']";
		const result = extractNodeTypes(xpath);

		expect(result).toContain('Method');
		expect(result).toContain('FieldDeclaration');
	});

	it('should ignore non-node-type patterns', () => {
		const xpath = "//div[@class='test']//span[contains(text(),'hello')]";
		const result = extractNodeTypes(xpath);

		expect(result).toHaveLength(0);
	});

	it('should handle empty xpath', () => {
		const result = extractNodeTypes('');
		expect(result).toHaveLength(0);
	});

	it('should handle xpath with only operators and functions', () => {
		const xpath = 'count(//*) + sum(//Method)';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('Method');
	});

	it('should extract node types from complex xpath with let expressions', () => {
		const xpath = `let $methods := //Method
return $methods//IfBlockStatement`;
		const result = extractNodeTypes(xpath);

		expect(result).toContain('Method');
		expect(result).toContain('IfBlockStatement');
	});

	it('should handle xpath with nested predicates', () => {
		const xpath =
			"//Class[//Method[@Visibility='public']]//FieldDeclaration";
		const result = extractNodeTypes(xpath);

		expect(result).toContain('Class');
		expect(result).toContain('Method');
		expect(result).toContain('FieldDeclaration');
	});

	it('should extract LiteralExpression node type', () => {
		const xpath = '//LiteralExpression[@LiteralType = "INTEGER"]';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('LiteralExpression');
	});

	it('should extract ModifierNode node type', () => {
		const xpath = '//ModifierNode[@Static = true() and @Final = true()]';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('ModifierNode');
	});

	it('should extract Annotation node types', () => {
		const xpath = '//Annotation | //AnnotationParameter';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('Annotation');
		expect(result).toContain('AnnotationParameter');
	});

	it('should skip matches with undefined nodeType', () => {
		// Test with xpath that might produce matches without capture groups
		// This ensures the undefined check works correctly
		const xpath = '//Method[@Name="test"]';
		const result = extractNodeTypes(xpath);

		// Should handle gracefully and still extract Method
		expect(result).toContain('Method');
		expect(Array.isArray(result)).toBe(true);
	});

	it('should filter out PMD attribute names like ReferenceType', () => {
		const xpath =
			'//MethodCallExpression[@FullMethodName = "split" and ./*[1][self::ReferenceExpression[@ReferenceType = "METHOD"]]]';
		const result = extractNodeTypes(xpath);

		expect(result).not.toContain('ReferenceType');
		expect(result).toContain('ReferenceExpression');
		expect(result).toContain('MethodCallExpression');
	});

	it('should filter out all PMD attribute names', () => {
		const xpath =
			'//Method[@Name="test" and @Static=true() and @Final=false() and @BeginLine=10 and @Image="test"]';
		const result = extractNodeTypes(xpath);

		// Should not contain attribute names
		expect(result).not.toContain('Name');
		expect(result).not.toContain('Static');
		expect(result).not.toContain('Final');
		expect(result).not.toContain('BeginLine');
		expect(result).not.toContain('Image');
		// Should contain node types
		expect(result).toContain('Method');
	});

	it('should extract root node types (Pattern 4)', () => {
		const xpath = '//ApexFile | /CompilationUnit';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('ApexFile');
		expect(result).toContain('CompilationUnit');
	});

	it('should extract User* node types (Pattern 5)', () => {
		const xpath = '//UserClass | //UserInterface | //UserEnum';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('UserClass');
		expect(result).toContain('UserInterface');
		expect(result).toContain('UserEnum');
	});

	it('should extract DML statement node types (Pattern 6)', () => {
		const xpath =
			'//DmlInsertStatement | //DmlUpdateStatement | //DmlDeleteStatement | //DmlUndeleteStatement | //DmlUpsertStatement | //DmlMergeStatement';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('DmlInsertStatement');
		expect(result).toContain('DmlUpdateStatement');
		expect(result).toContain('DmlDeleteStatement');
		expect(result).toContain('DmlUndeleteStatement');
		expect(result).toContain('DmlUpsertStatement');
		expect(result).toContain('DmlMergeStatement');
	});

	it('should extract initializer node types (Pattern 7)', () => {
		const xpath =
			'//ConstructorInitializer | //ValuesInitializer | //MapInitializer | //SizedArrayInitializer';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('ConstructorInitializer');
		expect(result).toContain('ValuesInitializer');
		expect(result).toContain('MapInitializer');
		expect(result).toContain('SizedArrayInitializer');
	});

	it('should extract KeywordModifier node type (Pattern 8)', () => {
		const xpath = '//KeywordModifier';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('KeywordModifier');
	});

	it('should extract other important node types (Pattern 9)', () => {
		const xpath =
			'//TypeRef | //Identifier | //StandardCondition | //WhenValue | //WhenType | //WhenElse | //EnumValue | //SoqlOrSoslBinding | //FormalComment | //MapEntryNode | //SuperExpression | //ThisVariableExpression | //CompoundStatement | //BreakStatement | //ContinueStatement | //EmptyStatement | //TriggerDeclaration';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('TypeRef');
		expect(result).toContain('Identifier');
		expect(result).toContain('StandardCondition');
		expect(result).toContain('WhenValue');
		expect(result).toContain('WhenType');
		expect(result).toContain('WhenElse');
		expect(result).toContain('EnumValue');
		expect(result).toContain('SoqlOrSoslBinding');
		expect(result).toContain('FormalComment');
		expect(result).toContain('MapEntryNode');
		expect(result).toContain('SuperExpression');
		expect(result).toContain('ThisVariableExpression');
		expect(result).toContain('CompoundStatement');
		expect(result).toContain('BreakStatement');
		expect(result).toContain('ContinueStatement');
		expect(result).toContain('EmptyStatement');
		expect(result).toContain('TriggerDeclaration');
	});

	it('should extract SOQL/SOSL expression node types (Pattern 10)', () => {
		const xpath = '//SoqlExpression | //SoslExpression';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('SoqlExpression');
		expect(result).toContain('SoslExpression');
	});

	it('should handle XPath axes with node types', () => {
		const xpath =
			'self::Method | ancestor::Class | parent::Field | child::MethodDeclaration | descendant::IfBlockStatement | following::WhileLoopStatement | preceding::ForLoopStatement | following-sibling::BreakStatement | preceding-sibling::ContinueStatement';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('Method');
		expect(result).toContain('Class');
		expect(result).toContain('Field');
		expect(result).toContain('MethodDeclaration');
		expect(result).toContain('IfBlockStatement');
		expect(result).toContain('WhileLoopStatement');
		expect(result).toContain('ForLoopStatement');
		expect(result).toContain('BreakStatement');
		expect(result).toContain('ContinueStatement');
	});

	it('should filter out PMD attribute names when they would match pattern keywords', () => {
		// Test case where attribute names like "Type", "Name" could potentially match patterns
		// but should be filtered out
		const xpath =
			'//TypeRef[@Type="String"] | //Method[@Name="test"] | //FieldDeclaration[@ReturnType="Integer"]';
		const result = extractNodeTypes(xpath);

		expect(result).toContain('TypeRef');
		expect(result).toContain('Method');
		expect(result).toContain('FieldDeclaration');
		expect(result).not.toContain('Type');
		expect(result).not.toContain('Name');
		expect(result).not.toContain('ReturnType');
	});

	it('should filter out node types that match patterns but are in PMD_ATTRIBUTE_NAMES', () => {
		// Test case where "Type" matches Pattern 2 (Method|Field|Class|Type|...)
		// but should be filtered out because "Type" is in PMD_ATTRIBUTE_NAMES
		// This tests the false branch of if (!PMD_ATTRIBUTE_NAMES.has(nodeType))
		const xpath = '//Type | //Parameter | //Property | //Annotation';
		const result = extractNodeTypes(xpath);

		// "Type" matches pattern 2 but should be filtered out (branch coverage)
		expect(result).not.toContain('Type');
		// These should still be included (they're in pattern 2 but not in PMD_ATTRIBUTE_NAMES)
		expect(result).toContain('Parameter');
		expect(result).toContain('Property');
		expect(result).toContain('Annotation');
	});
});
