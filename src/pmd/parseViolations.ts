import { DOMParser } from '@xmldom/xmldom';
import type { Violation } from '../types/index.js';

/**
 * Parse PMD XML output and extract violation information
 * @param xmlOutput - Raw XML output from PMD CLI
 * @returns Array of violation objects
 */
export function parseViolations(xmlOutput: string): Violation[] {
	const parser = new DOMParser();
		const doc = parser.parseFromString(xmlOutput, 'text/xml');
		const violations: Violation[] = [];

		// PMD XML format: <pmd><file><violation>...</violation></file></pmd>
		const fileNodes = doc.getElementsByTagName('file');

		for (let i = 0; i < fileNodes.length; i++) {
			const fileNode = fileNodes[i];

			const violationNodes = fileNode.getElementsByTagName('violation');

			for (let j = 0; j < violationNodes.length; j++) {
				const violationNode = violationNodes[j];

				const line = parseInt(
					violationNode.getAttribute('beginline') || '0',
					10,
				);

				const column = parseInt(
					violationNode.getAttribute('begincolumn') || '0',
					10,
				);

				const violation: Violation = {
					line,
					column,
					message:
						violationNode.getAttribute('message') ||
						violationNode.textContent?.trim() ||
						'',
					rule: violationNode.getAttribute('rule') || '',
					priority: parseInt(
						violationNode.getAttribute('priority') || '5',
						10,
					),
				};

				violations.push(violation);
			}
		}

		return violations;
}
