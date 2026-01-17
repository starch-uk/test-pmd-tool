/**
 * @file
 * Color coding utilities for marker visualization and identification.
 */
import type { ViolationMarker } from '../types/index.js';

/**
 * ANSI color codes for terminal output.
 */
const ANSI_COLORS = {
	blue: '\x1b[34m',
	bright: '\x1b[1m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m',
	green: '\x1b[32m',
	magenta: '\x1b[35m',
	red: '\x1b[31m',
	reset: '\x1b[0m',
	yellow: '\x1b[33m',
} as const;

const LINE_INDEX_OFFSET = 1;
const MIN_ARRAY_INDEX = 0;
const STRING_START_INDEX = 0;

const SINGLE_COUNT = 1;
const MIN_COUNT = 0;

/**
 * Color configuration for different marker types.
 */
export interface MarkerColorConfig {
	violation: {
		primary: string;
		secondary: string;
		icon: string;
	};
	valid: {
		primary: string;
		secondary: string;
		icon: string;
	};
}

/**
 * Default color configuration for markers.
 */
const DEFAULT_MARKER_COLORS: MarkerColorConfig = {
	valid: {
		icon: '✅',
		primary: ANSI_COLORS.green,
		secondary: ANSI_COLORS.cyan,
	},
	violation: {
		icon: '❌',
		primary: ANSI_COLORS.red,
		secondary: ANSI_COLORS.yellow,
	},
};

/**
 * Get color code for a marker type.
 * @param isViolation - Whether this is a violation marker.
 * @param usePrimary - Whether to use primary color (default: true).
 * @returns ANSI color code string.
 */
function getMarkerColor(isViolation: boolean, usePrimary = true): string {
	const config = DEFAULT_MARKER_COLORS[isViolation ? 'violation' : 'valid'];
	return usePrimary ? config.primary : config.secondary;
}

/**
 * Format a code line with marker color coding.
 * @param line - Code line text.
 * @param marker - Optional marker to apply color coding.
 * @param showMarker - Whether to show the marker icon/description.
 * @returns Color-coded line string.
 */
function formatLineWithMarker(
	line: Readonly<string>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Optional parameter with Readonly wrapper is appropriate
	marker?: Readonly<ViolationMarker>,
	showMarker = true,
): string {
	if (!marker) {
		return line;
	}

	const color = getMarkerColor(marker.isViolation);
	const config =
		DEFAULT_MARKER_COLORS[marker.isViolation ? 'violation' : 'valid'];
	const { icon } = config;

	if (showMarker) {
		const markerText = marker.description
			? `${icon} ${marker.description}`
			: icon;
		return `${color}${line}${ANSI_COLORS.reset} // ${markerText}`;
	}

	return `${color}${line}${ANSI_COLORS.reset}`;
}

/**
 * Format code span with color highlighting.
 * @param source - Full source code.
 * @param marker - Marker with code span information.
 * @returns Color-coded code span string.
 */
function formatCodeSpan(
	source: Readonly<string>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Readonly wrapper is appropriate for immutable marker
	marker: Readonly<ViolationMarker>,
): string {
	if (!marker.codeSpan) {
		return '';
	}

	const { startLine, startColumn, endLine, endColumn } = marker.codeSpan;
	const lines = source.split('\n');
	const color = getMarkerColor(marker.isViolation);
	const config =
		DEFAULT_MARKER_COLORS[marker.isViolation ? 'violation' : 'valid'];
	const { icon } = config;

	const startLineIndex = startLine - LINE_INDEX_OFFSET;
	const endLineIndex = endLine - LINE_INDEX_OFFSET;

	if (startLineIndex < MIN_ARRAY_INDEX || endLineIndex >= lines.length) {
		return '';
	}

	if (startLine === endLine) {
		// Single line highlighting
		const line = lines[startLineIndex];
		if (line === undefined) {
			return '';
		}
		const before = line.substring(
			STRING_START_INDEX,
			startColumn - LINE_INDEX_OFFSET,
		);
		const highlighted = line.substring(
			startColumn - LINE_INDEX_OFFSET,
			endColumn - LINE_INDEX_OFFSET,
		);
		const after = line.substring(endColumn - LINE_INDEX_OFFSET);
		return `${before}${color}${highlighted}${ANSI_COLORS.reset}${after} // ${icon}`;
	}

	// Multi-line highlighting
	const parts: string[] = [];
	const firstLine = lines[startLineIndex];
	if (firstLine !== undefined) {
		const before = firstLine.substring(
			STRING_START_INDEX,
			startColumn - LINE_INDEX_OFFSET,
		);
		const highlighted = firstLine.substring(
			startColumn - LINE_INDEX_OFFSET,
		);
		parts.push(`${before}${color}${highlighted}${ANSI_COLORS.reset}`);
	}

	for (let i = startLineIndex + LINE_INDEX_OFFSET; i < endLineIndex; i++) {
		const line = lines[i];
		if (line !== undefined) {
			parts.push(`${color}${line}${ANSI_COLORS.reset}`);
		}
	}

	const lastLine = lines[endLineIndex];
	if (lastLine !== undefined) {
		const highlighted = lastLine.substring(
			STRING_START_INDEX,
			endColumn - LINE_INDEX_OFFSET,
		);
		const after = lastLine.substring(endColumn - LINE_INDEX_OFFSET);
		parts.push(`${color}${highlighted}${ANSI_COLORS.reset}${after}`);
	}

	return parts.join('\n');
}

