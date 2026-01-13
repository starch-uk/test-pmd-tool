/**
 * @file
 * Unit tests for parseViolations function.
 */
/* eslint-disable @typescript-eslint/strict-void-return */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseViolations } from '../../../src/pmd/parseViolations.js';

/**
 * Helper to suppress console output during XML parsing.
 * @template T - Return type of the function.
 * @param fn - Function to execute with suppressed console output.
 * @returns Result of the function execution.
 */
function suppressConsoleOutput<T>(fn: () => T): T {
	const originalWarn = console.warn;
	const originalError = console.error;
	console.warn = vi.fn();
	console.error = vi.fn();
	try {
		return fn();
	} finally {
		console.warn = originalWarn;
		console.error = originalError;
	}
}

describe('parseViolations', () => {
	beforeEach(() => {
		// Suppress xmldom warnings and errors for all tests
		console.warn = vi.fn();
		console.error = vi.fn();
	});

	afterEach(() => {
		// Restore console methods
		vi.restoreAllMocks();
	});
	it('should parse valid PMD XML output into violations array', () => {
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation beginline="5" begincolumn="10" endline="5" endcolumn="20"
               rule="TestRule" ruleset="TestRuleset" priority="3">
      Test violation message
    </violation>
    <violation beginline="10" begincolumn="5" endline="10" endcolumn="15"
               rule="AnotherRule" ruleset="TestRuleset" priority="2">
      Another violation message
    </violation>
  </file>
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(2);
		expect(violations[0]).toEqual({
			column: 10,
			line: 5,
			message: 'Test violation message',
			priority: 3,
			rule: 'TestRule',
		});
		expect(violations[1]).toEqual({
			column: 5,
			line: 10,
			message: 'Another violation message',
			priority: 2,
			rule: 'AnotherRule',
		});
	});

	it('should handle XML with missing attributes gracefully', () => {
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation rule="TestRule">
      Message without attributes
    </violation>
  </file>
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(1);
		expect(violations[0]).toEqual({
			column: 0,
			line: 0,
			message: 'Message without attributes',
			priority: 5, // Default priority
			rule: 'TestRule',
		});
	});

	it('should handle XML with no message content', () => {
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation rule="TestRule"></violation>
  </file>
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(1);
		expect(violations[0]).toEqual({
			column: 0,
			line: 0,
			message: '', // Empty string fallback
			priority: 5,
			rule: 'TestRule',
		});
	});

	it('should handle XML with textContent fallback for message', () => {
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation beginline="1" rule="TestRule">
      <![CDATA[Message with CDATA]]>
    </violation>
  </file>
</pmd>`;

		const result = parseViolations(xmlOutput);

		expect(result).toHaveLength(1);
		expect(result[0].message).toBe('Message with CDATA');
	});

	it('should handle malformed XML gracefully', () => {
		const malformedXml = `<not-xml>This is not valid XML`;

		// xmldom parser may not throw for all malformed XML, it may return empty results
		const result = suppressConsoleOutput(() =>
			parseViolations(malformedXml),
		);
		expect(Array.isArray(result)).toBe(true);
	});

	it('should use textContent when message attribute is missing', () => {
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation beginline="5" rule="TestRule">
      Text content message
    </violation>
  </file>
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(1);
		expect(violations[0].message).toBe('Text content message');
		expect(violations[0].line).toBe(5);
	});

	it('should use textContent fallback when message attribute is missing and textContent exists', () => {
		// Test the textContent ?? DEFAULT_MESSAGE branch when textContent is not null (line 67)
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation beginline="7" rule="TestRule">
      Fallback message from textContent
    </violation>
  </file>
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(1);
		// When messageAttr is missing, should use textContent
		expect(violations[0].message).toBe('Fallback message from textContent');
		expect(violations[0].line).toBe(7);
	});

	it('should use DEFAULT_MESSAGE when both messageAttr and textContent are missing', () => {
		// Test the DEFAULT_MESSAGE fallback when textContent is empty
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation beginline="9" rule="TestRule"></violation>
  </file>
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(1);
		// When both messageAttr and textContent are missing/empty, should use DEFAULT_MESSAGE ('')
		expect(violations[0].message).toBe('');
		expect(violations[0].line).toBe(9);
	});

	it('should use message attribute when present', () => {
		// Test the hasMessageAttr true branch (line 67)
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation beginline="10" rule="TestRule" message="Message from attribute">
      Text content that should be ignored
    </violation>
  </file>
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(1);
		// When messageAttr is present, it should be used instead of textContent
		expect(violations[0].message).toBe('Message from attribute');
		expect(violations[0].line).toBe(10);
	});

	it('should handle multiple files in XML output', () => {
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/File1.cls">
    <violation beginline="1" rule="Rule1">File1 violation</violation>
  </file>
  <file name="/path/to/File2.cls">
    <violation beginline="2" rule="Rule2">File2 violation</violation>
  </file>
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(2);
		expect(violations[0].message).toBe('File1 violation');
		expect(violations[1].message).toBe('File2 violation');
	});

	it('should handle empty XML gracefully', () => {
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(0);
	});

	it('should handle malformed XML gracefully', () => {
		const malformedXml = `<pmd><file><violation>Missing closing tags`;

		// xmldom doesn't throw for malformed XML, it just produces warnings
		suppressConsoleOutput(() => {
			expect(() => parseViolations(malformedXml)).not.toThrow();
		});
	});

	it('should parse priority as number', () => {
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation beginline="1" rule="TestRule" priority="1">High priority</violation>
    <violation beginline="2" rule="TestRule" priority="5">Normal priority</violation>
  </file>
</pmd>`;

		const violations = parseViolations(xmlOutput);

		expect(violations[0].priority).toBe(1);
		expect(violations[1].priority).toBe(5);
	});

	it('should handle violations without rule attribute', () => {
		const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/path/to/TestClass.cls">
    <violation beginline="1">Violation without rule attribute</violation>
  </file>
</pmd>`;

		const violations = suppressConsoleOutput(() =>
			parseViolations(xmlOutput),
		);

		expect(violations).toHaveLength(1);
		expect(violations[0].rule).toBe('');
		expect(violations[0].message).toBe('Violation without rule attribute');
	});
});
