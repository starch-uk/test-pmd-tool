/**
 * @file
 * Unit tests for fixture helper functions.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Test fixtures return properly typed values */
import { describe, it, expect } from 'vitest';
import {
	createExampleData,
	createRuleMetadata,
	createValidMarker,
	createValidRuleMetadata,
	createViolationMarker,
} from './fixtures.js';

describe('fixtures', () => {
	describe('createExampleData', () => {
		it('should create example data with defaults', () => {
			const result = createExampleData();

			expect(result.content).toBe('public class Test {}');
			expect(result.exampleIndex).toBe(1);
			expect(result.validMarkers).toEqual([]);
			expect(result.valids).toEqual([]);
			expect(result.violationMarkers).toEqual([]);
			expect(result.violations).toEqual([]);
		});

		it('should create example data with custom content', () => {
			// Test branch where options.content is provided (line 34)
			const result = createExampleData({ content: 'custom content' });

			expect(result.content).toBe('custom content');
		});
	});

	describe('createViolationMarker', () => {
		it('should create violation marker with defaults', () => {
			const result = createViolationMarker();

			expect(result.description).toBe('Test violation');
			expect(result.index).toBe(0);
			expect(result.isViolation).toBe(true);
			expect(result.lineNumber).toBe(1);
		});

		it('should create violation marker with custom description', () => {
			// Test branch where options.description is provided (line 53)
			const result = createViolationMarker({
				description: 'Custom violation',
			});

			expect(result.description).toBe('Custom violation');
		});
	});

	describe('createValidMarker', () => {
		it('should create valid marker with defaults', () => {
			const result = createValidMarker();

			expect(result.description).toBe('Test valid');
			expect(result.index).toBe(0);
			expect(result.isViolation).toBe(false);
			expect(result.lineNumber).toBe(1);
		});

		it('should create valid marker with custom description', () => {
			// Test branch where options.description is provided (line 71)
			const result = createValidMarker({ description: 'Custom valid' });

			expect(result.description).toBe('Custom valid');
		});
	});

	describe('createRuleMetadata', () => {
		it('should create rule metadata with defaults', () => {
			const result = createRuleMetadata();

			expect(result.description).toContain('detailed description');
			expect(result.message).toBe('This is a comprehensive test message');
			expect(result.ruleName).toBe('TestRule');
			expect(result.xpath).toBe('//Method');
		});

		it('should create rule metadata with custom values', () => {
			const result = createRuleMetadata({
				description: 'Custom description',
				message: 'Custom message',
				ruleName: 'CustomRule',
				xpath: '//Custom',
			});

			expect(result.description).toBe('Custom description');
			expect(result.message).toBe('Custom message');
			expect(result.ruleName).toBe('CustomRule');
			expect(result.xpath).toBe('//Custom');
		});
	});

	describe('createValidRuleMetadata', () => {
		it('should create valid rule metadata', () => {
			const result = createValidRuleMetadata();

			expect(result.description).toContain('detailed description');
			expect(result.message).toBe('This is a comprehensive test message');
			expect(result.ruleName).toBe('TestRule');
			expect(result.xpath).toBe('//Method');
		});
	});
});
