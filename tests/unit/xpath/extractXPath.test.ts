/**
 * @file
 * Unit tests for extractXPath function.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractXPath } from '../../../src/xpath/extractXPath.js';

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

// Mock file system
vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

// Mock DOMParser for null textContent test
vi.mock('@xmldom/xmldom', async () => {
	const actual = await vi.importActual('@xmldom/xmldom');
	const ActualDOMParser = actual.DOMParser;
	return {
		...actual,
		DOMParser: class MockDOMParser extends ActualDOMParser {
			public parseFromString(xml: string): Document {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Dynamic import result
				const doc = super.parseFromString(xml, 'text/xml');
				// Find value elements and set textContent to null for testing
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Dynamic import result
				const valueElements = doc.getElementsByTagName('value');
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Array.from accepts NodeList
				for (const elem of Array.from(valueElements)) {
					if (elem?.textContent === '') {
						Object.defineProperty(elem, 'textContent', {
							configurable: true,
							value: null,
							writable: true,
						});
					}
				}
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Dynamic import result
				return doc;
			}
		},
	};
});

const mockedReadFileSync = vi.mocked(readFileSync);

describe('extractXPath', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should extract XPath from valid PMD rule XML', () => {
		const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule"
      language="apex"
      message="Test message"
      class="net.sourceforge.pmd.lang.apex.rule.TestRule">
  <description>Test rule description</description>
  <priority>3</priority>
  <properties>
    <property name="xpath">
      <value>//Method[@Visibility='public' and @Name='test']</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXml);

		const result = extractXPath('/path/to/rule.xml');

		expect(result.success).toBe(true);
		expect(result.data).toBe(
			"//Method[@Visibility='public' and @Name='test']",
		);
	});

	it('should return null when no xpath property exists', () => {
		const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="otherProperty">
      <value>some value</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXml);

		const result = extractXPath('/path/to/rule.xml');

		expect(result.success).toBe(true);
		expect(result.data).toBe(null);
	});

	it('should return null when value element has no text content', () => {
		const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value></value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXml);

		const result = extractXPath('/path/to/rule.xml');

		expect(result.success).toBe(true);
		expect(result.data).toBe(null);
	});

	it('should return null when no properties element exists', () => {
		const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <description>Test description</description>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXml);

		const result = extractXPath('/path/to/rule.xml');

		expect(result.success).toBe(true);
		expect(result.data).toBe(null);
	});

	it('should handle xpath property without value element', () => {
		const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXml);

		const result = extractXPath('/path/to/rule.xml');

		expect(result.success).toBe(true);
		expect(result.data).toBe(null);
	});

	it('should trim whitespace from xpath value', () => {
		const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>
        //Method[@Name='test']
      </value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXml);

		const result = extractXPath('/path/to/rule.xml');

		expect(result.success).toBe(true);
		expect(result.data).toBe("//Method[@Name='test']");
	});

	it('should handle complex xpath expressions', () => {
		const complexXPath = `//Method[
  @Visibility='public' and
  @Name='test' and
  not(contains(@Name, 'private'))
]`;

		const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="ComplexRule">
  <properties>
    <property name="xpath">
      <value>${complexXPath}</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXml);

		const result = extractXPath('/path/to/rule.xml');

		expect(result.success).toBe(true);
		expect(result.data).toBe(complexXPath);
	});

	it('should handle file read errors', () => {
		mockedReadFileSync.mockImplementation(() => {
			throw new Error('File not found');
		});

		const result = extractXPath('/path/to/nonexistent.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('Error extracting XPath');
	});

	it('should handle malformed XML gracefully', () => {
		const malformedXml = `<rule><properties><property name="xpath"><value>//test</value></property></properties>`;
		mockedReadFileSync.mockReturnValue(malformedXml);

		// xmldom produces warnings for malformed XML but may still parse partially
		const result = suppressConsoleOutput(() =>
			extractXPath('/path/to/rule.xml'),
		);

		expect(result.success).toBe(true);
		// May return null if XML parsing fails completely
		const { data } = result;
		expect(data === null || data === '//test').toBe(true);
	});

	it('should call readFileSync with correct path and encoding', () => {
		const mockXml = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//test</value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXml);

		extractXPath('/custom/path/rule.xml');

		expect(mockedReadFileSync).toHaveBeenCalledWith(
			'/custom/path/rule.xml',
			'utf-8',
		);
	});

	it('should handle null textContent in value element', () => {
		const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value></value>
    </property>
  </properties>
</rule>`;

		mockedReadFileSync.mockReturnValue(mockXml);

		const result = suppressConsoleOutput(() =>
			extractXPath('/path/to/rule.xml'),
		);

		expect(result.success).toBe(true);
		expect(result.data).toBe(null);
	});

	it('should handle non-Error exceptions', () => {
		// Throw a non-Error object to test the String(error) branch
		mockedReadFileSync.mockImplementation(() => {
			// eslint-disable-next-line @typescript-eslint/only-throw-error -- Testing non-Error exception handling
			throw 'String error';
		});

		const result = extractXPath('/path/to/nonexistent.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('Error extracting XPath');
		expect(result.error).toContain('String error');
	});
});
