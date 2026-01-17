/**
 * @file
 * Unit tests for extractXPath function.
 */
/* eslint-disable @typescript-eslint/strict-void-return */
import { readFileSync, realpathSync } from 'fs';
import { resolve } from 'path';
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

// Mock file system and path
vi.mock('fs', () => ({
	readFileSync: vi.fn(),
	realpathSync: vi.fn(),
}));

vi.mock('path', () => ({
	resolve: vi.fn(),
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
const mockedRealpathSync = vi.mocked(realpathSync);
const mockedResolve = vi.mocked(resolve);

describe('extractXPath', () => {
	beforeEach(() => {
		// Default mock behavior: resolve and realpathSync return the input path
		mockedResolve.mockImplementation((path: Readonly<string>) => path);
		mockedRealpathSync.mockImplementation((path: Readonly<string>) => path);
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
		const inputPath = '/path/to/nonexistent.xml';
		const resolvedPath = '/resolved/path/to/nonexistent.xml';
		const canonicalPath = '/canonical/path/to/nonexistent.xml';

		mockedResolve.mockReturnValue(resolvedPath);
		mockedRealpathSync.mockReturnValue(canonicalPath);
		mockedReadFileSync.mockImplementation(() => {
			throw new Error('File not found');
		});

		const result = extractXPath(inputPath);

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

	it('should normalize path before reading file', () => {
		const mockXml = `<?xml version="1.0"?>
<rule name="TestRule">
  <properties>
    <property name="xpath">
      <value>//test</value>
    </property>
  </properties>
</rule>`;

		const inputPath = '/custom/path/rule.xml';
		const resolvedPath = '/resolved/path/rule.xml';
		const canonicalPath = '/canonical/path/rule.xml';

		mockedResolve.mockReturnValue(resolvedPath);
		mockedRealpathSync.mockReturnValue(canonicalPath);
		mockedReadFileSync.mockReturnValue(mockXml);

		extractXPath(inputPath);

		expect(mockedResolve).toHaveBeenCalledWith(inputPath);
		expect(mockedRealpathSync).toHaveBeenCalledWith(resolvedPath);
		expect(mockedReadFileSync).toHaveBeenCalledWith(canonicalPath, 'utf-8');
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

	it('should handle path normalization errors', () => {
		const inputPath = '/path/to/rule.xml';
		mockedResolve.mockReturnValue('/resolved/path/rule.xml');
		mockedRealpathSync.mockImplementation(() => {
			throw new Error('Path resolution failed');
		});

		const result = extractXPath(inputPath);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Error extracting XPath');
		expect(result.error).toContain('Path resolution failed');
	});

	it('should handle non-Error exceptions', () => {
		const inputPath = '/path/to/nonexistent.xml';
		const resolvedPath = '/resolved/path/to/nonexistent.xml';
		const canonicalPath = '/canonical/path/to/nonexistent.xml';

		mockedResolve.mockReturnValue(resolvedPath);
		mockedRealpathSync.mockReturnValue(canonicalPath);
		// Throw a non-Error object to test the String(error) branch
		mockedReadFileSync.mockImplementation(() => {
			// eslint-disable-next-line @typescript-eslint/only-throw-error -- Testing non-Error exception handling
			throw 'String error';
		});

		const result = extractXPath(inputPath);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Error extracting XPath');
		expect(result.error).toContain('String error');
	});
});
