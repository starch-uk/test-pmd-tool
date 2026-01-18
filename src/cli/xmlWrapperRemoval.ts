/**
 * @file
 * XML wrapper removal utilities for CLI diagnostics.
 * Removes wrapper elements added by createTestFile from PMD AST XML.
 */

const NODE_TYPE_ELEMENT = 1;
const EMPTY_ARRAY_LENGTH = 0;
const SINGLE_ELEMENT_INDEX = 0;
const DOT_SEPARATOR_LENGTH = 1;

/**
 * Remove wrapper elements and helper methods from XML DOM.
 * Removes ONLY the wrapper elements added by createTestFile based on tracking info.
 * @param doc - XML DOM document.
 * @param exampleIndex - 1-based example index used for wrapper names.
 * @param wrapperInfo - Tracking information about what was added by createTestFile.
 */
export function removeWrappersFromXmlDom(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Document type cannot be made readonly
	doc: Readonly<Document>,
	exampleIndex: number,
	wrapperInfo:
		| Readonly<{
				addedWrapperClass: boolean;
				wrapperClassName: string;
				addedWrapperMethod: boolean;
				wrapperMethodName: string;
				helperMethodNames: readonly string[];
		  }>
		| undefined,
): void {
	// If no tracking info, fall back to old logic for backward compatibility
	if (wrapperInfo === undefined) {
		const wrapperClassName = `TestClass${String(exampleIndex)}`;
		const wrapperMethodName = `testMethod${String(exampleIndex)}`;

		// Use the old detection logic
		const allMethods = doc.getElementsByTagName('Method');
		const helperMethods: Element[] = [];

		for (const method of Array.from(allMethods)) {
			const image = method.getAttribute('Image');
			const canonicalName = method.getAttribute('CanonicalName');

			if (
				image === wrapperMethodName ||
				canonicalName === wrapperMethodName
			) {
				continue;
			}

			const blockStatements = Array.from(method.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Node type cannot be made readonly
				(child: Readonly<Node>): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'BlockStatement',
			);

			for (const blockStatement of blockStatements) {
				const returnStatements = Array.from(
					blockStatement.childNodes,
				).filter(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Node type cannot be made readonly
					(child: Readonly<Node>): child is Element =>
						child.nodeType === NODE_TYPE_ELEMENT &&
						child.nodeName === 'ReturnStatement',
				);

				for (const returnStatement of returnStatements) {
					const literalExpressions = Array.from(
						returnStatement.childNodes,
					).filter(
						// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Node type cannot be made readonly
						(child: Readonly<Node>): child is Element =>
							child.nodeType === NODE_TYPE_ELEMENT &&
							child.nodeName === 'LiteralExpression',
					);

					const otherStatements = Array.from(
						blockStatement.childNodes,
					).filter(
						// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Node type cannot be made readonly
						(child: Readonly<Node>): child is Element =>
							child.nodeType === NODE_TYPE_ELEMENT &&
							child.nodeName !== 'ReturnStatement' &&
							child.nodeName !== 'ModifierNode',
					);

					if (
						otherStatements.length === EMPTY_ARRAY_LENGTH &&
						literalExpressions.length > EMPTY_ARRAY_LENGTH
					) {
						helperMethods.push(method);
						break;
					}
				}
			}
		}

		for (const helperMethod of helperMethods) {
			const parent = helperMethod.parentNode;
			if (parent !== null) {
				parent.removeChild(helperMethod);
			}
		}

		const wrapperMethods = Array.from(
			doc.getElementsByTagName('Method'),
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Element type cannot be made readonly
		).filter((method: Readonly<Element>) => {
			const image = method.getAttribute('Image');
			const canonicalName = method.getAttribute('CanonicalName');
			return (
				image === wrapperMethodName ||
				canonicalName === wrapperMethodName
			);
		});

		for (const wrapperMethod of wrapperMethods) {
			const parent = wrapperMethod.parentNode;
			if (parent === null) {
				continue;
			}

			const blockStatements = Array.from(wrapperMethod.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'BlockStatement',
			);

			for (const blockStatement of blockStatements) {
				const blockChildren = Array.from(
					blockStatement.childNodes,
				).filter(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
					(child): child is Element =>
						child.nodeType === NODE_TYPE_ELEMENT,
				);
				for (const blockChild of blockChildren) {
					parent.insertBefore(blockChild, wrapperMethod);
				}
			}

			parent.removeChild(wrapperMethod);
		}

		const wrapperClasses = Array.from(
			doc.getElementsByTagName('UserClass'),
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Element type cannot be made readonly
		).filter((userClass: Readonly<Element>) => {
			const simpleName = userClass.getAttribute('SimpleName');
			return simpleName === wrapperClassName;
		});

		const classDeclarations = Array.from(
			doc.getElementsByTagName('ClassDeclaration'),
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Element type cannot be made readonly
		).filter((classDecl: Readonly<Element>) => {
			const simpleName = classDecl.getAttribute('SimpleName');
			return simpleName === wrapperClassName;
		});

		const allWrapperClasses = [...wrapperClasses, ...classDeclarations];

		for (const wrapperClass of allWrapperClasses) {
			const parent = wrapperClass.parentNode;
			if (parent === null) {
				continue;
			}

			const classChildren = Array.from(wrapperClass.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Node type cannot be made readonly
				(child: Readonly<Node>): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT,
			);

			for (const classChild of classChildren) {
				parent.insertBefore(classChild, wrapperClass);
			}

			parent.removeChild(wrapperClass);
		}

		const allNodes = doc.getElementsByTagName('*');
		for (const node of Array.from(allNodes)) {
			const definingType = node.getAttribute('DefiningType');
			if (definingType === null) {
				continue;
			}
			if (definingType === wrapperClassName) {
				node.removeAttribute('DefiningType');
			} else if (definingType.startsWith(`${wrapperClassName}.`)) {
				const classNameWithoutPrefix = definingType.slice(
					wrapperClassName.length + DOT_SEPARATOR_LENGTH,
				);
				node.setAttribute('DefiningType', classNameWithoutPrefix);
			}
		}
		return;
	}

	// Use tracking info to surgically remove only what was added
	const {
		addedWrapperClass,
		wrapperClassName,
		addedWrapperMethod,
		wrapperMethodName,
		helperMethodNames,
	} = wrapperInfo;

	// Remove helper methods that were added
	const EMPTY_HELPER_METHODS_LENGTH = 0;
	if (helperMethodNames.length > EMPTY_HELPER_METHODS_LENGTH) {
		const allMethods = doc.getElementsByTagName('Method');
		const methodsArray = Array.from(allMethods);
		const ARRAY_LAST_INDEX_OFFSET = 1;
		for (
			let i = methodsArray.length - ARRAY_LAST_INDEX_OFFSET;
			i >= EMPTY_ARRAY_LENGTH;
			i--
		) {
			const method = methodsArray[i];
			if (method === undefined) {
				continue;
			}
			// TypeScript doesn't narrow after continue, so use a local variable
			const methodElement = method;
			const image = methodElement.getAttribute('Image');
			const canonicalName = methodElement.getAttribute('CanonicalName');
			if (
				(image !== null && helperMethodNames.includes(image)) ||
				(canonicalName !== null &&
					helperMethodNames.includes(canonicalName))
			) {
				const parent = methodElement.parentNode;
				if (parent !== null) {
					parent.removeChild(methodElement);
				}
			}
		}
	}

	// Remove wrapper method if it was added
	if (addedWrapperMethod) {
		const wrapperMethods = Array.from(
			doc.getElementsByTagName('Method'),
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Element type cannot be made readonly
		).filter((method: Readonly<Element>) => {
			const image = method.getAttribute('Image');
			const canonicalName = method.getAttribute('CanonicalName');
			return (
				image === wrapperMethodName ||
				canonicalName === wrapperMethodName
			);
		});

		for (const wrapperMethod of wrapperMethods) {
			const parent = wrapperMethod.parentNode;
			if (parent === null) {
				continue;
			}

			const blockStatements = Array.from(wrapperMethod.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'BlockStatement',
			);

			for (const blockStatement of blockStatements) {
				const blockChildren = Array.from(
					blockStatement.childNodes,
				).filter(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
					(child): child is Element =>
						child.nodeType === NODE_TYPE_ELEMENT,
				);
				for (const blockChild of blockChildren) {
					parent.insertBefore(blockChild, wrapperMethod);
				}
			}

			// Remove ModifierNode from wrapper method (it's not part of the example)
			// The ModifierNode is a sibling of BlockStatement, so remove it before removing the method
			const methodModifierNodes = Array.from(
				wrapperMethod.childNodes,
			).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'ModifierNode',
			);
			for (const modifierNode of methodModifierNodes) {
				wrapperMethod.removeChild(modifierNode);
			}

			parent.removeChild(wrapperMethod);
		}
	}

	// Remove wrapper class if it was added
	if (addedWrapperClass) {
		const wrapperClasses = Array.from(
			doc.getElementsByTagName('UserClass'),
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Element type cannot be made readonly
		).filter((userClass: Readonly<Element>) => {
			const simpleName = userClass.getAttribute('SimpleName');
			return simpleName === wrapperClassName;
		});

		const classDeclarations = Array.from(
			doc.getElementsByTagName('ClassDeclaration'),
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Element type cannot be made readonly
		).filter((classDecl: Readonly<Element>) => {
			const simpleName = classDecl.getAttribute('SimpleName');
			return simpleName === wrapperClassName;
		});

		const allWrapperClasses = [...wrapperClasses, ...classDeclarations];

		for (const wrapperClass of allWrapperClasses) {
			const parent = wrapperClass.parentNode;
			if (parent === null) {
				continue;
			}

			const classChildren = Array.from(wrapperClass.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Node type cannot be made readonly
				(child: Readonly<Node>): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT,
			);

			// Remove ModifierNode from wrapper class (it's not part of the example)
			// Keep all other children (methods, statements, etc.)
			for (const classChild of classChildren) {
				// Skip ModifierNode - it belongs to the wrapper class, not the example
				if (classChild.nodeName === 'ModifierNode') {
					// Remove it from the DOM entirely
					wrapperClass.removeChild(classChild);
					continue;
				}
				parent.insertBefore(classChild, wrapperClass);
			}

			parent.removeChild(wrapperClass);
		}
	} else {
		// Example had a class - keep the class structure but remove wrapper name
		// Also remove the ModifierNode that belongs to the wrapper class
		const wrapperClasses = Array.from(
			doc.getElementsByTagName('UserClass'),
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Element type cannot be made readonly
		).filter((userClass: Readonly<Element>) => {
			const simpleName = userClass.getAttribute('SimpleName');
			return simpleName === wrapperClassName;
		});

		const classDeclarations = Array.from(
			doc.getElementsByTagName('ClassDeclaration'),
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM Element type cannot be made readonly
		).filter((classDecl: Readonly<Element>) => {
			const simpleName = classDecl.getAttribute('SimpleName');
			return simpleName === wrapperClassName;
		});

		const allWrapperClasses = [...wrapperClasses, ...classDeclarations];

		for (const wrapperClass of allWrapperClasses) {
			wrapperClass.removeAttribute('SimpleName');
			const image = wrapperClass.getAttribute('Image');
			if (image === wrapperClassName) {
				wrapperClass.removeAttribute('Image');
			}

			// Remove ModifierNode that belongs to the wrapper class
			// (the class-level modifier we added, not modifiers from the example)
			const modifierNodes = Array.from(wrapperClass.childNodes).filter(
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Type predicate requires mutable parameter
				(child): child is Element =>
					child.nodeType === NODE_TYPE_ELEMENT &&
					child.nodeName === 'ModifierNode',
			);
			// Remove the first ModifierNode (class-level modifier from wrapper)
			// Keep any other ModifierNodes that might be part of the example
			if (modifierNodes.length > EMPTY_ARRAY_LENGTH) {
				const firstModifier = modifierNodes[SINGLE_ELEMENT_INDEX];
				if (firstModifier !== undefined) {
					// Check if it's the wrapper class modifier (Modifiers='1', Public='true')
					const modifiers = firstModifier.getAttribute('Modifiers');
					const publicAttr = firstModifier.getAttribute('Public');
					const MODIFIER_PUBLIC_VALUE = '1';
					if (
						modifiers === MODIFIER_PUBLIC_VALUE &&
						publicAttr === 'true'
					) {
						wrapperClass.removeChild(firstModifier);
					}
				}
			}
		}
	}

	// Remove or strip wrapper class prefix from DefiningType attribute on all nodes
	const allNodes = doc.getElementsByTagName('*');
	for (const node of Array.from(allNodes)) {
		const definingType = node.getAttribute('DefiningType');
		if (definingType === null) {
			continue;
		}
		if (definingType === wrapperClassName) {
			node.removeAttribute('DefiningType');
		} else if (definingType.startsWith(`${wrapperClassName}.`)) {
			const classNameWithoutPrefix = definingType.slice(
				wrapperClassName.length + DOT_SEPARATOR_LENGTH,
			);
			node.setAttribute('DefiningType', classNameWithoutPrefix);
		}
	}
}
