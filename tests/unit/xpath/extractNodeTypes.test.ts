/**
 * @file
 * Unit tests for extractNodeTypes function.
 */
import { describe, it, expect } from 'vitest';
import { extractNodeTypes } from '../../../src/xpath/extractors/extractNodeTypes.js';

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
});
