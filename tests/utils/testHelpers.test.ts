/**
 * @file
 * Unit tests for test helper functions.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Test helpers return properly typed values */
import { describe, it, expect } from 'vitest';
import type {
	CoverageResult,
	XPathCoverageResult,
} from '../../../src/types/index.js';
import {
	createExampleDataForCoverage,
	createMockXmlContent,
	createMockXPathAnalysis,
	expectCoverageResult,
	expectXPathCoverageResult,
	extractMissingItems,
	hasLineInfo,
	hasMissingItems,
} from './testHelpers.js';

describe('testHelpers', () => {
	describe('createMockXPathAnalysis', () => {
		it('should create mock XPath analysis with defaults', () => {
			const result = createMockXPathAnalysis();

			expect(result.attributes).toEqual([]);
			expect(result.conditionals).toEqual([]);
			expect(result.hasLetExpressions).toBe(false);
			expect(result.hasUnions).toBe(false);
			expect(result.nodeTypes).toEqual([]);
			expect(result.operators).toEqual([]);
			expect(result.patterns).toEqual([]);
		});

		it('should create mock XPath analysis with custom options', () => {
			const result = createMockXPathAnalysis({
				attributes: ['@Name'],
				conditionals: [],
				hasLetExpressions: true,
				hasUnions: true,
				nodeTypes: ['Method'],
				operators: ['='],
				patterns: ['pattern1'],
			});

			expect(result.attributes).toEqual(['@Name']);
			expect(result.conditionals).toEqual([]);
			expect(result.hasLetExpressions).toBe(true);
			expect(result.hasUnions).toBe(true);
			expect(result.nodeTypes).toEqual(['Method']);
			expect(result.operators).toEqual(['=']);
			expect(result.patterns).toEqual(['pattern1']);
		});
	});

	describe('createMockXmlContent', () => {
		it('should create mock XML with defaults', () => {
			const result = createMockXmlContent();

			expect(result).toContain('<rule name="TestRule">');
			expect(result).toContain('<value>//Method</value>');
		});

		it('should create mock XML with xpathOnSameLine', () => {
			const result = createMockXmlContent({ xpathOnSameLine: true });

			expect(result).toContain(
				'<property name="xpath" value="//Method"></property>',
			);
		});

		it('should create mock XML with hasCdata', () => {
			const result = createMockXmlContent({ hasCdata: true });

			expect(result).toContain('<![CDATA[');
			expect(result).toContain(']]>');
		});

		it('should create mock XML with custom rule name and xpath', () => {
			const result = createMockXmlContent({
				ruleName: 'CustomRule',
				xpath: '//Custom',
			});

			expect(result).toContain('<rule name="CustomRule">');
			expect(result).toContain('<value>//Custom</value>');
		});
	});

	describe('createExampleDataForCoverage', () => {
		it('should create example data with defaults', () => {
			const result = createExampleDataForCoverage();

			expect(result.content).toBe('public class Test {}');
			expect(result.exampleIndex).toBe(1);
			expect(result.validMarkers).toEqual([]);
			expect(result.valids).toEqual([]);
			expect(result.violationMarkers).toEqual([]);
			expect(result.violations).toEqual([]);
		});

		it('should create example data with custom options', () => {
			const result = createExampleDataForCoverage({
				content: 'custom content',
				exampleIndex: 2,
			});

			expect(result.content).toBe('custom content');
			expect(result.exampleIndex).toBe(2);
		});
	});

	describe('expectCoverageResult', () => {
		it('should check success expectation', () => {
			const result: CoverageResult = {
				details: [],
				evidence: [],
				message: 'Test',
				success: true,
			};

			expect(() => {
				expectCoverageResult(result, { success: true });
			}).not.toThrow();
			expect(() => {
				expectCoverageResult(result, { success: false });
			}).toThrow();
		});

		it('should check coverageCount expectation', () => {
			const result: CoverageResult = {
				details: [],
				evidence: [
					{
						count: 1,
						description: 'Test',
						required: 1,
						type: 'valid',
					},
				],
				message: 'Test',
				success: true,
			};

			expect(() => {
				expectCoverageResult(result, { coverageCount: 1 });
			}).not.toThrow();
			expect(() => {
				expectCoverageResult(result, { coverageCount: 2 });
			}).toThrow();
		});

		it('should check hasLineInfo expectation', () => {
			const resultWithLine: CoverageResult = {
				details: [],
				evidence: [
					{
						count: 1,
						description: 'Line 5: Test',
						required: 1,
						type: 'valid',
					},
				],
				message: 'Test',
				success: true,
			};

			const resultWithoutLine: CoverageResult = {
				details: [],
				evidence: [
					{
						count: 1,
						description: 'Test',
						required: 1,
						type: 'valid',
					},
				],
				message: 'Test',
				success: true,
			};

			expect(() => {
				expectCoverageResult(resultWithLine, { hasLineInfo: true });
			}).not.toThrow();
			expect(() => {
				expectCoverageResult(resultWithoutLine, { hasLineInfo: false });
			}).not.toThrow();
		});

		it('should check hasMissingItems expectation', () => {
			const resultWithMissing: CoverageResult = {
				details: [],
				evidence: [
					{
						count: 1,
						description: 'Missing: item1',
						required: 1,
						type: 'valid',
					},
				],
				message: 'Test',
				success: true,
			};

			const resultWithoutMissing: CoverageResult = {
				details: [],
				evidence: [
					{
						count: 1,
						description: 'Test',
						required: 1,
						type: 'valid',
					},
				],
				message: 'Test',
				success: true,
			};

			expect(() => {
				expectCoverageResult(resultWithMissing, {
					hasMissingItems: true,
				});
			}).not.toThrow();
			expect(() => {
				expectCoverageResult(resultWithoutMissing, {
					hasMissingItems: false,
				});
			}).not.toThrow();
		});

		it('should check missingItems expectation', () => {
			const result: CoverageResult = {
				details: [],
				evidence: [
					{
						count: 1,
						description: 'Missing: item1, item2',
						required: 1,
						type: 'valid',
					},
				],
				message: 'Test',
				success: true,
			};

			expect(() => {
				expectCoverageResult(result, {
					missingItems: ['item1', 'item2'],
				});
			}).not.toThrow();
			expect(() => {
				expectCoverageResult(result, { missingItems: ['item3'] });
			}).toThrow();
		});

		it('should check messageContains expectation', () => {
			const result: CoverageResult = {
				details: [],
				evidence: [],
				message: 'Test message with content',
				success: true,
			};

			expect(() => {
				expectCoverageResult(result, {
					messageContains: ['Test', 'content'],
				});
			}).not.toThrow();
			expect(() => {
				expectCoverageResult(result, { messageContains: ['missing'] });
			}).toThrow();
		});
	});

	describe('expectXPathCoverageResult', () => {
		it('should check overallSuccess expectation', () => {
			const result: XPathCoverageResult = {
				coverage: [],
				overallSuccess: true,
				uncoveredBranches: [],
			};

			expect(() => {
				expectXPathCoverageResult(result, { overallSuccess: true });
			}).not.toThrow();
			expect(() => {
				expectXPathCoverageResult(result, { overallSuccess: false });
			}).toThrow();
		});

		it('should check coverageCount expectation', () => {
			const result: XPathCoverageResult = {
				coverage: [
					{
						details: [],
						evidence: [],
						message: 'Test',
						success: true,
					},
				],
				overallSuccess: true,
				uncoveredBranches: [],
			};

			expect(() => {
				expectXPathCoverageResult(result, { coverageCount: 1 });
			}).not.toThrow();
			expect(() => {
				expectXPathCoverageResult(result, { coverageCount: 2 });
			}).toThrow();
		});

		it('should check uncoveredBranchesCount expectation', () => {
			const result: XPathCoverageResult = {
				coverage: [],
				overallSuccess: true,
				uncoveredBranches: ['branch1', 'branch2'],
			};

			expect(() => {
				expectXPathCoverageResult(result, {
					uncoveredBranchesCount: 2,
				});
			}).not.toThrow();
			expect(() => {
				expectXPathCoverageResult(result, {
					uncoveredBranchesCount: 1,
				});
			}).toThrow();
		});

		it('should check hasLineInfo expectation', () => {
			const resultWithLine: XPathCoverageResult = {
				coverage: [
					{
						details: [],
						evidence: [
							{
								count: 1,
								description: 'Line 5: Test',
								required: 1,
								type: 'valid',
							},
						],
						message: 'Test',
						success: true,
					},
				],
				overallSuccess: true,
				uncoveredBranches: [],
			};

			const resultWithoutLine: XPathCoverageResult = {
				coverage: [
					{
						details: [],
						evidence: [
							{
								count: 1,
								description: 'Test',
								required: 1,
								type: 'valid',
							},
						],
						message: 'Test',
						success: true,
					},
				],
				overallSuccess: true,
				uncoveredBranches: [],
			};

			expect(() => {
				expectXPathCoverageResult(resultWithLine, {
					hasLineInfo: true,
				});
			}).not.toThrow();
			expect(() => {
				expectXPathCoverageResult(resultWithoutLine, {
					hasLineInfo: false,
				});
			}).not.toThrow();
		});
	});

	describe('hasLineInfo', () => {
		it('should return true when description contains Line', () => {
			expect(hasLineInfo('Line 5: Test')).toBe(true);
			expect(hasLineInfo('Test Line 10')).toBe(true);
		});

		it('should return false when description does not contain Line', () => {
			expect(hasLineInfo('Test description')).toBe(false);
			expect(hasLineInfo('')).toBe(false);
		});
	});

	describe('hasMissingItems', () => {
		it('should return true when description contains Missing:', () => {
			expect(hasMissingItems('Missing: item1')).toBe(true);
			expect(hasMissingItems('Test Missing: item2')).toBe(true);
		});

		it('should return false when description does not contain Missing:', () => {
			expect(hasMissingItems('Test description')).toBe(false);
			expect(hasMissingItems('')).toBe(false);
		});
	});

	describe('extractMissingItems', () => {
		it('should extract missing items from description', () => {
			const result = extractMissingItems('Missing: item1, item2');

			expect(result).toContain('item1');
			expect(result).toContain('item2');
		});

		it('should return empty array when description does not contain Missing:', () => {
			const result = extractMissingItems('Test description');

			expect(result).toEqual([]);
		});

		it('should handle missing items with colons', () => {
			const result = extractMissingItems('Missing: item1: value1, item2');

			expect(result.length).toBeGreaterThan(0);
		});

		it('should return empty array when missing section is empty', () => {
			const result = extractMissingItems('Missing:');

			expect(result).toEqual([]);
		});
	});
});
