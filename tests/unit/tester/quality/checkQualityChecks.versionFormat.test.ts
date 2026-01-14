/**
 * @file
 * Version format validation tests for checkQualityChecks.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkQualityChecks } from '../../../../src/tester/quality/checkQualityChecks.js';
import type { RuleMetadata, ExampleData } from '../../../../src/types/index.js';

vi.mock('fs', () => ({
	readFileSync: vi.fn(),
}));

describe('checkQualityChecks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should fail when description does not end with Version line', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		This is a test description without version.
	</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'This is a test description without version.',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(true);
	});
	it('should fail when description ends with invalid version format', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		This is a test description.
		Version: 1.0
	</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'This is a test description.\nVersion: 1.0',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(true);
	});
	it('should pass when description ends with valid SemVer version', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description>
		This is a test description.
		Version: 1.2.3
	</description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: 'This is a test description.\nVersion: 1.2.3',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(false);
	});
	it('should fail when description is null', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: null,
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(true);
	});
	it('should fail when description is empty', () => {
		const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<rule name="TestRule" message="Test message">
	<description></description>
</rule>`;

		vi.mocked(readFileSync).mockReturnValue(xmlContent);

		const ruleMetadata: RuleMetadata = {
			description: '',
			message: 'Test message',
			ruleName: 'TestRule',
			xpath: '//Method',
		};

		const examples: ExampleData[] = [];

		const result = checkQualityChecks('test.xml', ruleMetadata, examples);

		expect(result.passed).toBe(false);
		expect(
			result.issues.some((issue) =>
				issue.includes("description must end with 'Version: X.Y.Z'"),
			),
		).toBe(true);
	});
});
