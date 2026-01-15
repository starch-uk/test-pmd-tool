/**
 * @file
 * Unit tests for extractMarkers function.
 */
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
			description: 'Inline violation marker: Invalid field access',
			index: 0,
			isViolation: true,
			lineNumber: 3,
		});

		expect(validMarkers).toHaveLength(1);
		expect(validMarkers[0]).toEqual({
			description: 'Inline valid marker: Valid debug statement',
			index: 0,
			isViolation: false,
			lineNumber: 5,
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
			description: 'Using magic numbers',
			index: 0,
			isViolation: true,
			lineNumber: 2,
		});

		expect(validMarkers).toHaveLength(1);
		expect(validMarkers[0]).toEqual({
			description: 'Using constants',
			index: 0,
			isViolation: false,
			lineNumber: 7,
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
			description:
				'Inline violation marker: Inline violation overrides section',
			index: 0,
			isViolation: true,
			lineNumber: 4,
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
		expect(violationMarkers[0].description).toBe(
			'Inline violation marker: First violation',
		);
		expect(violationMarkers[1].lineNumber).toBe(4);
		expect(violationMarkers[1].description).toBe(
			'Inline violation marker: Second violation',
		);

		expect(validMarkers).toHaveLength(2);
		expect(validMarkers[0].lineNumber).toBe(5);
		expect(validMarkers[0].description).toBe(
			'Inline valid marker: First valid',
		);
		expect(validMarkers[1].lineNumber).toBe(6);
		expect(validMarkers[1].description).toBe(
			'Inline valid marker: Second valid',
		);
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

	it('should handle inline markers without descriptive text', () => {
		const content = `
public class TestClass {
    private String field; // ❌
    public void method() {
        System.debug('test'); // ✅
    }
}
`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0]).toEqual({
			description: 'Inline violation marker // ❌',
			index: 0,
			isViolation: true,
			lineNumber: 3,
		});

		expect(validMarkers).toHaveLength(1);
		expect(validMarkers[0]).toEqual({
			description: 'Inline valid marker // ✅',
			index: 0,
			isViolation: false,
			lineNumber: 5,
		});
	});

	it('should handle markers with only whitespace after emoji', () => {
		const content = `
public class TestClass {
    private String field; // ❌   
    public void method() {
        System.debug('test'); // ✅    
    }
}
`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		expect(violationMarkers[0].description).toBe(
			'Inline violation marker // ❌',
		);

		expect(validMarkers).toHaveLength(1);
		expect(validMarkers[0].description).toBe('Inline valid marker // ✅');
	});

	it('should handle markers with only whitespace after emoji', () => {
		// Tests when firstMatch exists but trim() results in empty string
		// This covers the optional chaining branches (lines 39, 55)
		const content = `
public class TestClass {
    private String field; // ❌   
    public void method() {
        System.debug('test'); // ✅    
    }
}
`;

		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		// When firstMatch.trim() is empty, descriptionText.length is 0, so uses default
		expect(violationMarkers[0]?.description).toBe(
			'Inline violation marker // ❌',
		);

		expect(validMarkers).toHaveLength(1);
		expect(validMarkers[0]?.description).toBe('Inline valid marker // ✅');
	});

	it('should handle edge case where marker pattern might not match expected format', () => {
		// This tests the optional chaining branches more thoroughly
		// by ensuring we cover both paths of markerMatch?.[FIRST_MATCH_GROUP_INDEX]
		const content = 'code // ❌\ncode2 // ✅';
		const { violationMarkers, validMarkers } = extractMarkers(content);

		expect(violationMarkers).toHaveLength(1);
		expect(validMarkers).toHaveLength(1);
		// Both branches of optional chaining should be covered
	});
});
