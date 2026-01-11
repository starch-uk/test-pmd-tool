import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { runPMD } from '../../../src/pmd/runPMD.js';

// Mock execSync
vi.mock('child_process', () => ({
	execSync: vi.fn(),
}));

// Mock resolve function
vi.mock('path', () => ({
	resolve: vi.fn((path) => path),
}));

const mockedExecSync = vi.mocked(execSync);

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

		mockedExecSync.mockReturnValue(mockXmlOutput);

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			success: true,
			data: {
				violations: [
					{
						line: 5,
						column: 0,
						message: 'Test violation',
						rule: 'TestRule',
						priority: 5,
					},
				],
			},
		});

		expect(mockedExecSync).toHaveBeenCalledWith(
			'pmd check --no-cache --no-progress -d "/test/apex.cls" -R "/test/rules.xml" -f xml',
			expect.objectContaining({
				encoding: 'utf-8',
				timeout: 30000,
				stdio: ['pipe', 'pipe', 'pipe'],
				cwd: process.cwd(),
			}),
		);
	});

	it('should handle PMD execution errors with both stderr and stdout', async () => {
		const errorWithStderr = new Error('Command failed');
		(errorWithStderr as any).stdout = 'This is not XML at all, just plain text';
		(errorWithStderr as any).stderr = 'Some stderr content';

		mockedExecSync.mockImplementation(() => {
			throw errorWithStderr;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		// Since stdout contains non-XML content, it should return success with empty violations
		expect(result).toEqual({
			success: true,
			data: {
				violations: [],
			},
		});
	});

	it('should handle PMD execution errors without stderr', async () => {
		const errorWithoutStderr = new Error('Command failed');
		(errorWithoutStderr as any).stdout = ''; // Empty stdout
		// stderr is undefined

		mockedExecSync.mockImplementation(() => {
			throw errorWithoutStderr;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		// Since stdout is empty, it goes to error handling
		expect(result).toEqual({
			success: false,
			error: 'PMD execution failed: Command failed',
		});
	});

	it('should handle PMD execution errors with neither stderr nor stdout', async () => {
		const errorMinimal = new Error('Command failed');
		// Both stderr and stdout are undefined

		mockedExecSync.mockImplementation(() => {
			throw errorMinimal;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			success: false,
			error: 'PMD execution failed: Command failed',
		});
	});

	it('should include stderr and stdout in error message when parsing fails', async () => {
		const errorWithDetails = new Error('Command failed');
		(errorWithDetails as any).stdout = ''; // Empty stdout so parsing fails
		(errorWithDetails as any).stderr = 'Detailed error information';

		mockedExecSync.mockImplementation(() => {
			throw errorWithDetails;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('PMD execution failed: Command failed');
		expect(result.error).toContain('PMD stderr:\nDetailed error information');
	});

	it('should include stderr and stdout in error message when stdout is whitespace only', async () => {
		const errorWithWhitespaceStdout = new Error('Command failed');
		(errorWithWhitespaceStdout as any).stdout = '   \n\t   '; // Whitespace-only stdout
		(errorWithWhitespaceStdout as any).stderr = 'Detailed error information';

		mockedExecSync.mockImplementation(() => {
			throw errorWithWhitespaceStdout;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result.success).toBe(false);
		expect(result.error).toContain('PMD execution failed: Command failed');
		expect(result.error).toContain('PMD stderr:\nDetailed error information');
		expect(result.error).toContain('PMD stdout:\n   \n\t   ');
	});

	it('should handle PMD execution errors with both stderr and stdout undefined', async () => {
		const errorMinimal = new Error('Command failed');
		// Both stderr and stdout are undefined

		mockedExecSync.mockImplementation(() => {
			throw errorMinimal;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			success: false,
			error: 'PMD execution failed: Command failed',
		});
	});

	it('should handle PMD execution errors with violations in stderr', async () => {
		const mockXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<pmd version="6.0.0" timestamp="2024-01-01T00:00:00.000Z">
  <file name="/test/file.cls">
    <violation beginline="1" rule="ErrorRule">Error violation</violation>
  </file>
</pmd>`;

		const mockError = new Error('Command failed');
		(mockError as any).code = 1;
		(mockError as any).stdout = mockXmlOutput;
		mockedExecSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			success: true,
			data: {
				violations: [
					{
						line: 1,
						column: 0,
						message: 'Error violation',
						rule: 'ErrorRule',
						priority: 5,
					},
				],
			},
		});
	});

	it('should handle PMD not found error', async () => {
		const mockError = new Error('Command failed');
		(mockError as any).code = 'ENOENT';
		mockedExecSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		expect(result).toEqual({
			success: false,
			error: 'PMD CLI not available. Please install PMD to run tests. Visit: https://pmd.github.io/pmd/pmd_userdocs_installation.html',
		});
	});

	it('should handle execution errors that produce valid empty XML', async () => {
		const mockError = new Error('Command failed with stderr');
		(mockError as any).code = 1;
		(mockError as any).stderr = 'PMD stderr output';
		(mockError as any).stdout = '<?xml version="1.0"?><pmd></pmd>'; // Valid but empty XML
		mockedExecSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		// When PMD exits with error but produces valid XML, we return success with parsed violations
		expect(result).toEqual({
			success: true,
			data: {
				violations: [],
			},
		});
	});

	it('should handle PMD errors with parseable output', async () => {
		const mockError = new Error('Command failed');
		(mockError as any).code = 1;
		(mockError as any).stdout = 'not xml at all just plain text';
		mockedExecSync.mockImplementation(() => {
			throw mockError;
		});

		const result = await runPMD('/test/apex.cls', '/test/rules.xml');

		// parseViolations can parse non-XML as empty violations, so we return success
		expect(result).toEqual({
			success: true,
			data: {
				violations: [],
			},
		});
	});

	it('should use correct command line arguments', () => {
		mockedExecSync.mockReturnValue(`<?xml version="1.0"?><pmd></pmd>`);

		runPMD('apex/file.cls', 'rules/file.xml');

		expect(mockedExecSync).toHaveBeenCalledWith(
			'pmd check --no-cache --no-progress -d "apex/file.cls" -R "rules/file.xml" -f xml',
			expect.any(Object),
		);
	});

	it('should respect timeout configuration', async () => {
		mockedExecSync.mockReturnValue(`<?xml version="1.0"?><pmd></pmd>`);

		runPMD('/test/apex.cls', '/test/rules.xml');

		expect(mockedExecSync).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				timeout: 30000,
			}),
		);
	});
});
