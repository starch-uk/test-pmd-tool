/**
 * @file
 * File discovery utilities for finding XML rule files.
 */
import { readdirSync, statSync } from 'fs';
import { extname, resolve } from 'path';

/**
 * Recursively finds all XML files in a directory.
 * @param directory - Directory to search.
 * @returns Array of absolute paths to XML files.
 */
export function findXmlFiles(directory: string): string[] {
	const xmlFiles: string[] = [];
	const items = readdirSync(directory);

	for (const item of items) {
		const fullPath = resolve(directory, item);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			// Recursively search subdirectories
			xmlFiles.push(...findXmlFiles(fullPath));
		} else if (
			stat.isFile() &&
			extname(fullPath).toLowerCase() === '.xml'
		) {
			xmlFiles.push(fullPath);
		}
	}

	return xmlFiles;
}
