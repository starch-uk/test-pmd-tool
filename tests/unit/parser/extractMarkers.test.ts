import { describe, it, expect } from 'vitest';
import { extractMarkers } from '../../../src/parser/extractMarkers.js';

describe('extractMarkers', () => {
	it('should extract inline violation markers', () => {
		const content = `
public class TestClass {
    private String field; // ❌ Invalid field access
    public void method() {
        System.debug('test'); // ✅ Valid debug statement
    }
}
`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0]).toEqual({
			lineNumber: 3,
			description: 'Inline violation marker // ❌',
			isViolation: true,
			index: 0,
		});

		expect(validMarkers).toHaveLength(1);
		expect(validMarkers[0]).toEqual({
			lineNumber: 5,
			description: 'Inline valid marker // ✅',
			isViolation: false,
			index: 0,
		});
	});

	it('should extract section markers when no inline markers present', () => {
		const content = `
// Violation: Using magic numbers
public class TestClass {
    private Integer value = 42;
}

// Valid: Using constants
public class ValidClass {
    private static final Integer MAX_VALUE = 100;
}
`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0]).toEqual({
			lineNumber: 2,
			description: 'Using magic numbers',
			isViolation: true,
			index: 0,
		});

		expect(validMarkers).toHaveLength(1);
		expect(validMarkers[0]).toEqual({
			lineNumber: 7,
			description: 'Using constants',
			isViolation: false,
			index: 0,
		});
	});

	it('should prioritize inline markers over section markers', () => {
		const content = `
// Violation: Section violation
public class TestClass {
    private String field; // ❌ Inline violation overrides section
}
`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0]).toEqual({
			lineNumber: 4,
			description: 'Inline violation marker // ❌',
			isViolation: true,
			index: 0,
		});
		expect(validMarkers).toHaveLength(0);
	});

	it('should handle multiple markers of each type', () => {
		const content = `
public class TestClass {
    private Integer x = 1; // ❌ First violation
    private Integer y = 2; // ❌ Second violation
    private String name; // ✅ First valid
    private Integer age; // ✅ Second valid
}
`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(2);
		expect(violationMarkers[0].lineNumber).toBe(3);
		expect(violationMarkers[1].lineNumber).toBe(4);

		expect(validMarkers).toHaveLength(2);
		expect(validMarkers[0].lineNumber).toBe(5);
		expect(validMarkers[1].lineNumber).toBe(6);
	});

	it('should handle empty content', () => {
		const { violationMarkers, validMarkers } = extractMarkers('');

		expect(violationMarkers).toHaveLength(0);
		expect(validMarkers).toHaveLength(0);
	});

	it('should handle content without markers', () => {
		const content = `
public class TestClass {
    private String field;
    public void method() {
        System.debug('test');
    }
}
`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(0);
		expect(validMarkers).toHaveLength(0);
	});

	it('should correctly identify line numbers', () => {
		const content = `line1
line2
line3 // ❌ marker on line 3
line4
line5 // ✅ marker on line 5
line6`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers[0].lineNumber).toBe(3);
		expect(validMarkers[0].lineNumber).toBe(5);
	});

	it('should assign correct indices to markers', () => {
		const content = `
first // ❌
second // ❌
third // ✅
fourth // ✅
`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers[0].index).toBe(0);
		expect(violationMarkers[1].index).toBe(1);
		expect(validMarkers[0].index).toBe(0);
		expect(validMarkers[1].index).toBe(1);
	});
});
