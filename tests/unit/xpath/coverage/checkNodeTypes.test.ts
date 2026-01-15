/**
 * @file
 * Unit tests for checkNodeTypes and hasNestedClasses functions.
 */
import { describe, it, expect } from 'vitest';
import {
	checkNodeTypes,
	hasNestedClasses,
} from '../../../../src/xpath/coverage/checkNodeTypes.js';

describe('checkNodeTypes', () => {
	it('should return success when no node types provided', () => {
		const result = checkNodeTypes([], 'public class Test {}');

		expect(result.success).toBe(true);
		expect(result.message).toBe('No node types to check');
		expect(result.evidence).toHaveLength(0);
	});

	it('should return failure when content is empty', () => {
		const result = checkNodeTypes(['Method'], '');

		expect(result.success).toBe(false);
		expect(result.message).toBe('No content to check node types against');
		expect(result.evidence).toHaveLength(1);
		expect(result.evidence[0]?.description).toBe(
			'Node types found in XPath but no content to validate',
		);
	});

	it('should return success when no checkable node types found', () => {
		const result = checkNodeTypes(['StandardCondition'], 'public class Test {}');

		expect(result.success).toBe(true);
		expect(result.message).toBe('No checkable node types found');
	});

	it('should detect covered node types', () => {
		const content = `
public class TestClass {
    public void method() {
        if (condition) {
            System.debug('test');
        }
    }
}
`;
		const result = checkNodeTypes(
			['ClassDeclaration', 'IfBlockStatement', 'Method'],
			content,
		);

		expect(result.success).toBe(true);
		expect(result.message).toContain('All');
		expect(result.evidence[0]?.count).toBe(3);
	});

	it('should detect missing node types', () => {
		const content = 'public class TestClass {}';
		const result = checkNodeTypes(
			['ClassDeclaration', 'IfBlockStatement', 'WhileLoopStatement'],
			content,
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain('not covered');
		expect(result.message).toContain('IfBlockStatement');
		expect(result.message).toContain('WhileLoopStatement');
	});

	it('should handle UserClass node type with nested classes', () => {
		const content = `
public class OuterClass {
    public class InnerClass {
        private Integer value;
    }
}
`;
		const result = checkNodeTypes(['UserClass'], content);

		expect(result.success).toBe(true);
		expect(result.message).toContain('All');
	});

	it('should handle UserClass node type without nested classes', () => {
		const content = 'public class TestClass {}';
		const result = checkNodeTypes(['UserClass'], content);

		expect(result.success).toBe(false);
		expect(result.message).toContain('not covered');
	});

	it('should handle multiple node types with mixed coverage', () => {
		const content = `
public class TestClass {
    public void method() {
        if (condition) {
            System.debug('test');
        }
    }
}
`;
		const result = checkNodeTypes(
			['ClassDeclaration', 'IfBlockStatement', 'WhileLoopStatement'],
			content,
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain('not covered');
		expect(result.message).toContain('WhileLoopStatement');
	});

	it('should handle node types with default keyword mapping', () => {
		const content = 'public class TestClass { unknownnodetype test; }';
		const result = checkNodeTypes(['UnknownNodeType'], content);

		expect(result.success).toBe(true);
		expect(result.message).toContain('All');
	});

	it('should handle ForEachStatement node type', () => {
		const content = 'for (String item : items) { }';
		const result = checkNodeTypes(['ForEachStatement'], content);

		expect(result.success).toBe(true);
	});

	it('should handle DoWhileLoopStatement node type', () => {
		const content = 'do { } while (condition);';
		const result = checkNodeTypes(['DoWhileLoopStatement'], content);

		expect(result.success).toBe(true);
	});

	it('should handle SwitchStatement node type', () => {
		const content = 'switch (value) { case 1: break; }';
		const result = checkNodeTypes(['SwitchStatement'], content);

		expect(result.success).toBe(true);
	});

	it('should handle TryCatchFinallyBlockStatement node type', () => {
		const content = 'try { } catch (Exception e) { }';
		const result = checkNodeTypes(['TryCatchFinallyBlockStatement'], content);

		expect(result.success).toBe(true);
	});

	it('should handle TernaryExpression node type', () => {
		const content = 'Integer x = condition ? 1 : 2;';
		const result = checkNodeTypes(['TernaryExpression'], content);

		expect(result.success).toBe(true);
	});

	it('should handle MethodCallExpression node type', () => {
		const content = 'method();';
		const result = checkNodeTypes(['MethodCallExpression'], content);

		expect(result.success).toBe(true);
	});

	it('should handle PropertyDeclaration node type', () => {
		const content = 'public property String name { get; set; }';
		const result = checkNodeTypes(['PropertyDeclaration'], content);

		expect(result.success).toBe(true);
	});

	it('should handle InterfaceDeclaration node type', () => {
		const content = 'public interface TestInterface {}';
		const result = checkNodeTypes(['InterfaceDeclaration'], content);

		expect(result.success).toBe(true);
	});

	it('should handle FieldDeclaration node type', () => {
		const content = 'private Integer field;';
		const result = checkNodeTypes(['FieldDeclaration'], content);

		expect(result.success).toBe(true);
	});

	it('should handle content with only whitespace', () => {
		const result = checkNodeTypes(['Method'], '   \n\t  ');

		expect(result.success).toBe(false);
		expect(result.message).toBe('No content to check node types against');
	});
});

describe('hasNestedClasses', () => {
	it('should return true for nested classes', () => {
		const content = `
public class OuterClass {
    public class InnerClass {
        private Integer value;
    }
}
`;
		const result = hasNestedClasses(content);

		expect(result).toBe(true);
	});

	it('should return false for single class', () => {
		const content = 'public class TestClass {}';
		const result = hasNestedClasses(content);

		expect(result).toBe(false);
	});

	it('should return false for multiple top-level classes', () => {
		const content = `
public class Class1 {}
public class Class2 {}
`;
		const result = hasNestedClasses(content);

		expect(result).toBe(false);
	});

	it('should return true for deeply nested classes', () => {
		const content = `
public class Outer {
    public class Middle {
        public class Inner {
            private Integer value;
        }
    }
}
`;
		const result = hasNestedClasses(content);

		expect(result).toBe(true);
	});

	it('should handle classes with methods and fields', () => {
		const content = `
public class Outer {
    private Integer field;
    
    public void method() {
        public class Inner {
            private String innerField;
        }
    }
}
`;
		const result = hasNestedClasses(content);

		expect(result).toBe(true);
	});

	it('should return false for empty content', () => {
		const result = hasNestedClasses('');

		expect(result).toBe(false);
	});

	it('should return false for content without classes', () => {
		const content = 'Integer x = 1; String name = "test";';
		const result = hasNestedClasses(content);

		expect(result).toBe(false);
	});

	it('should return false for sequential classes (not nested)', () => {
		// Sequential classes are not nested - they're separate top-level classes
		const content = `
public class Outer {
    private Integer value;
}
public class Another {
    private String name;
}
`;
		const result = hasNestedClasses(content);

		expect(result).toBe(false);
	});

	it('should handle brace depth correctly', () => {
		const content = `
public class Outer {
    {
        public class Inner {}
    }
}
`;
		const result = hasNestedClasses(content);

		expect(result).toBe(true);
	});

	it('should detect nested class when insideClass is true and braceDepth > 1', () => {
		// This tests the specific condition: insideClass && braceDepth > BRACE_DEPTH_ONE
		// We need to be inside a class (insideClass = true) and at depth > 1 when we find another class
		// The braceDepth is counted per line, so we need the Inner class to be declared
		// when we're already inside Outer (braceDepth > 1)
		const content = `public class Outer {
    private Integer value;
    public class Inner {
        private String innerValue;
    }
}`;
		const result = hasNestedClasses(content);

		expect(result).toBe(true);
	});

	it('should reset insideClass when braceDepth returns to one', () => {
		// Tests line 59: when braceDepth === BRACE_DEPTH_ONE, insideClass should be set to false
		// We need to process a closing brace that brings braceDepth from >1 back to exactly 1
		// This happens when we close the outer class
		const content = `public class Outer {
    private Integer value;
    public void method() {
        // Some code
    }
}
// After closing brace, braceDepth is now 1, insideClass should be false
public class Another {
    // This should not be detected as nested since insideClass was reset
}`;
		const result = hasNestedClasses(content);

		expect(result).toBe(false);
		// Verify that the reset happened by checking a class after the first one closes
		// If insideClass wasn't reset, the second class might be incorrectly detected
	});
});
