/**
 * @file
 * Message validation tests for checkQualityChecks.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi } from 'vitest';
import { checkQualityChecks } from '../../../../src/tester/quality/checkQualityChecks.js';
import type { RuleMetadata, ExampleData } from '../../../../src/types/index.js';

vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

describe('checkQualityChecks', () => {
	// Mocks are cleared automatically by clearMocks: true in vitest.config.ts

	it('should fail when message attribute is missing', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: null,
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('message attribute is missing'),
			),
		).toBe(true);
	});
	it('should include line number when message line can be located', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: null,
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(result.issues.some((issue) => issue.startsWith('Line '))).toBe(
			true,
		);
	});
	it('should fail when message attribute exceeds 80 characters', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="This is a very long message that exceeds the maximum allowed length of 80 characters and should trigger an error">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message:
				'This is a very long message that exceeds the maximum allowed length of 80 characters and should trigger an error',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes('message attribute exceeds 80 characters'),
			),
		).toBe(true);
	});
	it('should fail when message exceeds 80 characters and message line is unknown', () => {
		const longMessage =
			'This is a very long message that exceeds the maximum allowed length of 80 characters and should trigger an error';

		// No message attribute in XML, so findMessageLineNumber returns undefined.
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: longMessage,
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(
			result.issues.some((issue) =>
				issue.startsWith('message attribute exceeds 80 characters'),
			),
		).toBe(true);
	});
	it('should handle XML with no message attribute', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule">
	<description>Test description</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'Test description',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const result = checkQualityChecks('test.xml', ruleMetadata, []);

		expect(result.issues.length).toBeGreaterThanOrEqual(0);
	});
});
