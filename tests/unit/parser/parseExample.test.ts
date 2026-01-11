import { describe, it, expect } from 'vitest';
import { parseExample } from '../../../src/parser/parseExample.js';

describe('parseExample', () => {
	it('should parse example with inline markers', () => {
		const content = `
// Violation: Using magic numbers
public class TestClass {
    private Integer value = 42; // ❌ Magic number usage
    private String name = 'test'; // ✅ Valid string literal
}

public void method() {
    Integer x = 100; // ❌ Another magic number
}
`;

		const result = parseExample(content);

		expect(result.violations).toEqual([
			'public class TestClass {',
			'private Integer value = 42;',
			'}',
			'public void method() {',
			'Integer x = 100;',
			'}',
		]);

		expect(result.valids).toEqual(["private String name = 'test';"]);

		expect(result.violationMarkers).toHaveLength(2);
		expect(result.validMarkers).toHaveLength(1);
	});

	it('should parse example with section markers', () => {
		const content = `
// Violation: Magic numbers
public class TestClass {
    private Integer value = 42;
    private Integer count = 10;
}

// Valid: Constants
public class ValidClass {
    private static final Integer MAX_VALUE = 100;
}
`;

		const result = parseExample(content);

		expect(result.violations).toEqual([
			'public class TestClass {',
			'    private Integer value = 42;',
			'    private Integer count = 10;',
			'}',
		]);

		expect(result.valids).toEqual([
			'public class ValidClass {',
			'    private static final Integer MAX_VALUE = 100;',
			'}',
		]);
	});


	it('should handle mixed inline and section markers', () => {
		const content = `
// Violation: Section violation
public class TestClass {
    private Integer x = 1; // ❌ Inline violation
    private Integer y = 2; // ✅ Inline valid
}
`;

		const result = parseExample(content);

		expect(result.violations).toEqual([
			'public class TestClass {',
			'private Integer x = 1;',
			'}',
		]);

		expect(result.valids).toEqual(['private Integer y = 2;']);
	});

	it('should clean inline markers from code', () => {
		const content = `
public class TestClass {
    private Integer field = 42; // ❌ Magic number
    private String name = 'test'; // ✅ Valid
}
`;

		const result = parseExample(content);

		expect(result.violations).toEqual(['private Integer field = 42;']);

		expect(result.valids).toEqual(["private String name = 'test';"]);
	});

	it('should handle empty sections', () => {
		const content = `
// Violation: Empty violation section
// Valid: Empty valid section
public class TestClass {
    // Some code
}
`;

		const result = parseExample(content);

		expect(result.violations).toHaveLength(0);
		expect(result.valids).toEqual(['public class TestClass {', '}']);
	});

	it('should preserve original content', () => {
		const originalContent = `
public class TestClass {
    private Integer field;
}
`;

		const result = parseExample(originalContent);
		expect(result.content).toBe(originalContent);
	});

	it('should handle code without mode switches', () => {
		const content = `
public class TestClass {
    private Integer field1 = 1;
    private Integer field2 = 2;
}
`;

		const result = parseExample(content);

		// No markers, so no code should be categorized
		expect(result.violations).toHaveLength(0);
		expect(result.valids).toHaveLength(0);
	});

	it('should handle complex class structures', () => {
		const content = `
// Violation: Inner classes
public class OuterClass {
    // ❌ Inner class
    public class InnerClass {
        private Integer value = 42;
    }
}

// Valid: Top-level classes
public class ValidClass {
    private Integer value = 100;
}
`;

		const result = parseExample(content);

		expect(result.violations).toEqual([
			'public class OuterClass {',
			'    public class InnerClass {',
			'        private Integer value = 42;',
			'    }',
			'}',
		]);

		expect(result.valids).toEqual([
			'public class ValidClass {',
			'    private Integer value = 100;',
			'}',
		]);
	});

	it('should handle markers in the middle of code lines', () => {
		const content = `
public class TestClass {
    private Integer x = calculateValue(); // ❌ Complex calculation
    private Integer y = getDefaultValue(); // ✅ Simple getter
}
`;

		const result = parseExample(content);

		expect(result.violations).toEqual([
			'private Integer x = calculateValue();',
		]);

		expect(result.valids).toEqual([
			'private Integer y = getDefaultValue();',
		]);
	});
});
