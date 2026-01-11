import { readFileSync } from 'fs';
import { DOMParser } from '@xmldom/xmldom';
import type { FileOperationResult } from '../types/index.js';

/**
 * Extract XPath expression from XML rule file
 * @param xmlFilePath - Path to the PMD rule XML file
 * @returns XPath expression or null if not found
 */
export function extractXPath(
	xmlFilePath: string,
): FileOperationResult<string | null> {
	try {
		const content = readFileSync(xmlFilePath, 'utf-8');
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, 'text/xml');

		const properties = doc.getElementsByTagName('properties')[0];
		if (!properties) {
			return { success: true, data: null };
		}

		const xpathProperty = Array.from(
			properties.getElementsByTagName('property'),
		).find((prop) => prop.getAttribute('name') === 'xpath');

		if (!xpathProperty) {
			return { success: true, data: null };
		}

		const valueElement = xpathProperty.getElementsByTagName('value')[0];
		if (!valueElement) {
			return { success: true, data: null };
		}

		const xpath = valueElement.textContent?.trim() || null;
		return { success: true, data: xpath };
	} catch (error: any) {
		return {
			success: false,
			error: `Error extracting XPath: ${error.message}`,
		};
	}
}
