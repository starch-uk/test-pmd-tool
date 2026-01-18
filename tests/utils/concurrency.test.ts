/**
 * @file
 * Unit tests for limitConcurrency function.
 */
import { describe, it, expect } from 'vitest';
import { limitConcurrency } from '../../src/utils/concurrency.js';

describe('limitConcurrency', () => {
	it('should execute all tasks and return results in order', async () => {
		const tasks = [
			async (): Promise<number> => Promise.resolve(1),
			async (): Promise<number> => Promise.resolve(2),
			async (): Promise<number> => Promise.resolve(3),
		];

		const results = await limitConcurrency(tasks, 2);

		expect(results).toEqual([1, 2, 3]);
	});

	it('should limit concurrent execution to maxConcurrency', async () => {
		const executionOrder: number[] = [];
		const tasks = [
			async (): Promise<number> => {
				executionOrder.push(1);
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 1;
			},
			async (): Promise<number> => {
				executionOrder.push(2);
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 2;
			},
			async (): Promise<number> => {
				executionOrder.push(3);
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 3;
			},
		];

		await limitConcurrency(tasks, 2);

		// First two should start immediately
		expect(executionOrder.slice(0, 2)).toContain(1);
		expect(executionOrder.slice(0, 2)).toContain(2);
	});

	it('should handle empty task array', async () => {
		const results = await limitConcurrency([], 2);

		expect(results).toEqual([]);
	});

	it('should handle single task', async () => {
		const tasks = [async (): Promise<number> => Promise.resolve(42)];

		const results = await limitConcurrency(tasks, 1);

		expect(results).toEqual([42]);
	});

	it('should handle maxConcurrency greater than task count', async () => {
		const tasks = [
			async (): Promise<number> => Promise.resolve(1),
			async (): Promise<number> => Promise.resolve(2),
		];

		const results = await limitConcurrency(tasks, 10);

		expect(results).toEqual([1, 2]);
	});

	it('should propagate errors from tasks', async () => {
		const tasks = [
			async (): Promise<number> => Promise.resolve(1),
			// eslint-disable-next-line @typescript-eslint/explicit-function-return-type,@typescript-eslint/require-await -- Error-throwing function has implicit return type and doesn't need await
			async () => {
				throw new Error('Task failed');
			},
			async (): Promise<number> => Promise.resolve(3),
		];

		await expect(limitConcurrency(tasks, 2)).rejects.toThrow('Task failed');
	});

	it('should handle tasks that return different types', async () => {
		const tasks = [
			async (): Promise<string> => Promise.resolve('string'),
			async (): Promise<number> => Promise.resolve(42),
			async (): Promise<{ key: string }> =>
				Promise.resolve({ key: 'value' }),
		];

		const results = await limitConcurrency(tasks, 2);

		expect(results).toEqual(['string', 42, { key: 'value' }]);
	});

	it('should maintain order even with different execution times', async () => {
		const tasks = [
			async (): Promise<number> => {
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 30));
				return 1;
			},
			async (): Promise<number> => {
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 2;
			},
			async (): Promise<number> => {
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 20));
				return 3;
			},
		];

		const results = await limitConcurrency(tasks, 2);

		// Results should be in original order, not execution order
		expect(results).toEqual([1, 2, 3]);
	});

	it('should handle maxConcurrency of 1 (sequential execution)', async () => {
		const executionOrder: number[] = [];
		const tasks = [
			async (): Promise<number> => {
				executionOrder.push(1);
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 1;
			},
			async (): Promise<number> => {
				executionOrder.push(2);
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 2;
			},
			async (): Promise<number> => {
				executionOrder.push(3);
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 3;
			},
		];

		const results = await limitConcurrency(tasks, 1);

		expect(results).toEqual([1, 2, 3]);
		// With concurrency of 1, tasks should execute in order
		expect(executionOrder).toEqual([1, 2, 3]);
	});

	it('should handle task array with undefined entries gracefully', async () => {
		// Create a sparse array to test the null check
		const tasks: (() => Promise<number>)[] = [];
		tasks[0] = async (): Promise<number> => Promise.resolve(1);
		tasks[2] = async (): Promise<number> => Promise.resolve(3);
		// Index 1 is undefined

		const results = await limitConcurrency(tasks, 2);

		// Should handle undefined entries without crashing
		expect(results[0]).toBe(1);
		expect(results[2]).toBe(3);
	});

	it('should handle early return when index exceeds task length', async () => {
		// eslint-disable jsdoc/convert-to-jsdoc-comments -- Regular comments are appropriate for test explanations
		// This test ensures the early return path in executeNext is covered (line 24)
		// by having more tasks than maxConcurrency, so executeNext is called multiple times.
		// Eventually index >= tasks.length.
		// eslint-enable jsdoc/convert-to-jsdoc-comments
		const tasks = [
			async (): Promise<number> => {
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 1;
			},
			async (): Promise<number> => {
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 2;
			},
			async (): Promise<number> => {
				// eslint-disable-next-line @typescript-eslint/strict-void-return -- setTimeout callback requires void return
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 3;
			},
		];

		// With maxConcurrency = 1, tasks execute sequentially
		// The loop will call executeNext multiple times, and eventually index will exceed length
		const results = await limitConcurrency(tasks, 1);

		expect(results).toEqual([1, 2, 3]);
	});
});
