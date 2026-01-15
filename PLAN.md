# TypeScript Project Structure for PMD Rule Tester

## Project Overview

Convert the 3498-line `test-pmd-rule.js` file into a modular TypeScript project that:

- Decomposes functionality into cohesive modules (≤500 lines each)
- **All functions maintain <10 cyclomatic complexity**
- **Low cognitive complexity** - simple to read and understand
- Compiles to a single bundled `test-pmd-rule.js` file
- Provides a CLI command when installed via pnpm
- Includes comprehensive unit tests using Vitest
- Maintains full feature parity with the original JavaScript version
- Uses pnpm for package management (see PNPM.md)
- Integrates agent-docs for documentation via symlinked `docs/` folder
- Includes project documentation files inspired by [sca-extra](https://github.com/starch-uk/sca-extra)

## Complexity Requirements

### Cyclomatic Complexity

- **Maximum: 9** per function (target: <7)
- Use early returns to reduce branching
- Extract complex conditionals into separate functions
- Use lookup tables/maps instead of long if/else chains
- Strategy pattern for complex conditional logic

### Cognitive Complexity

- **Target: Low** - functions should be easy to read and understand
- Maximum nesting depth: 3 levels
- Single responsibility principle - one function, one purpose
- Extract complex logic into named helper functions
- Use descriptive function names that explain intent

### Refactoring Strategy

- Break down functions >39 lines into smaller functions
- Replace nested conditionals with guard clauses (early returns)
- Extract complex boolean expressions into well-named functions
- Use strategy pattern for conditional branches (especially in coverage checks)
- Split large switch/if-else chains into lookup tables or strategy maps

## Directory Structure

```
test-pmd-tool/
├── .github/
│   ├── workflows/
│   │   └── ci.yml                     # GitHub Actions CI workflow
│   └── ISSUE_TEMPLATE/
│       └── bug_report.md              # Issue template (from sca-extra)
│   └── pull_request_template.md       # PR template (from sca-extra)
├── .husky/
│   └── pre-commit                     # Pre-commit hook (from HUSKY.md)
├── src/
│   ├── cli/
│   │   └── main.ts                    # CLI entry point (~50 lines, CC: 2-3)
│   ├── pmd/
│   │   ├── runPMD.ts                  # PMD execution (~60 lines, CC: 3-4)
│   │   └── parseViolations.ts         # XML violation parsing (~35 lines, CC: 2-3)
│   ├── parser/
│   │   ├── parseExample.ts            # Example code parsing (~80 lines, CC: 4-5)
│   │   ├── extractMarkers.ts          # Marker extraction (~60 lines, CC: 3-4)
│   │   └── createTestFile.ts          # Test file generation (~120 lines, CC: 5-6)
│   ├── xpath/
│   │   ├── extractXPath.ts            # XPath extraction (~70 lines, CC: 3-4)
│   │   ├── analyzeXPath.ts            # XPath analysis entry (~100 lines, CC: 4-5)
│   │   ├── extractors/
│   │   │   ├── extractNodeTypes.ts    # Node type extraction (~80 lines, CC: 4-5)
│   │   │   ├── extractOperators.ts    # Operator extraction (~60 lines, CC: 3-4)
│   │   │   ├── extractAttributes.ts   # Attribute extraction (~60 lines, CC: 3-4)
│   │   │   └── extractConditionals.ts # Conditional extraction (~150 lines, CC: 6-7)
│   │   ├── checkHardcodedValues.ts    # Hardcoded value detection (~160 lines, CC: 6-7)
│   │   ├── coverage/
│   │   │   ├── checkCoverage.ts       # Main coverage checker (~120 lines, CC: 4-5)
│   │   │   ├── checkNodeTypes.ts      # Node type coverage (~100 lines, CC: 4-5)
│   │   │   ├── conditional/
│   │   │   │   ├── checkComparison.ts      # Comparison coverage (~80 lines, CC: 4-5)
│   │   │   │   ├── checkAndOperator.ts     # And operator coverage (~100 lines, CC: 6-7)
│   │   │   │   ├── checkNotCondition.ts    # Not condition coverage (~150 lines, CC: 7-8)
│   │   │   │   ├── checkOrBranch.ts        # Or branch coverage (~60 lines, CC: 4-5)
│   │   │   │   ├── checkUnionBranch.ts     # Union branch coverage (~60 lines, CC: 4-5)
│   │   │   │   ├── checkIfCondition.ts     # If condition coverage (~50 lines, CC: 3-4)
│   │   │   │   ├── checkQuantified.ts      # Quantified condition coverage (~60 lines, CC: 4-5)
│   │   │   │   ├── checkBooleanFunction.ts # Boolean function coverage (~80 lines, CC: 4-5)
│   │   │   │   └── strategies.ts           # Strategy map for conditionals (~80 lines, CC: 3-4)
│   │   │   └── patternMatchers.ts     # Pattern matching helpers (~100 lines, CC: 5-6)
│   │   └── branchSignature.ts         # Branch signature creation (~80 lines, CC: 4-5)
│   ├── tester/
│   │   ├── RuleTester.ts              # Main tester class (~400 lines, CC: 6-7 per method)
│   │   ├── qualityChecks.ts           # Quality validation entry (~100 lines, CC: 4-5)
│   │   ├── quality/
│   │   │   ├── checkRuleMetadata.ts   # Rule metadata checks (~80 lines, CC: 4-5)
│   │   │   ├── checkExamples.ts       # Example validation (~120 lines, CC: 5-6)
│   │   │   └── checkDuplicates.ts     # Duplicate detection (~100 lines, CC: 5-6)
│   │   └── branchTracking.ts          # Branch combination tracking (~150 lines, CC: 6-7)
│   ├── types/
│   │   └── index.ts                   # TypeScript type definitions (~100 lines)
│   └── utils/
│       ├── fileUtils.ts               # File operations (~50 lines, CC: 2-3)
│       ├── validationUtils.ts         # Validation helpers (~50 lines, CC: 2-3)
│       └── stringUtils.ts             # String manipulation helpers (~60 lines, CC: 3-4)
├── tests/
│   ├── unit/
│   │   ├── xpath/
│   │   │   ├── extractXPath.test.ts
│   │   │   ├── analyzeXPath.test.ts
│   │   │   ├── checkHardcodedValues.test.ts
│   │   │   └── coverage/
│   │   │       └── conditional/
│   │   │           ├── checkComparison.test.ts
│   │   │           ├── checkNotCondition.test.ts
│   │   │           └── checkAndOperator.test.ts
│   │   ├── pmd/
│   │   │   ├── runPMD.test.ts
│   │   │   └── parseViolations.test.ts
│   │   ├── parser/
│   │   │   ├── parseExample.test.ts
│   │   │   └── createTestFile.test.ts
│   │   └── tester/
│   │       ├── RuleTester.test.ts
│   │       └── qualityChecks.test.ts
│   ├── integration/
│   │   └── endToEnd.test.ts           # Full rule testing workflow
│   └── fixtures/
│       └── rulesets/                  # Copy sample XML files for testing
├── dist/
│   └── test-pmd-rule.js               # Single bundled output (generated)
├── docs/                               # Symlinked from agent-docs/docs
├── scripts/
│   ├── build.ts                       # Build script (TypeScript, Node 25+)
│   └── symlink-docs.js                # Postinstall script to symlink docs
├── package.json                       # pnpm package configuration
├── pnpm-lock.yaml                     # pnpm lockfile (generated)
├── .npmrc                             # pnpm configuration
├── .prettierrc                        # Prettier configuration (from PRETTIER.md)
├── .prettierignore                    # Prettier ignore patterns
├── eslint.config.ts                   # ESLint configuration (from ESLINT.md)
├── tsconfig.json                      # TypeScript configuration
├── vitest.config.ts                   # Vitest test configuration (from VITEST.md)
├── lint-staged.config.ts              # lint-staged configuration
├── CODE_OF_CONDUCT.md                 # Code of conduct (from sca-extra)
├── CONTRIBUTING.md                    # Contributing guidelines (from sca-extra)
├── LICENSE.md                         # License (MIT, from sca-extra)
├── PLAN.md                            # This plan document
├── README.md                          # Project documentation (from sca-extra)
└── SECURITY.md                        # Security policy (from sca-extra)
```

## Module Breakdown with Complexity Targets

### 1. Type Definitions (`src/types/index.ts`)

- All TypeScript interfaces and types
- **Complexity**: N/A (no executable code)

### 2. XPath Module (`src/xpath/`)

#### extractXPath.ts

- Extract XPath expression from XML rule file
- **Target CC: 3-4** - simple DOM traversal, early returns

#### analyzeXPath.ts

- Main entry point, delegates to extractors
- **Target CC: 4-5** - orchestrates extraction, minimal logic

#### extractors/ (New - to reduce complexity)

- **extractNodeTypes.ts**: Extract AST node types
    - **Target CC: 4-5** - use regex patterns, extract to helpers
- **extractOperators.ts**: Extract operators (@Op)
    - **Target CC: 3-4** - simple regex matching
- **extractAttributes.ts**: Extract attribute checks
    - **Target CC: 3-4** - simple regex matching
- **extractConditionals.ts**: Extract conditionals (not, and, or, etc.)
    - **Target CC: 6-7** - use strategy pattern for different conditional types
    - Split complex extraction into helper functions

#### checkHardcodedValues.ts

- Detect hardcoded values that should be variables
- **Target CC: 6-7** - split by value type (attributes, numbers, arrays)
- Use helper functions for each check type

#### coverage/ (Restructured for lower complexity)

**checkCoverage.ts**:

- Main orchestration, delegates to specific checkers
- **Target CC: 4-5** - simple delegation

**checkNodeTypes.ts**:

- Node type coverage checking
- **Target CC: 4-5** - use lookup map for node type keywords

**conditional/checkComparison.ts**:

- Comparison coverage (@BeginLine != @EndLine, etc.)
- **Target CC: 4-5** - use strategy map by attribute name
- Extract pattern matching to helpers

**conditional/checkAndOperator.ts**:

- And operator coverage checking
- **Target CC: 6-7** - delegate to specific condition checkers
- Use early returns extensively

**conditional/checkNotCondition.ts**:

- Not condition coverage checking
- **Target CC: 7-8** - split by pattern type (List, Map, Union, etc.)
- Extract each pattern check to separate function

**conditional/strategies.ts**:

- Strategy map linking conditional types to checker functions
- **Target CC: 3-4** - simple map lookup

**patternMatchers.ts**:

- Reusable pattern matching helpers
- **Target CC: 5-6** - each helper function <20 lines, CC: 2-3

### 3. PMD Module (`src/pmd/`)

#### runPMD.ts

- Execute PMD CLI and handle output
- **Target CC: 3-4** - simple command execution, error handling

#### parseViolations.ts

- Parse PMD XML output into violation objects
- **Target CC: 2-3** - simple DOM traversal

### 4. Parser Module (`src/parser/`)

#### parseExample.ts

- Parse example code blocks
- **Target CC: 4-5** - delegate marker extraction to separate module

#### extractMarkers.ts (New)

- Extract violation/valid markers
- **Target CC: 3-4** - simple pattern matching

#### createTestFile.ts

- Generate temporary Apex test files from examples
- **Target CC: 5-6** - split content generation from file writing
- Use helper functions for content transformation

### 5. Tester Module (`src/tester/`)

#### RuleTester.ts

- Main class orchestrating the testing workflow
- **Methods should be ≤39 lines each, CC: 5-6 max**
- Split large methods into private helper methods
- `extractExamples()`: CC 3-4
- `testRuleExamples()`: CC 6-7 (delegate to helpers)
- `runCoverageTest()`: CC 5-6 (orchestration only)

#### qualityChecks.ts

- Main entry point for quality validation
- **Target CC: 4-5** - delegates to specific checkers

#### quality/ (New - to reduce complexity)

- **checkRuleMetadata.ts**: Rule name, message, version checks
    - **Target CC: 4-5** - one function per check type
- **checkExamples.ts**: Example format validation
    - **Target CC: 5-6** - split by validation type
- **checkDuplicates.ts**: Duplicate message/branch detection
    - **Target CC: 5-6** - use Sets and Maps for efficient checking

#### branchTracking.ts

- Track branch combinations across examples
- **Target CC: 6-7** - split signature creation from tracking logic

### 6. CLI Module (`src/cli/`)

#### main.ts

- Command-line entry point
- Directory/file discovery and processing
- Parallel execution orchestration
- Output formatting with emojis and color
- Error handling
- Process exit codes
- **Target CC: 4-5** - orchestration logic, delegates to helpers

#### args.ts (New)

- Command-line argument parsing
- Support for flags: `--coverage`/`-c`, `--diag`/`-d`, `--help`/`-h`
- Validation of argument combinations
- Help message generation
- **Target CC: 3-4** - simple parsing with validation

### 7. Utils Module (`src/utils/`)

- **fileUtils.ts**: File I/O helpers, temporary file management
    - **Target CC: 2-3** - simple wrappers
- **validationUtils.ts**: Validation helpers
    - **Target CC: 2-3** - simple predicates
- **stringUtils.ts** (New): String manipulation helpers
    - **Target CC: 3-4** - extract common string operations

## Key Implementation Patterns

### Early Returns / Guard Clauses

```typescript
function checkCoverage(
	conditional: Conditional,
	content: string,
): CoverageResult {
	if (!content.trim()) {
		return createEmptyCoverageResult('no content');
	}
	if (!conditional.expression) {
		return createEmptyCoverageResult('no expression');
	}
	// Main logic here - already reduced nesting
}
```

### Strategy Pattern for Conditionals

```typescript
const conditionalCheckers = {
	comparison: checkComparisonCoverage,
	and_operator: checkAndOperatorCoverage,
	not_condition: checkNotConditionCoverage,
	// ...
};

function checkConditionalCoverage(
	conditional: Conditional,
	content: string,
): CoverageResult {
	const checker = conditionalCheckers[conditional.type];
	if (!checker) {
		return createUnknownCoverageResult(conditional);
	}
	return checker(conditional, content);
}
```

### Lookup Tables Instead of If/Else Chains

```typescript
const nodeTypeKeywords: Record<string, string[]> = {
	IfBlockStatement: ['if', 'else if'],
	WhileLoopStatement: ['while'],
	// ...
};

function checkNodeTypeCoverage(nodeType: string, content: string): boolean {
	const keywords = nodeTypeKeywords[nodeType] || [];
	return keywords.some((keyword) => content.toLowerCase().includes(keyword));
}
```

### Extract Complex Boolean Expressions

```typescript
// Instead of:
if (expr.includes('@') && (expr.includes('!=') || expr.includes('=') || ...)) {
  // ...
}

// Do:
function isAttributeComparison(expr: string): boolean {
  return expr.includes('@') && hasComparisonOperator(expr);
}

function hasComparisonOperator(expr: string): boolean {
  const operators = ['!=', '==', '<', '>', '<=', '>='];
  return operators.some(op => expr.includes(op));
}
```

### Single Responsibility Functions

```typescript
// Instead of one large function, break down:
function checkNotConditionCoverage(
	conditional: Conditional,
	content: string,
): CoverageResult {
	const patternType = detectNotPatternType(conditional.expression);
	switch (patternType) {
		case 'list_literal':
			return checkNotListLiteralCoverage(conditional, content);
		case 'map_literal':
			return checkNotMapLiteralCoverage(conditional, content);
		case 'union':
			return checkNotUnionCoverage(conditional, content);
		default:
			return checkNotGenericCoverage(conditional, content);
	}
}

function detectNotPatternType(expression: string): string {
	if (expression.includes('NewListLiteralExpression')) return 'list_literal';
	if (expression.includes('NewMapLiteralExpression')) return 'map_literal';
	if (expression.includes('/(') && expression.includes('|')) return 'union';
	return 'generic';
}
```

## Build Configuration

### TypeScript (`tsconfig.json`)

- Strict mode enabled
- ES2020 target (for Node 25+ compatibility)
- Node16 module resolution
- Maximum file complexity warnings
- TypeScript native support (Node 25+)

### Bundling (`scripts/build.ts`)

Since Node 25+ supports TypeScript natively, build script can be TypeScript:

```typescript
import { build } from 'esbuild';

build({
	entryPoints: ['src/cli/main.ts'],
	bundle: true,
	platform: 'node',
	outfile: 'dist/test-pmd-rule.js',
	external: ['@xmldom/xmldom'],
	banner: { js: '#!/usr/bin/env node' },
	format: 'esm',
	target: 'node25',
	sourcemap: true,
	minify: false,
}).catch(() => process.exit(1));
```

**Key settings:**

- Single-file output
- External dependencies: `@xmldom/xmldom`, Node built-ins
- Shebang preservation: `#!/usr/bin/env node`
- Source maps for debugging
- Minification: off (for readability)
- TypeScript native support (Node 25+) - build script written in TypeScript
- Uses `tsx` for running TypeScript scripts (or Node 25+ native TypeScript loader)

### Package Configuration (`package.json`)

Based on PNPM.md, use pnpm as package manager:

```json
{
	"name": "@your-org/test-pmd-rule",
	"version": "1.0.0",
	"packageManager": "pnpm@10.0.0",
	"engines": {
		"node": ">=25.0.0",
		"pnpm": ">=10"
	},
	"bin": {
		"test-pmd-rule": "./dist/test-pmd-rule.js"
	},
	"files": ["dist"],
	"dependencies": {
		"@xmldom/xmldom": "^0.8.10"
	},
	"devDependencies": {
		"@types/node": "^25.x",
		"typescript": "^5.x",
		"vitest": "^1.x",
		"esbuild": "^0.19.x",
		"@vitest/coverage-v8": "^1.x",
		"agent-docs": "^1.x",
		"husky": "^9.x",
		"prettier": "^3.x",
		"@prettier/plugin-xml": "^3.x",
		"lint-staged": "^15.x",
		"tsx": "^4.x",
		"eslint": "^9.x",
		"@eslint/js": "^9.x",
		"typescript-eslint": "^8.x",
		"eslint-plugin-jsdoc": "^50.x"
	},
	"scripts": {
		"build": "tsx scripts/build.ts",
		"test": "vitest run",
		"test:watch": "vitest",
		"test:coverage": "vitest run --coverage",
		"typecheck": "tsc --noEmit",
		"format": "prettier --write .",
		"format:check": "prettier --check .",
		"lint": "eslint .",
		"lint:fix": "eslint --fix .",
		"prepare": "husky",
		"postinstall": "node scripts/symlink-docs.js",
		"pre-commit": "pnpm format:check && pnpm lint && pnpm test"
	},
	"pnpm": {
		"overrides": {}
	}
}
```

### pnpm Configuration (`.npmrc`)

Based on PNPM.md:

```ini
# Store
store-dir=.pnpm-store

# Node modules structure
node-linker=isolated

# Lockfile
frozen-lockfile=false

# Install
save-exact=false
save-prefix=^
```

### Docs Symlink Script (`scripts/symlink-docs.js`)

Create symlink from `node_modules/agent-docs/docs` to project `docs/`:

```javascript
const fs = require('fs');
const path = require('path');

const agentDocsPath = path.join(__dirname, '../node_modules/agent-docs/docs');
const docsPath = path.join(__dirname, '../docs');

// Remove existing docs if it exists (but not if it's already the symlink target)
try {
	const stats = fs.lstatSync(docsPath);
	if (stats.isSymbolicLink()) {
		fs.unlinkSync(docsPath);
	}
} catch (err) {
	// docs doesn't exist, which is fine
}

// Create symlink
if (fs.existsSync(agentDocsPath)) {
	fs.symlinkSync(agentDocsPath, docsPath, 'dir');
	console.log('✓ Symlinked docs from agent-docs');
} else {
	console.warn('⚠ agent-docs not found, skipping docs symlink');
}
```

### Prettier Configuration (`.prettierrc`)

Based on PRETTIER.md:

```json
{
	"useTabs": true,
	"tabWidth": 4,
	"printWidth": 80,
	"semi": true,
	"singleQuote": true,
	"trailingComma": "all",
	"endOfLine": "lf",
	"overrides": [
		{
			"files": ["*.yml", "*.yaml"],
			"options": {
				"useTabs": false,
				"tabWidth": 4
			}
		}
	],
	"plugins": ["@prettier/plugin-xml"]
}
```

**Key settings:**

- `useTabs: true` - Use tabs for indentation (default)
- `tabWidth: 4` - 4 spaces per tab (for YAML override)
- `printWidth: 80` - 80 character line width
- Format TypeScript, JavaScript, Markdown, XML files

### ESLint Configuration (`eslint.config.ts`)

Based on ESLINT.md and ESLINTJSDOC.md, use flat config format:

```typescript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { jsdoc } from 'eslint-plugin-jsdoc';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.strict,
	jsdoc({
		config: 'flat/recommended-typescript-error',
		rules: {
			'jsdoc/require-description': 'error',
			'jsdoc/require-param': 'error',
			'jsdoc/require-returns': 'error',
			'jsdoc/require-param-description': 'error',
			'jsdoc/require-returns-description': 'error',
			'jsdoc/check-types': 'error',
			'jsdoc/check-param-names': 'error',
		},
	}),
	{
		files: ['**/*.ts'],
		rules: {
			complexity: ['error', { max: 9 }],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/explicit-function-return-type': 'warn',
		},
	},
	{
		ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
	},
);
```

**Key settings:**

- Flat config format (ESLint v9)
- TypeScript ESLint with strict config
- JSDoc plugin with TypeScript-aware rules
- Complexity rule: max 9
- JSDoc required for functions, parameters, return types

### Husky Pre-commit Hook (`.husky/pre-commit`)

Based on HUSKY.md:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec lint-staged
```

Or manual setup:

```bash
pnpm format:check && pnpm lint && pnpm test
```

### lint-staged Configuration (`lint-staged.config.ts`)

```typescript
export default {
	'*.{ts,js}': ['prettier --write', 'eslint --fix'],
	'*.{md,xml,yml,yaml}': ['prettier --write'],
};
```

### Vitest Configuration (`vitest.config.ts`)

Based on VITEST.md:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: false,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json'],
			thresholds: {
				lines: 100,
				functions: 100,
				branches: 100,
				statements: 100,
			},
		},
	},
});
```

**Key settings:**

- 100% coverage required (lines, functions, branches, statements)
- Coverage fails if thresholds not met

## Testing Strategy

### Unit Tests

- Test each function in isolation
- Mock external dependencies (file system, PMD CLI)
- **100% code coverage required** (lines, functions, branches, statements)
- Coverage fails if thresholds not met
- Test edge cases and error paths
- Use fixtures from `rulesets/` directory
- Tests can be written in TypeScript (Node 25+ native support)

### Integration Tests

- Full workflow tests
- Use real rule XML files as fixtures
- Mock PMD CLI execution (predictable output)
- Test error handling and cleanup

### Test Organization

- Mirror source structure in `tests/unit/`
- One test file per source file
- Group related tests with `describe` blocks
- Use `test.each` for parameterized tests

## CLI Interface Design

### Command-Line Arguments

The CLI should support the following arguments and flags:

**Required:**

- `<rule.xml|directory>`: Path to XML rule file or directory containing XML files (recursive). Required unless using `--help`/`-h`.

**Optional Flags:**

- `--coverage`, `-c`: Generate LCOV coverage report in `coverage/lcov.info`
    - Can be used with single files or directories
    - Cannot be combined with `--diag`
- `--diag <number>`, `-d <number>`: Output PMD AST dump for specified example (1-based index)
    - Requires a single XML rule file, not a directory
    - Useful for debugging XPath expressions
    - Example indices are 1-based (first example = 1, second = 2, etc.)
    - Cannot be combined with `--coverage`
- `--help`, `-h`: Show help message and exit

### Output Features

**Emoji-Enhanced Output:**

- Use emojis for visual indicators in console output:
    - 🧪 Testing status
    - 📋 Test details
    - 📊 Test summary
    - 🔍 XPath coverage analysis
    - ✅ Pass/Success indicators
    - ⚠️ Warning/Incomplete indicators
    - ❌ Error/Failure indicators
    - ⭐ Quality checks
    - 🎯 Overall results
    - 📄 Diagnostic file content

**Color Output:**

- Use terminal colors (ANSI escape codes) where supported:
    - Green for success/pass indicators
    - Yellow for warnings/incomplete status
    - Red for errors/failures
    - Blue/cyan for informational messages
    - Respect terminal color capabilities (check if terminal supports colors)

**Structured Output:**

- Clear sections with proper indentation
- Hierarchical display of test results
- Line number references for missing coverage items
- Summary statistics for batch processing

**Error Messages:**

- Clear, actionable error messages
- Validation errors for invalid arguments
- File not found errors with suggestions
- Invalid argument combination errors

## Build Scripts

Based on PNPM.md, use pnpm commands (scripts can be TypeScript with Node 25+):

- `pnpm build`: Compile TypeScript and bundle with esbuild (via build.ts)
- `pnpm test`: Run Vitest tests
- `pnpm test:coverage`: Generate coverage report (100% required)
- `pnpm test:watch`: Watch mode for development
- `pnpm typecheck`: Type checking with tsc
- `pnpm format`: Format code with Prettier
- `pnpm format:check`: Check formatting without writing
- `pnpm lint`: Run ESLint
- `pnpm lint:fix`: Run ESLint with auto-fix
- `pnpm install`: Install dependencies (creates docs symlink via postinstall, sets up Husky)
- `pnpm prepare`: Initialize Husky hooks
- `pnpm pre-commit`: Run format check, lint, and tests (used by Husky)
- `pnpm prepublishOnly`: Build before publish

## Pre-commit Hooks (Husky)

Based on HUSKY.md:

- **Pre-commit hook**: Runs formatting check, linting, and unit tests
- Hooks stored in `.husky/` directory
- Scripts can be TypeScript (Node 25+ native support)
- Uses lint-staged for efficient staged file processing
- Fail if formatting, linting, or tests fail

## GitHub Actions Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    test:
        runs-on: ubuntu-latest
        strategy:
            matrix:
                node-version: [25.x]

        steps:
            - uses: actions/checkout@v4

            - uses: pnpm/action-setup@v4
              with:
                  version: 10

            - uses: actions/setup-node@v4
              with:
                  node-version: ${{ matrix.node-version }}
                  cache: 'pnpm'

            - name: Install dependencies
              run: pnpm install --frozen-lockfile

            - name: Check formatting
              run: pnpm format:check

            - name: Run linter
              run: pnpm lint

            - name: Run type check
              run: pnpm typecheck

            - name: Run tests with coverage
              run: pnpm test:coverage

            - name: Upload coverage
              uses: codecov/codecov-action@v4
              with:
                  fail_ci_if_error: true
                  files: ./coverage/coverage-final.json
```

**Key requirements:**

- **100% coverage required** - workflow fails if coverage < 100%
- Format check must pass
- Linting must pass
- All tests must pass
- Type checking must pass

## Project Documentation

Inspired by [sca-extra](https://github.com/starch-uk/sca-extra), create the following documentation files:

### README.md

- Project overview and description
- Installation instructions using pnpm
- Usage examples
- Features
- Contributing guidelines reference
- License reference
- Links to documentation in `docs/` folder

### PLAN.md

- This plan document (moved/renamed from current plan location)
- Project structure and architecture
- Complexity requirements
- Implementation patterns
- Migration strategy

### CODE_OF_CONDUCT.md

- Contributor Code of Conduct
- Based on sca-extra template
- Reference to standard community guidelines

### CONTRIBUTING.md

- How to contribute
- Development setup instructions
- Testing requirements
- Pull request process
- Code style guidelines
- Complexity requirements (CC < 10)

### LICENSE.md

- MIT License
- Copyright notice
- Permission notice
- Warranty disclaimer

### SECURITY.md

- Security policy
- Reporting security vulnerabilities to `security@starch.uk` (ONLY mention email in this file)
- Supported versions
- Security best practices

### .github/ISSUE_TEMPLATE/bug_report.md

- Bug report template
- Required information fields
- Reproduction steps template
- Environment information

### .github/pull_request_template.md

- Pull request template
- Checklist for contributors
- Description format
- Testing requirements

## Documentation Setup

### agent-docs Integration

1. Install `agent-docs` as dev dependency: `pnpm add -D agent-docs`
2. Create `scripts/symlink-docs.js` to symlink `node_modules/agent-docs/docs` to `docs/`
3. Add `postinstall` script to `package.json` to run symlink script
4. Reference documentation in `docs/` folder from README.md

The `docs/` folder will be symlinked from `node_modules/agent-docs/docs`, providing:

- PMD Quick Reference
- Code Analyzer Configuration
- AI Agent Rule Guide
- XPath 3.1 Reference
- PMD Apex AST Reference
- Other agent-docs documentation files

## Migration Strategy

### Phase 1: Project Setup

- [ ] Create TypeScript project structure
- [ ] Set up pnpm configuration (`.npmrc`, `package.json` with `packageManager`)
- [ ] Install dependencies with pnpm: `pnpm install`
- [ ] Set up Prettier (`.prettierrc` with tabs, 80 width, XML plugin)
- [ ] Set up ESLint (`eslint.config.ts` with TypeScript ESLint and JSDoc plugin)
- [ ] Set up Husky for pre-commit hooks (`.husky/pre-commit`)
- [ ] Set up lint-staged configuration
- [ ] Set up build tools (TypeScript, esbuild - build script in TypeScript)
- [ ] Configure Vitest (100% coverage thresholds)
- [ ] Define all types/interfaces
- [ ] Install agent-docs: `pnpm add -D agent-docs`
- [ ] Create `scripts/symlink-docs.js` and add `postinstall` script
- [ ] Create `scripts/build.ts` (TypeScript build script for Node 25+)
- [ ] Create GitHub Actions workflow (`.github/workflows/ci.yml`)
- [ ] Create project documentation files (README.md, CONTRIBUTING.md, etc.) inspired by sca-extra
- [ ] Create GitHub templates (issue template, PR template)

### Phase 2: Simple Modules First

- [ ] Types and utilities (`src/types/index.ts`)
- [ ] PMD module (simple I/O)
    - [ ] `src/pmd/runPMD.ts` - PMD CLI execution
    - [ ] `src/pmd/parseViolations.ts` - XML violation parsing
- [ ] Parser module (simple parsing)
    - [ ] `src/parser/parseExample.ts` - Example code parsing
    - [ ] `src/parser/extractMarkers.ts` - Violation/valid marker extraction
    - [ ] `src/parser/createTestFile.ts` - Test file generation
- [ ] CLI module (argument parsing and orchestration)
    - [ ] `src/cli/args.ts` - Command-line argument parsing with validation
        - Support `--coverage`/`-c`, `--diag`/`-d`, `--help`/`-h` flags
        - Validate argument combinations (e.g., `--coverage` cannot be used with `--diag`)
        - Generate help message
    - [ ] `src/cli/main.ts` - CLI entry point
        - Directory/file discovery
        - Parallel execution orchestration
        - Output formatting with emojis and color
        - Error handling and exit codes

### Phase 3: Complex Modules (Refactored)

- [ ] XPath extractors (split from analyzeXPath)
    - [ ] `src/xpath/extractXPath.ts` - XPath extraction from XML
    - [ ] `src/xpath/analyzeXPath.ts` - Main orchestration
    - [ ] `src/xpath/extractors/extractNodeTypes.ts` - Node type extraction
    - [ ] `src/xpath/extractors/extractOperators.ts` - Operator extraction
    - [ ] `src/xpath/extractors/extractAttributes.ts` - Attribute extraction
    - [ ] `src/xpath/extractors/extractConditionals.ts` - Conditional extraction
- [ ] Coverage checkers (split by conditional type)
    - [ ] `src/xpath/checkCoverage.ts` - Main coverage orchestration
    - [ ] Implement line number tracking for missing items
    - [ ] Add support for showing line numbers in XML files for attributes and node types
- [ ] Quality checks (split by check type)
    - [ ] `src/tester/qualityChecks.ts` - Quality validation entry
    - [ ] `src/tester/quality/checkRuleMetadata.ts` - Rule metadata checks
    - [ ] `src/tester/quality/checkExamples.ts` - Example validation
    - [ ] `src/tester/quality/checkDuplicates.ts` - Duplicate detection
- [ ] RuleTester (split large methods)
    - [ ] `src/tester/RuleTester.ts` - Main tester class
    - [ ] Ensure all methods are ≤39 lines, CC < 10
    - [ ] Split large methods into private helpers

### Phase 4: Testing

- [ ] Unit tests for each module
    - [ ] XPath extraction tests
    - [ ] PMD execution tests
    - [ ] Parser tests
    - [ ] Coverage checker tests
    - [ ] Quality check tests
    - [ ] RuleTester tests
- [ ] Integration tests
    - [ ] End-to-end workflow tests
    - [ ] Test with real rule XML files
- [ ] Refactor based on test feedback
- [ ] Complexity analysis (verify CC < 10)
- [ ] Achieve 100% test coverage (lines, functions, branches, statements)

### Phase 5: Polish

- [ ] Documentation (JSDoc comments for all public APIs)
- [ ] Error messages (clear and helpful)
- [ ] Build and distribution (verify single-file bundle works)
- [ ] Output formatting (clean, readable CLI output)
- [ ] Final verification (all tests pass, 100% coverage, no lint errors)

## Complexity Validation

### Tools

- Use ESLint rule `complexity` with max 9
- Manual code review for cognitive complexity
- Function length checks (warn at 39 lines)

### Checklist

- [ ] All functions have CC < 10 (target: <7)
- [ ] Maximum nesting depth: 3 levels
- [ ] Complex conditionals extracted to named functions
- [ ] Long if/else chains replaced with lookup tables
- [ ] Strategy pattern used for conditional branches
- [ ] Early returns used to reduce nesting
- [ ] Functions have single responsibility
- [ ] Complex logic extracted to helper functions
- [ ] All functions are ≤39 lines
- [ ] All modules are ≤500 lines
- [ ] 100% test coverage achieved (lines, functions, branches, statements)
- [ ] All lint checks pass
- [ ] All formatting checks pass

## CLI Usage Examples

### Basic Usage

```bash
# Test a single rule file
test-pmd-rule path/to/rule.xml

# Test all XML files in a directory (recursive)
test-pmd-rule ../sca-extra/rulesets

# Generate LCOV coverage report
test-pmd-rule rulesets/code-style/AvoidMagicNumbers.xml --coverage
test-pmd-rule rulesets/code-style/AvoidMagicNumbers.xml -c  # Short form

# Test directory with coverage reports
test-pmd-rule ../sca-extra/rulesets --coverage

# Output AST dump for debugging (single file only)
test-pmd-rule path/to/rule.xml --diag 1
test-pmd-rule path/to/rule.xml -d 2  # Short form

# Show help
test-pmd-rule --help
test-pmd-rule -h  # Short form

# Use npx without installing globally
npx test-pmd-rule path/to/rule.xml
```

### Argument Validation Rules

- `--coverage` and `--diag` cannot be used together
- `--diag` requires a single XML file, not a directory
- `--diag` requires a valid example index (1-based, must exist in the file)
- Path argument is required unless using `--help`/`-h`
- Invalid argument combinations should display clear error messages

### Output Format Examples

**Single File Test Output:**

```
🧪 Testing rule: rulesets/code-style/MyRule.xml

📋 Test Details:
   - Example 1 Test: Violation ✅
   - Example 1 Test: Valid ✅

📊 Test Summary:
  Examples tested: 1
  Examples passed: 1
  Total violations: 2
  Rule triggers violations: ✅ Yes

🔍 XPath Coverage:
  Status: ✅ Complete

✅ All tests passed!
```

**AST Diagnostic Output:**

```
🔍 AST Dump for Example 1:

ApexFile
  UserClass[SimpleName="TestClass1"]
    Method[Image="testMethod1"]
      BlockStatement
        ...
```

## Notes

- Maintain backward compatibility with original script usage
- Preserve all existing functionality
- Add JSDoc comments for public APIs
- Use async/await consistently
- Handle errors gracefully with proper error messages
- All code should be self-documenting through clear naming
- CLI output should be user-friendly with emojis and colors
- Support both long (`--flag`) and short (`-f`) flag forms
- Validate all argument combinations and provide helpful error messages
