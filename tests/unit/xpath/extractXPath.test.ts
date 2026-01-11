import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
import { readFileSync } from 'fs';
import { extractXPath } from '../../../src/xpath/extractXPath.js';

// Mock file system
vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

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
		const result = suppressConsoleOutput(() => extractXPath('/path/to/rule.xml'));

		expect(result.success).toBe(true);
		// May return null if XML parsing fails completely
		expect(result.data === null || result.data === '//test').toBe(true);
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
});
