import { describe, it, expect, vi } from 'vitest';
import { parseViolations } from '../../../src/pmd/parseViolations.js';

// Helper to suppress console output during XML parsing
function suppressConsoleOutput(fn: () => any) {
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
			line: 5,
			column: 10,
			message: 'Test violation message',
			rule: 'TestRule',
			priority: 3,
		});
		expect(violations[1]).toEqual({
			line: 10,
			column: 5,
			message: 'Another violation message',
			rule: 'AnotherRule',
			priority: 2,
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
			line: 0,
			column: 0,
			message: 'Message without attributes',
			rule: 'TestRule',
			priority: 5, // Default priority
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
			line: 0,
			column: 0,
			message: '', // Empty string fallback
			rule: 'TestRule',
			priority: 5,
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
		const result = suppressConsoleOutput(() => parseViolations(malformedXml));
		expect(Array.isArray(result)).toBe(true);
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
		expect(() => parseViolations(malformedXml)).not.toThrow();
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

		const violations = parseViolations(xmlOutput);

		expect(violations).toHaveLength(1);
		expect(violations[0].rule).toBe('');
		expect(violations[0].message).toBe('Violation without rule attribute');
	});
});