/**
 * Generate a summary of markers with color coding.
 * @param markers - Array of markers to summarize.
 * @returns Formatted summary string.
 */
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- readonly array is appropriate for immutable collection
function formatMarkerSummary(markers: readonly ViolationMarker[]): string {
	if (markers.length === MIN_COUNT) {
		return `${ANSI_COLORS.gray}No markers found${ANSI_COLORS.reset}`;
	}

	const violationCount = markers.filter(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Readonly wrapper in filter callback is appropriate
		(m: Readonly<ViolationMarker>) => m.isViolation,
	).length;
	const validCount = markers.filter(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Readonly wrapper in filter callback is appropriate
		(m: Readonly<ViolationMarker>) => !m.isViolation,
	).length;

	const parts: string[] = [];
	if (violationCount > MIN_COUNT) {
		const violationText =
			violationCount !== SINGLE_COUNT ? 'violations' : 'violation';
		parts.push(
			`${getMarkerColor(true)}${String(violationCount)} ${violationText}${ANSI_COLORS.reset}`,
		);
	}
	if (validCount > MIN_COUNT) {
		const validText = validCount !== SINGLE_COUNT ? 'valids' : 'valid';
		parts.push(
			`${getMarkerColor(false)}${String(validCount)} ${validText}${ANSI_COLORS.reset}`,
		);
	}

	return parts.join(', ');
}

const UNKNOWN_NODE_TYPE = 'Unknown';

/**
 * Format markers grouped by AST node type.
 * @param markers - Array of markers with AST information.
 * @returns Formatted grouped summary string.
 */
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- readonly array is appropriate for immutable collection
function formatMarkersByASTNode(markers: readonly ViolationMarker[]): string {
	const byNodeType = new Map<string, ViolationMarker[]>();

	for (const marker of markers) {
		const nodeType = marker.astNodeType ?? UNKNOWN_NODE_TYPE;
		const existing = byNodeType.get(nodeType) ?? [];
		existing.push(marker);
		byNodeType.set(nodeType, existing);
	}

	if (byNodeType.size === MIN_COUNT) {
		return `${ANSI_COLORS.gray}No AST node information available${ANSI_COLORS.reset}`;
	}

	const parts: string[] = [];
	for (const [nodeType, nodeMarkers] of byNodeType.entries()) {
		const violationCount = nodeMarkers.filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Readonly wrapper in filter callback is appropriate
			(m: Readonly<ViolationMarker>) => m.isViolation,
		).length;
		const validCount = nodeMarkers.filter(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Readonly wrapper in filter callback is appropriate
			(m: Readonly<ViolationMarker>) => !m.isViolation,
		).length;
		const summary: string[] = [];
		if (violationCount > MIN_COUNT) {
			const violationText =
				violationCount !== SINGLE_COUNT ? 'violations' : 'violation';
			summary.push(
				`${getMarkerColor(true)}${String(violationCount)} ${violationText}${ANSI_COLORS.reset}`,
			);
		}
		if (validCount > MIN_COUNT) {
			const validText = validCount !== SINGLE_COUNT ? 'valids' : 'valid';
			summary.push(
				`${getMarkerColor(false)}${String(validCount)} ${validText}${ANSI_COLORS.reset}`,
			);
		}
		parts.push(
			`${ANSI_COLORS.cyan}${nodeType}${ANSI_COLORS.reset}: ${summary.join(', ')}`,
		);
	}

	return parts.join('\n');
}

export {
	DEFAULT_MARKER_COLORS,
	formatCodeSpan,
	formatLineWithMarker,
	formatMarkerSummary,
	formatMarkersByASTNode,
	getMarkerColor,
};
