/**
 * @file
 * Concurrency utility for limiting parallel execution.
 */

/**
 * Limit the number of concurrent executions of async tasks.
 * @template T - The type of value returned by each task.
 * @param tasks - Array of functions that return promises.
 * @param maxConcurrency - Maximum number of tasks to run concurrently.
 * @returns Promise that resolves to array of results in the same order as input tasks.
 */
export async function limitConcurrency<T>(
	tasks: readonly (() => Promise<T>)[],
	maxConcurrency: number,
): Promise<T[]> {
	// Initialize results array with correct length
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Array created with correct length, values assigned before use
	const results = new Array(tasks.length) as T[];
	const executing: Promise<void>[] = [];
	let index = 0;

	const executeNext = async (): Promise<void> => {
		const currentIndex = index++;

		/**
		 * Safe due to scheduling logic: executeNext is called exactly tasks.length times,
		 * so currentIndex is always a valid index into tasks/results.
		 */
		const task = tasks[currentIndex];
		if (!task) {
			return;
		}

		try {
			results[currentIndex] = await task();
		} catch (error) {
			throw error;
		}
	};

	// Start initial batch of tasks
	for (let i = 0; i < Math.min(maxConcurrency, tasks.length); i++) {
		executing.push(executeNext());
	}

	// Wait for each task to complete and start next ones
	for (let i = 0; i < tasks.length; i++) {
		if (i >= maxConcurrency) {
			await executing[i % maxConcurrency];
			executing[i % maxConcurrency] = executeNext();
		}
	}

	// Wait for all remaining tasks
	await Promise.all(executing);

	return results;
}
