/**
 * @file
 * Unit tests for analyzeXPath function.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeXPath } from '../../../src/xpath/analyzeXPath.js';

// Mock the extractor functions
vi.mock('../../../src/xpath/extractors/extractNodeTypes.js', () => ({
	extractNodeTypes: vi.fn(),
}));

vi.mock('../../../src/xpath/extractors/extractOperators.js', () => ({
	extractOperators: vi.fn(),
}));

vi.mock('../../../src/xpath/extractors/extractAttributes.js', () => ({
	extractAttributes: vi.fn(),
}));

vi.mock('../../../src/xpath/extractors/extractConditionals.js', () => ({
	extractConditionals: vi.fn(),
}));

import { extractNodeTypes } from '../../../src/xpath/extractors/extractNodeTypes.js';
import { extractOperators } from '../../../src/xpath/extractors/extractOperators.js';
import { extractAttributes } from '../../../src/xpath/extractors/extractAttributes.js';
import { extractConditionals } from '../../../src/xpath/extractors/extractConditionals.js';

const mockedExtractNodeTypes = vi.mocked(extractNodeTypes);
const mockedExtractOperators = vi.mocked(extractOperators);
const mockedExtractAttributes = vi.mocked(extractAttributes);
const mockedExtractConditionals = vi.mocked(extractConditionals);

describe('analyzeXPath', () => {
	beforeEach(() => {
		// Mocks are cleared automatically by clearMocks: true in vitest.config.ts
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return empty analysis when xpath is null', () => {
		const result = analyzeXPath(null);

		expect(result).toEqual({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});
	});

	it('should analyze xpath and return all extracted components', () => {
		const xpath =
			"//Method[@Op='+' and @Name='test'] | //Field[not(@Static)]";

		mockedExtractNodeTypes.mockReturnValue(['Method', 'Field']);
		mockedExtractOperators.mockReturnValue(['+']);
		mockedExtractAttributes.mockReturnValue(['Name', 'Static']);
		mockedExtractConditionals.mockReturnValue([
			{ expression: '@Static', type: 'not' },
		]);

		const result = analyzeXPath(xpath);

		expect(mockedExtractNodeTypes).toHaveBeenCalledWith(xpath);
		expect(mockedExtractOperators).toHaveBeenCalledWith(xpath);
		expect(mockedExtractAttributes).toHaveBeenCalledWith(xpath);
		expect(mockedExtractConditionals).toHaveBeenCalledWith(xpath);

		expect(result).toEqual({
			attributes: ['Name', 'Static'],
			conditionals: [{ expression: '@Static', type: 'not' }],
			hasLetExpressions: false,
			hasUnions: true,
			nodeTypes: ['Method', 'Field'],
			operators: ['+'],
			patterns: [],
		});
	});

	it('should detect union operators (|)', () => {
		const xpath = '//Method | //Field | //Class';

		mockedExtractNodeTypes.mockReturnValue(['Method', 'Field', 'Class']);
		mockedExtractOperators.mockReturnValue([]);
		mockedExtractAttributes.mockReturnValue([]);
		mockedExtractConditionals.mockReturnValue([]);

		const result = analyzeXPath(xpath);

		expect(result.hasUnions).toBe(true);
	});

	it('should detect let expressions', () => {
		const xpath = 'let $methods := //Method return $methods';

		mockedExtractNodeTypes.mockReturnValue(['Method']);
		mockedExtractOperators.mockReturnValue([]);
		mockedExtractAttributes.mockReturnValue([]);
		mockedExtractConditionals.mockReturnValue([]);

		const result = analyzeXPath(xpath);

		expect(result.hasLetExpressions).toBe(true);
	});

	it('should handle xpath without special features', () => {
		const xpath = "//Method[@Name='test']";

		mockedExtractNodeTypes.mockReturnValue(['Method']);
		mockedExtractOperators.mockReturnValue([]);
		mockedExtractAttributes.mockReturnValue(['Name']);
		mockedExtractConditionals.mockReturnValue([]);

		const result = analyzeXPath(xpath);

		expect(result).toEqual({
			attributes: ['Name'],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: ['Method'],
			operators: [],
			patterns: [],
		});
	});

	it('should handle complex xpath with all features', () => {
		const xpath = `let $methods := //Method[@Op='+']
return $methods[not(@Static)] | //Field`;

		mockedExtractNodeTypes.mockReturnValue(['Method', 'Field']);
		mockedExtractOperators.mockReturnValue(['+']);
		mockedExtractAttributes.mockReturnValue(['Static']);
		mockedExtractConditionals.mockReturnValue([
			{ expression: '@Static', type: 'not' },
		]);

		const result = analyzeXPath(xpath);

		expect(result.hasUnions).toBe(true);
		expect(result.hasLetExpressions).toBe(true);
	});

	it('should handle empty xpath string', () => {
		const result = analyzeXPath('');

		expect(result).toEqual({
			attributes: [],
			conditionals: [],
			hasLetExpressions: false,
			hasUnions: false,
			nodeTypes: [],
			operators: [],
			patterns: [],
		});
	});
});
