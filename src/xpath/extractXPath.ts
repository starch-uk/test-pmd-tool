/**
 * @file
 * XPath extraction from PMD rule XML files.
 */
import { readFileSync } from 'fs';
import { DOMParser } from '@xmldom/xmldom';
import type { FileOperationResult } from '../types/index.js';

const FIRST_ELEMENT_INDEX = 0;
const MIN_STRING_LENGTH = 0;

/**
 * Extract XPath expression from XML rule file.
 * @param xmlFilePath - Path to the PMD rule XML file.
 * @returns XPath expression or null if not found.
 */
export function extractXPath(
	xmlFilePath: Readonly<string>,
): FileOperationResult<string | null> {
	try {
		const content = readFileSync(xmlFilePath, 'utf-8');
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, 'text/xml');

		const properties =
			doc.getElementsByTagName('properties')[FIRST_ELEMENT_INDEX];
		if (!properties) {
			return { data: null, success: true };
		}

		const xpathProperty = Array.from(
			properties.getElementsByTagName('property'),
		).find(
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Element is used for getAttribute
			(prop: Readonly<Element>) => prop.getAttribute('name') === 'xpath',
		);

		if (!xpathProperty) {
			return { data: null, success: true };
		}

		const valueElement =
			xpathProperty.getElementsByTagName('value')[FIRST_ELEMENT_INDEX];
		if (!valueElement) {
			return { data: null, success: true };
		}

		const { textContent } = valueElement;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- textContent can be null at runtime
		const trimmed = textContent !== null ? textContent.trim() : null;
		const hasContent =
			trimmed !== null && trimmed.length > MIN_STRING_LENGTH;
		const xpath = hasContent ? trimmed : null;
		return { data: xpath, success: true };
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		return {
			error: `Error extracting XPath: ${errorMessage}`,
			success: false,
		};
	}
}
