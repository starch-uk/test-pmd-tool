/**
 * @file
 * Test data fixtures and builders for unit tests.
 * Reduces duplication and improves test maintainability.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Fixture functions return properly typed values */
import type {
	ExampleData,
	RuleMetadata,
	ViolationMarker,
} from '../../../src/types/index.js';

/**
 * Options for creating ExampleData fixtures.
 */
interface ExampleDataOptions {
	readonly content?: string;
	readonly exampleIndex?: number;
	readonly validMarkers?: readonly ViolationMarker[];
	readonly valids?: readonly string[];
	readonly violationMarkers?: readonly ViolationMarker[];
	readonly violations?: readonly string[];
}

/**
 * Creates an ExampleData fixture with sensible defaults.
 * @param options - Options to customize the example data.
 * @returns An ExampleData object with the specified options and defaults.
 */
function createExampleData(
	options: Readonly<ExampleDataOptions> = {},
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
function createViolationMarker(
	options: Readonly<Partial<ViolationMarker>> = {},
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
function createValidMarker(
	options: Readonly<Partial<ViolationMarker>> = {},
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
interface RuleMetadataOptions {
	readonly description?: string | null;
	readonly message?: string | null;
	readonly ruleName?: string | null;
	readonly xpath?: string | null;
}

/**
 * Creates a RuleMetadata fixture with sensible defaults.
 * @param options - Options to customize the rule metadata.
 * @returns A RuleMetadata object with the specified options and defaults.
 */
function createRuleMetadata(
	options: Readonly<RuleMetadataOptions> = {},
): Readonly<RuleMetadata> {
	const hasDescription = 'description' in options;
	const hasMessage = 'message' in options;
	const hasRuleName = 'ruleName' in options;
	const hasXpath = 'xpath' in options;

	const description: string | null | undefined = hasDescription
		? (options.description ?? null)
		: 'This is a detailed description of the rule that meets the minimum length requirement';
	const message: string | null | undefined = hasMessage
		? (options.message ?? null)
		: 'This is a comprehensive test message';
	const ruleName: string | null | undefined = hasRuleName
		? (options.ruleName ?? null)
		: 'TestRule';
	const xpath: string | null | undefined = hasXpath
		? (options.xpath ?? null)
		: '//Method';

	const result: RuleMetadata = {
		description,
		message,
		ruleName,
		xpath,
	};
	// Return as Readonly to match function parameter expectations
	return result;
}

/**
 * Creates a minimal valid RuleMetadata for passing tests.
 * @returns A valid RuleMetadata object suitable for passing tests.
 */
function createValidRuleMetadata(): Readonly<RuleMetadata> {
	const result = createRuleMetadata({
		description:
			'This is a detailed description of the rule that meets the minimum length requirement',
		message: 'This is a comprehensive test message',
		ruleName: 'TestRule',
		xpath: '//Method',
	});
	return result;
}

export {
	createExampleData,
	createRuleMetadata,
	createValidMarker,
	createValidRuleMetadata,
	createViolationMarker,
};

export type { ExampleDataOptions, RuleMetadataOptions };
