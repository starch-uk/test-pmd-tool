/**
 * @file
 * Unit tests for CLI argument parsing and help functionality.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCliArgs, printUsage } from '../../../src/cli/args.js';

// process.exit is spied in beforeEach to avoid exiting tests

describe('parseCliArgs', () => {
	let exitSpy: ReturnType<typeof vi.spyOn<typeof process, 'exit'>> | null =
		null;
	beforeEach(() => {
		vi.clearAllMocks();
		const exitImpl = (code?: number): never => {
			throw new Error(`process.exit(${String(code)})`);
		};
		exitSpy = vi.spyOn(process, 'exit').mockImplementation(exitImpl);
		vi.spyOn(console, 'log').mockImplementation(() => {
			// Mock implementation
		});
		vi.spyOn(console, 'error').mockImplementation(() => {
			// Mock implementation
		});
	});

	afterEach(() => {
		exitSpy?.mockRestore();
		vi.restoreAllMocks();
	});

	it('should parse empty arguments', () => {
		const result = parseCliArgs([]);
		expect(result).toEqual({
			coverage: false,
			diag: null,
			help: false,
			path: null,
		});
	});

	it('should ignore undefined arguments', () => {
		const result = parseCliArgs([undefined]);
		expect(result).toEqual({
			coverage: false,
			diag: null,
			help: false,
			path: null,
		});
	});

	it('should parse --help flag', () => {
		const result = parseCliArgs(['--help']);
		expect(result.help).toBe(true);
		expect(result.path).toBe(null);
	});

	it('should parse -h flag', () => {
		const result = parseCliArgs(['-h']);
		expect(result.help).toBe(true);
	});

	it('should parse path argument', () => {
		const result = parseCliArgs(['path/to/file.xml']);
		expect(result.path).toBe('path/to/file.xml');
		expect(result.help).toBe(false);
	});

	it('should parse --coverage flag', () => {
		const result = parseCliArgs(['path/to/file.xml', '--coverage']);
		expect(result.coverage).toBe(true);
		expect(result.path).toBe('path/to/file.xml');
	});

	it('should parse -c flag', () => {
		const result = parseCliArgs(['path/to/file.xml', '-c']);
		expect(result.coverage).toBe(true);
	});

	it('should parse --diag with number', () => {
		const result = parseCliArgs(['path/to/file.xml', '--diag', '2']);
		expect(result.diag).toBe(2);
		expect(result.path).toBe('path/to/file.xml');
	});

	it('should parse -d with number', () => {
		const result = parseCliArgs(['path/to/file.xml', '-d', '1']);
		expect(result.diag).toBe(1);
	});

	it('should handle --diag without number', () => {
		expect(() => {
			parseCliArgs(['path/to/file.xml', '--diag']);
		}).toThrow(/process\.exit/);
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(console.error).toHaveBeenCalledWith(
			'❌ --diag/-d requires an example index number',
		);
	});

	it('should handle invalid diag index (NaN)', () => {
		expect(() => {
			parseCliArgs(['path/to/file.xml', '--diag', 'invalid']);
		}).toThrow(/process\.exit/);
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining('Invalid example index'),
		);
	});

	it('should handle invalid diag index (zero)', () => {
		expect(() => {
			parseCliArgs(['path/to/file.xml', '--diag', '0']);
		}).toThrow(/process\.exit/);
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining('Invalid example index'),
		);
	});

	it('should handle invalid diag index (negative)', () => {
		expect(() => {
			parseCliArgs(['path/to/file.xml', '--diag', '-1']);
		}).toThrow(/process\.exit/);
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining('Invalid example index'),
		);
	});

	it('should handle unknown option', () => {
		expect(() => {
			parseCliArgs(['path/to/file.xml', '--unknown']);
		}).toThrow(/process\.exit/);
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(console.error).toHaveBeenCalledWith(
			'❌ Unknown option: --unknown',
		);
	});

	it('should handle multiple path arguments', () => {
		expect(() => {
			parseCliArgs(['path1.xml', 'path2.xml']);
		}).toThrow(/process\.exit/);
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(console.error).toHaveBeenCalledWith(
			'❌ Unexpected argument: path2.xml',
		);
	});

	it('should parse combined flags', () => {
		const result = parseCliArgs(['path/to/file.xml', '-c']);
		expect(result.path).toBe('path/to/file.xml');
		expect(result.coverage).toBe(true);
		expect(result.diag).toBe(null);
	});
});

describe('printUsage', () => {
	let exitSpy: ReturnType<typeof vi.spyOn<typeof process, 'exit'>> | null =
		null;
	beforeEach(() => {
		vi.clearAllMocks();
		const exitImpl = (code?: number): never => {
			throw new Error(`process.exit(${String(code)})`);
		};
		exitSpy = vi.spyOn(process, 'exit').mockImplementation(exitImpl);
		vi.spyOn(console, 'log').mockImplementation(() => {
			// Mock implementation
		});
	});

	afterEach(() => {
		exitSpy?.mockRestore();
		vi.restoreAllMocks();
	});

	it('should print usage information', () => {
		expect(() => {
			printUsage(0);
		}).toThrow(/process\.exit/);
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it('should exit with error code when requested', () => {
		expect(() => {
			printUsage(1);
		}).toThrow(/process\.exit/);
		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});
