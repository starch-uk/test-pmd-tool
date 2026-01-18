/**
 * @file
 * Unit tests for assertion helper functions.
 */
import { describe, it, expect } from 'vitest';
import type { ValidationResult } from '../../../src/types/index.js';
import {
	expectFailed,
	expectIssue,
	expectIssueCount,
	expectNoIssues,
	expectNoWarnings,
	expectPassed,
	expectPassedWithNoIssues,
	expectPassedWithNoIssuesOnly,
	expectWarning,
	expectWarningContaining,
	expectWarningCount,
} from './assertions.js';

describe('assertions', () => {
	describe('expectPassed', () => {
		it('should pass when result.passed is true', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: [],
			};

			expect(() => {
				expectPassed(result);
			}).not.toThrow();
		});

		it('should fail when result.passed is false', () => {
			const result: ValidationResult = {
				issues: ['Issue 1'],
				passed: false,
				warnings: [],
			};

			expect(() => {
				expectPassed(result);
			}).toThrow();
		});
	});

	describe('expectNoIssues', () => {
		it('should pass when result.issues is empty', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: [],
			};

			expect(() => {
				expectNoIssues(result);
			}).not.toThrow();
		});

		it('should fail when result.issues has items', () => {
			const result: ValidationResult = {
				issues: ['Issue 1'],
				passed: true,
				warnings: [],
			};

			expect(() => {
				expectNoIssues(result);
			}).toThrow();
		});
	});

	describe('expectPassedWithNoIssues', () => {
		it('should pass when result.passed is true and no issues or warnings', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: [],
			};

			expect(() => {
				expectPassedWithNoIssues(result);
			}).not.toThrow();
		});

		it('should fail when result.passed is false', () => {
			const result: ValidationResult = {
				issues: [],
				passed: false,
				warnings: [],
			};

			expect(() => {
				expectPassedWithNoIssues(result);
			}).toThrow();
		});

		it('should fail when result has issues', () => {
			const result: ValidationResult = {
				issues: ['Issue 1'],
				passed: true,
				warnings: [],
			};

			expect(() => {
				expectPassedWithNoIssues(result);
			}).toThrow();
		});

		it('should fail when result has warnings', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: ['Warning 1'],
			};

			expect(() => {
				expectPassedWithNoIssues(result);
			}).toThrow();
		});
	});

	describe('expectPassedWithNoIssuesOnly', () => {
		it('should pass when result.passed is true and no issues', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: ['Warning 1'],
			};

			expect(() => {
				expectPassedWithNoIssuesOnly(result);
			}).not.toThrow();
		});

		it('should fail when result.passed is false', () => {
			const result: ValidationResult = {
				issues: [],
				passed: false,
				warnings: [],
			};

			expect(() => {
				expectPassedWithNoIssuesOnly(result);
			}).toThrow();
		});

		it('should fail when result has issues', () => {
			const result: ValidationResult = {
				issues: ['Issue 1'],
				passed: true,
				warnings: [],
			};

			expect(() => {
				expectPassedWithNoIssuesOnly(result);
			}).toThrow();
		});
	});

	describe('expectFailed', () => {
		it('should pass when result.passed is false', () => {
			const result: ValidationResult = {
				issues: ['Issue 1'],
				passed: false,
				warnings: [],
			};

			expect(() => {
				expectFailed(result);
			}).not.toThrow();
		});

		it('should fail when result.passed is true', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: [],
			};

			expect(() => {
				expectFailed(result);
			}).toThrow();
		});
	});

	describe('expectNoWarnings', () => {
		it('should pass when result.warnings is empty', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: [],
			};

			expect(() => {
				expectNoWarnings(result);
			}).not.toThrow();
		});

		it('should fail when result.warnings has items', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: ['Warning 1'],
			};

			expect(() => {
				expectNoWarnings(result);
			}).toThrow();
		});
	});

	describe('expectIssueCount', () => {
		it('should pass when result.issues has expected count', () => {
			const result: ValidationResult = {
				issues: ['Issue 1', 'Issue 2'],
				passed: false,
				warnings: [],
			};

			expect(() => {
				expectIssueCount(result, 2);
			}).not.toThrow();
		});

		it('should fail when result.issues has different count', () => {
			const result: ValidationResult = {
				issues: ['Issue 1'],
				passed: false,
				warnings: [],
			};

			expect(() => {
				expectIssueCount(result, 2);
			}).toThrow();
		});
	});

	describe('expectWarningCount', () => {
		it('should pass when result.warnings has expected count', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: ['Warning 1', 'Warning 2'],
			};

			expect(() => {
				expectWarningCount(result, 2);
			}).not.toThrow();
		});

		it('should fail when result.warnings has different count', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: ['Warning 1'],
			};

			expect(() => {
				expectWarningCount(result, 2);
			}).toThrow();
		});
	});

	describe('expectIssue', () => {
		it('should pass when result.issues contains expected issue', () => {
			const result: ValidationResult = {
				issues: ['Issue 1', 'Issue 2'],
				passed: false,
				warnings: [],
			};

			expect(() => {
				expectIssue(result, 'Issue 1');
			}).not.toThrow();
		});

		it('should fail when result.issues does not contain expected issue', () => {
			const result: ValidationResult = {
				issues: ['Issue 1'],
				passed: false,
				warnings: [],
			};

			expect(() => {
				expectIssue(result, 'Issue 2');
			}).toThrow();
		});
	});

	describe('expectWarning', () => {
		it('should pass when result.warnings contains expected warning', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: ['Warning 1', 'Warning 2'],
			};

			expect(() => {
				expectWarning(result, 'Warning 1');
			}).not.toThrow();
		});

		it('should fail when result.warnings does not contain expected warning', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: ['Warning 1'],
			};

			expect(() => {
				expectWarning(result, 'Warning 2');
			}).toThrow();
		});
	});

	describe('expectWarningContaining', () => {
		it('should pass when result.warnings contains text', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: ['This is a warning message'],
			};

			expect(() => {
				expectWarningContaining(result, 'warning');
			}).not.toThrow();
		});

		it('should fail when result.warnings does not contain text', () => {
			const result: ValidationResult = {
				issues: [],
				passed: true,
				warnings: ['This is a warning message'],
			};

			expect(() => {
				expectWarningContaining(result, 'error');
			}).toThrow();
		});
	});
});
