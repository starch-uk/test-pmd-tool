/**
 * @file
 * Test data fixtures and builders for unit tests.
 * Reduces duplication and improves test maintainability.
 */
/* eslint-disable import/group-exports -- Type definitions must be exported individually */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Test helpers accept mutable test data */
import type {
	ExampleData,
	RuleMetadata,
	ViolationMarker,
} from '../../../src/types/index.js';

/**
 * Options for creating ExampleData fixtures.
 */
export interface ExampleDataOptions {
	content?: string;
	exampleIndex?: number;
	validMarkers?: ViolationMarker[];
	valids?: string[];
	violationMarkers?: ViolationMarker[];
	violations?: string[];
}

/**
 * Creates an ExampleData fixture with sensible defaults.
 * @param options - Options to customize the example data.
 * @returns An ExampleData object with the specified options and defaults.
 */
export function createExampleData(
	options: ExampleDataOptions = {},
): ExampleData {
	return {
		content: options.content ?? 'public class Test {}',
		exampleIndex: options.exampleIndex ?? 1,
		validMarkers: options.validMarkers ?? [],
		valids: options.valids ?? [],
		violationMarkers: options.violationMarkers ?? [],
		violations: options.violations ?? [],
	};
}

/**
 * Creates a ViolationMarker fixture with sensible defaults.
 * @param options - Options to customize the violation marker.
 * @returns A ViolationMarker object with the specified options and defaults.
 */
export function createViolationMarker(
	options: Partial<ViolationMarker> = {},
): ViolationMarker {
	return {
		description: options.description ?? 'Test violation',
		index: options.index ?? 0,
		isViolation: true,
		lineNumber: options.lineNumber ?? 1,
		...options,
	};
}

/**
 * Creates a valid marker fixture with sensible defaults.
 * @param options - Options to customize the valid marker.
 * @returns A ViolationMarker object (with isViolation: false) with the specified options and defaults.
 */
export function createValidMarker(
	options: Partial<ViolationMarker> = {},
): ViolationMarker {
	return {
		description: options.description ?? 'Test valid',
		index: options.index ?? 0,
		isViolation: false,
		lineNumber: options.lineNumber ?? 1,
		...options,
	};
}

/**
 * Options for creating RuleMetadata fixtures.
 */
export interface RuleMetadataOptions {
	description?: string | null;
	message?: string | null;
	ruleName?: string | null;
	xpath?: string | null;
}

/**
 * Creates a RuleMetadata fixture with sensible defaults.
 * @param options - Options to customize the rule metadata.
 * @returns A RuleMetadata object with the specified options and defaults.
 */
export function createRuleMetadata(
	options: RuleMetadataOptions = {},
): RuleMetadata {
	return {
		description:
			'description' in options
				? options.description
				: 'This is a detailed description of the rule that meets the minimum length requirement',
		message:
			'message' in options
				? options.message
				: 'This is a comprehensive test message',
		ruleName: 'ruleName' in options ? options.ruleName : 'TestRule',
		xpath: 'xpath' in options ? options.xpath : '//Method',
	};
}

/**
 * Creates a minimal valid RuleMetadata for passing tests.
 * @returns A valid RuleMetadata object suitable for passing tests.
 */
export function createValidRuleMetadata(): RuleMetadata {
	return createRuleMetadata({
		description:
			'This is a detailed description of the rule that meets the minimum length requirement',
		message: 'This is a comprehensive test message',
		ruleName: 'TestRule',
		xpath: '//Method',
	});
}
