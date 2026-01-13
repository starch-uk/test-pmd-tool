/**
 * @file
 * Unit tests for runPMD function.
 */
import { execFileSync } from 'child_process';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPMD } from '../../../src/pmd/runPMD.js';

// Mock execFileSync
vi.mock('child_process', () => ({
	execFileSync: vi.fn(),
}));

// Mock resolve function
vi.mock('path', () => ({
	resolve: vi.fn((path: string) => path),
}));

const mockedExecFileSync = vi.mocked(execFileSync);

/**
 * Interface for execFileSync error objects in tests.
 */
interface ExecFileSyncTestError extends Error {
	code?: number | string;
	stdout?: Buffer | string;
	stderr?: Buffer | string;
}

describe('runPMD', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should execute PMD successfully and return parsed violations', async () => {
		const mockXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/test/file.cls">
    <violation beginline="5" rule="TestRule">Test violation</violation>
  </file>
</pmd>`;

		mockedExecFileSync.mockReturnValue(mockXmlOutput);

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			data: {
				violations: [
					{
						column: 0,
						line: 5,
						message: 'Test violation',
						priority: 5,
						rule: 'TestRule',
					},
				],
			},
			success: true,
		});

		expect(mockedExecFileSync).toHaveBeenCalledWith(
			'pmd',
			[
				'check',
				'--no-cache',
				'--no-progress',
				'-d',
				'/test/apex.cls',
				'-R',
				'/test/rules.xml',
				'-f',
				'xml',
			],
			expect.objectContaining({
				cwd: process.cwd(),
				encoding: 'utf-8',
				stdio: ['pipe', 'pipe', 'pipe'],
				timeout: 30000,
			}),
		);
	});

	it('should handle PMD execution errors with both stderr and stdout', async () => {
		const errorWithStderr = new Error(
			'Command failed',
		) as ExecFileSyncTestError;
		errorWithStderr.stdout = 'This is not XML at all, just plain text';
		errorWithStderr.stderr = 'Some stderr content';

		mockedExecFileSync.mockImplementation(() => {
			throw errorWithStderr;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		// Since stdout contains non-XML content, it should return success with empty violations
		expect(result).toEqual({
			data: {
				violations: [],
			},
			success: true,
		});
	});

	it('should handle PMD execution errors without stderr', async () => {
		const errorWithoutStderr = new Error(
			'Command failed',
		) as ExecFileSyncTestError;
		errorWithoutStderr.stdout = ''; // Empty stdout
		// stderr is undefined

		mockedExecFileSync.mockImplementation(() => {
			throw errorWithoutStderr;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		// Since stdout is empty, it goes to error handling
		expect(result).toEqual({
			error: 'PMD execution failed: Command failed',
			success: false,
		});
	});

	it('should handle PMD execution errors with neither stderr nor stdout', async () => {
		const errorMinimal = new Error('Command failed');
		// Both stderr and stdout are undefined

		mockedExecFileSync.mockImplementation(() => {
			throw errorMinimal;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			error: 'PMD execution failed: Command failed',
			success: false,
		});
	});

	it('should include stderr and stdout in error message when parsing fails', async () => {
		const errorWithDetails = new Error(
			'Command failed',
		) as ExecFileSyncTestError;
		errorWithDetails.stdout = ''; // Empty stdout so parsing fails
		errorWithDetails.stderr = 'Detailed error information';

		mockedExecFileSync.mockImplementation(() => {
			throw errorWithDetails;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('PMD execution failed: Command failed');
		expect(result.error).toContain(
			'PMD stderr:\nDetailed error information',
		);
	});

	it('should include stderr and stdout in error message when stdout is whitespace only', async () => {
		const errorWithWhitespaceStdout = new Error(
			'Command failed',
		) as ExecFileSyncTestError;
		errorWithWhitespaceStdout.stdout = '   \n\t   '; // Whitespace-only stdout
		errorWithWhitespaceStdout.stderr = 'Detailed error information';

		mockedExecFileSync.mockImplementation(() => {
			throw errorWithWhitespaceStdout;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('PMD execution failed: Command failed');
		expect(result.error).toContain(
			'PMD stderr:\nDetailed error information',
		);
		expect(result.error).toContain('PMD stdout:\n   \n\t   ');
	});

	it('should handle PMD execution errors with both stderr and stdout undefined', async () => {
		const errorMinimal = new Error('Command failed');
		// Both stderr and stdout are undefined

		mockedExecFileSync.mockImplementation(() => {
			throw errorMinimal;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			error: 'PMD execution failed: Command failed',
			success: false,
		});
	});

	it('should handle PMD execution errors with violations in stderr', async () => {
		const mockXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/test/file.cls">
    <violation beginline="1" rule="ErrorRule">Error violation</violation>
  </file>
</pmd>`;

		const mockError = new Error('Command failed') as ExecFileSyncTestError;
		mockError.code = 1;
		mockError.stdout = mockXmlOutput;
		mockedExecFileSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			data: {
				violations: [
					{
						column: 0,
						line: 1,
						message: 'Error violation',
						priority: 5,
						rule: 'ErrorRule',
					},
				],
			},
			success: true,
		});
	});

	it('should handle PMD not found error', async () => {
		const mockError = new Error('Command failed') as ExecFileSyncTestError;
		mockError.code = 'ENOENT';
		mockedExecFileSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			error: 'PMD CLI not available. Please install PMD to run tests. Visit: https://pmd.github.io/pmd/pmd_userdocs_installation.html',
			success: false,
		});
	});

	it('should handle execution errors that produce valid empty XML', async () => {
		const mockError = new Error(
			'Command failed with stderr',
		) as ExecFileSyncTestError;
		mockError.code = 1;
		mockError.stderr = 'PMD stderr output';
		mockError.stdout = '<?xml version="1.0"?><pmd></pmd>'; // Valid but empty XML
		mockedExecFileSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		// When PMD exits with error but produces valid XML, we return success with parsed violations
		expect(result).toEqual({
			data: {
				violations: [],
			},
			success: true,
		});
	});

	it('should handle PMD errors with parseable output', async () => {
		const mockError = new Error('Command failed') as ExecFileSyncTestError;
		mockError.code = 1;
		mockError.stdout = 'not xml at all just plain text';
		mockedExecFileSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		// parseViolations can parse non-XML as empty violations, so we return success
		expect(result).toEqual({
			data: {
				violations: [],
			},
			success: true,
		});
	});

	it('should use correct command line arguments', async () => {
		mockedExecFileSync.mockReturnValue(`<?xml version="1.0"?><pmd></pmd>`);

		await runPMD('apex/file.cls', 'rules/file.xml');

		expect(mockedExecFileSync).toHaveBeenCalledWith(
			'pmd',
			[
				'check',
				'--no-cache',
				'--no-progress',
				'-d',
				'apex/file.cls',
				'-R',
				'rules/file.xml',
				'-f',
				'xml',
			],
			expect.any(Object),
		);
	});

	it('should respect timeout configuration', async () => {
		mockedExecFileSync.mockReturnValue(`<?xml version="1.0"?><pmd></pmd>`);

		await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(mockedExecFileSync).toHaveBeenCalledWith(
			'pmd',
			expect.any(Array),
			expect.objectContaining({
				timeout: 30000,
			}),
		);
	});

	it('should handle Buffer stdout conversion', async () => {
		const mockError = new Error('Command failed') as ExecFileSyncTestError;
		mockError.stdout = Buffer.from('<?xml version="1.0"?><pmd></pmd>');
		mockedExecFileSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result.success).toBe(true);
		expect(result.data?.violations).toEqual([]);
	});

	it('should handle Buffer stderr conversion', async () => {
		const mockError = new Error('Command failed') as ExecFileSyncTestError;
		mockError.stdout = '';
		mockError.stderr = Buffer.from('Error details');
		mockedExecFileSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('PMD execution failed: Command failed');
		expect(result.error).toContain('PMD stderr:\nError details');
	});

	it('should handle Buffer stdout in error message', async () => {
		const mockError = new Error('Command failed') as ExecFileSyncTestError;
		mockError.stdout = Buffer.from('   \n\t   ');
		mockError.stderr = Buffer.from('Error details');
		mockedExecFileSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('PMD stdout:\n   \n\t   ');
	});

	it('should handle error without message property', async () => {
		const mockError: ExecFileSyncTestError = {
			stdout: '',
		};
		mockedExecFileSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('PMD execution failed: Unknown error');
	});

	it('should handle stderr with only whitespace', async () => {
		const mockError = new Error('Command failed') as ExecFileSyncTestError;
		mockError.stdout = '';
		mockError.stderr = '   \n\t   '; // Whitespace-only stderr
		mockedExecFileSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('PMD execution failed: Command failed');
		// Should not include stderr when it's only whitespace
		expect(result.error).not.toContain('PMD stderr:');
	});
});
