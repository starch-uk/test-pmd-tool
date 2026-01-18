/**
 * @file
 * Error handling utilities for CLI.
 */

const EXIT_CODE_ERROR = 1;

/**
 * Setup error handlers for uncaught exceptions and unhandled rejections.
 */
export function setupErrorHandlers(): void {
	// Handle uncaught errors
	process.on('uncaughtException', (error: Readonly<Error>) => {
		console.error(`Unexpected error: ${error.message}`);
		process.exit(EXIT_CODE_ERROR);
	});

	process.on(
		'unhandledRejection',
		(_reason: Readonly<unknown>, _promise: Readonly<Promise<unknown>>) => {
			const reasonString =
				typeof _reason === 'string'
					? _reason
					: _reason instanceof Error
						? _reason.message
						: JSON.stringify(_reason);
			const promiseString = '[Promise]';
			console.error(
				`Unhandled Rejection at: ${promiseString}, reason: ${reasonString}`,
			);
			process.exit(EXIT_CODE_ERROR);
		},
	);
}
