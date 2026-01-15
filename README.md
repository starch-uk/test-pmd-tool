# test-pmd-rule

A high-performance PMD Rule Tester for Apex rules with directory support, parallel execution, XPath analysis, and LCOV coverage reporting.

[![Node Version](https://img.shields.io/badge/node-%3E%3D25.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE.md)

## Overview

This tool validates PMD Apex rules by testing them against examples embedded in the rule XML files. It ensures rules work correctly, provide adequate test coverage, and don't contain hardcoded values that should be parameterized.

**Key Capabilities:**

- **Mass Testing**: Test entire directories of rule files with recursive discovery
- **High Performance**: CPU-core-based parallel execution for blazing-fast testing
- **Coverage Analysis**: Generate LCOV coverage reports for XPath expressions
- **Comprehensive Validation**: Full XPath analysis with line number tracking

This project was born out of necessity as hood tooling for both humans and AI Agents was essential for furthering the [sca-extra](https://github.com/starch-uk/sca-extra) project.

### Output

The tool provides detailed output including:

- **Test Details**: Individual test results for each example (violation/valid tests)
- **Test Summary**: Overall statistics (examples tested, passed, total violations)
- **XPath Coverage**: Detailed coverage analysis showing:
    - Node types coverage with line numbers for missing items
    - Conditionals coverage (only missing items shown)
    - Attributes coverage with line numbers for missing items
    - Operators coverage
- **Final Status**: Overall pass/fail status

Example output (single file):

```
🧪 Testing rule: rulesets/code-style/MyRule.xml

📋 Test Details:
   - Example 1 Test: Violation ✅
   - Example 1 Test: Valid ✅
   - Example 2 Test: Violation ✅

📊 Test Summary:
  Examples tested: 2
  Examples passed: 2
  Total violations: 3
  Rule triggers violations: ✅ Yes

🔍 XPath Coverage:
  Status: ⚠️ Incomplete
  Coverage items: 2
    1. ⚠️ Node types: 4/6 covered
         Missing:
          - Line 43: VariableDeclaration
          - Line 50: VariableExpression
    2. ⚠️ Attributes: 2/3 covered
         Missing:
          - Line 52: BeginLine

✅ All tests passed!
```

Example output (directory with parallel execution):

```
🚀 Processing 15 rule file(s) with 8 parallel workers
   Each file will test examples with up to 16 parallel workers

🧪 Testing rule: rulesets/code-style/MyRule.xml

📋 Test Details:
   - Example 1 Test: Violation ✅
   - Example 1 Test: Valid ✅
   - Example 2 Test: Violation ✅

📊 Test Summary:
  Examples tested: 2
  Examples passed: 2
  Total violations: 3
  Rule triggers violations: ✅ Yes

🔍 XPath Coverage:
  Status: ✅ Complete

✅ All tests passed!

[... more files tested in parallel ...]

🎯 OVERALL RESULTS
============================================================
Total files processed: 15
Successful: 15
Failed: 0
```

## Features

- **Directory Support**: Test entire directories recursively - finds and tests all `**/*.xml` files
- **Parallel Execution**: CPU-core-based thread pools for blazing-fast testing of multiple rules and examples
- **Rule Validation**: Tests PMD rules against their documented examples with detailed test results
- **XPath Analysis**: Analyzes XPath expressions for node types, operators, attributes, and conditionals
- **Coverage Checking**: Validates that XPath expressions are properly tested with line number references
- **LCOV Coverage Reports**: Generate `coverage/lcov.info` files tracking XPath line coverage
- **Hardcoded Value Detection**: Identifies values that should be parameterized
- **Line Number Tracking**: Shows exact line numbers in XML files for missing coverage items
- **TypeScript**: Written in TypeScript for better maintainability
- **100% Test Coverage**: All code is thoroughly tested (lines, functions, branches, statements)
- **Modular Architecture**: Clean separation of concerns with low complexity functions

## How does it work?

The tool extracts examples from `<example>` tags in your PMD rule XML files and validates them against the rule's XPath expression. Examples must be configured to indicate which code should trigger violations and which should be valid.

### Example Configuration

Examples can be marked using two different formats:

#### Format 1: Section Headers

Use `// Violation:` and `// Valid:` comments to mark sections of code:

```xml
<example>
// Violation: Public method should trigger rule
public class TestClass {
    public void testMethod() {
        // method body
    }
}

// Valid: Private method should not trigger rule
public class ValidClass {
    private void testMethod() {
        // method body
    }
}
</example>
```

#### Format 2: Inline Markers

Use `// ❌` for violations and `// ✅` for valid code:

```xml
<example>
public class TestClass {
    public void violationMethod() { // ❌ Void method should trigger rule
        // method body
    }
    
    private Integer validMethod() { // ✅ Integer method should not trigger rule
        // method body
    }
}
</example>
```

### How Examples Are Processed

1. **Extraction**: The tool reads all `<example>` tags from your rule XML file
2. **Parsing**: Each example is parsed to identify violation and valid code sections
3. **Test File Creation**: Temporary Apex test files are generated with the example code
4. **PMD Execution**: PMD is run against the test files to check if violations occur as expected
5. **Validation**: The tool verifies that:
    - Violation examples actually trigger the rule
    - Valid examples do not trigger the rule
    - XPath expressions are properly covered by the examples

### Multiple Examples

You can include multiple `<example>` tags in a single rule XML file. Each example is tested independently:

```xml
<rule name="MyRule" ...>
  <example>
  // First example with violations and valid code
  ...
  </example>

  <example>
  // Second example with different scenarios
  ...
  </example>
</rule>
```

### AST Diagnostics

The `--diag` (or `-d`) flag allows you to inspect the Abstract Syntax Tree (AST) that PMD generates for a specific example. This is useful for:

- **Debugging XPath expressions**: See exactly how PMD parses your example code
- **Understanding node types**: Identify the AST node types that your XPath should target
- **Verifying structure**: Confirm that your example code produces the expected AST structure
- **Troubleshooting test failures**: Examine the AST when examples don't behave as expected

**Example indices are 1-based** (the first example is index 1, second is index 2, etc.):

```bash
# Get AST dump for the first example
test-pmd-rule path/to/rule.xml --diag 1

# Get AST dump for the second example
test-pmd-rule path/to/rule.xml -d 2
```

**Color Coding:**

The AST nodes are color-coded to indicate which parts of your example code are being tested:

- **Red (bright)**: Node is tested by **violation** examples in the current example
- **Dark Red (dim)**: Node is tested by **violation** examples but was already covered in previous examples
- **Green (bright)**: Node is tested by **valid** examples in the current example
- **Dark Green (dim)**: Node is tested by **valid** examples but was already covered in previous examples
- **No color**: Node is not tested or couldn't be matched to example code

This color coding helps you understand:

- Which AST nodes correspond to your violation/valid markers
- Whether nodes are being tested by the current example or were already covered
- Which parts of the AST structure your XPath expression should target

**Notes:**

- The AST dump is printed to stdout, showing the hierarchical structure of nodes that PMD extracts from your example code
- The diagnostic mode cannot be used with directories or combined with `--coverage`
- If the generated test file has syntax errors, the tool will display the generated file content to help debug issues
- The AST output includes all node attributes and can be quite verbose - use it when you need detailed insight into PMD's parsing
- Colors use ANSI escape codes and will automatically be disabled if your terminal doesn't support them

## Requirements

- **Node.js**: ≥25.0.0
- **PMD CLI**: Available in PATH (see [PMD Installation](https://pmd.github.io/pmd/pmd_userdocs_installation.html))
- **Package Manager**: pnpm ≥10.0.0 (recommended)

## Installation

```bash
# Install from npm
npm install -g test-pmd-rule

# Or install using pnpm (recommended)
pnpm install -g test-pmd-rule

# Or use npx to run without installing globally
npx test-pmd-rule path/to/rule.xml
```

## Usage

```bash
# Test a single rule
test-pmd-rule path/to/rule.xml

# Test all XML files in a directory (recursive)
test-pmd-rule ../sca-extra/rulesets

# Generate LCOV coverage reports
test-pmd-rule rulesets/code-style/AvoidMagicNumbers.xml --coverage

# Test directory with coverage reports
test-pmd-rule ../sca-extra/rulesets --coverage

# Output AST dump for a specific example (1-based index)
test-pmd-rule path/to/rule.xml --diag 2

# Short form flags
test-pmd-rule path/to/rule.xml -c          # --coverage
test-pmd-rule path/to/rule.xml -d 1        # --diag 1
test-pmd-rule --help                        # Show help
test-pmd-rule -h                            # Show help (short form)

# Or use npx without installing globally
npx test-pmd-rule path/to/rule.xml
```

**Arguments:**

- `<rule.xml|directory>`: Path to XML rule file or directory containing XML files (recursive). Required unless using `--help` or `-h`.

**Options:**

- `--coverage`, `-c`: Generate LCOV coverage report in `coverage/lcov.info`. Can be used with single files or directories. Cannot be combined with `--diag`.
- `--diag <number>`, `-d <number>`: Output PMD AST dump for the specified example (1-based index). Requires a single XML rule file, not a directory. Useful for debugging XPath expressions and understanding how PMD parses your example code. Cannot be combined with `--coverage`.
- `--help`, `-h`: Show help message and exit.

**Output Features:**

- **Emoji-enhanced output**: Visual indicators for different output sections and status:
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
- **Color output**: Terminal colors (ANSI escape codes) are used where supported for improved readability:
    - Green for success/pass indicators
    - Yellow for warnings/incomplete status
    - Red for errors/failures
    - Colors are automatically disabled if the terminal doesn't support them
- **Structured output**: Clear sections for test results, coverage analysis, and quality checks with proper indentation and hierarchical display

The tool will:

1. **Argument Parsing**: Parse command-line arguments including flags (`--coverage`, `--diag`, `--help`) and their short forms (`-c`, `-d`, `-h`)
2. **Directory Discovery**: If given a directory, recursively find all `**/*.xml` files
3. **Parallel Processing**: Test multiple files concurrently using CPU-core-based thread pools
4. **Extract Examples**: Parse examples from `<example>` tags in PMD rule XML files
5. **Parse Markers**: Identify violation (`// ❌` or `// Violation:`) and valid (`// ✅` or `// Valid:`) code sections
6. **Test File Creation**: Generate temporary Apex test files with example code
7. **Parallel PMD Execution**: Run PMD against test files with concurrent workers
8. **Validation**: Verify violations occur for violation examples and don't occur for valid examples
9. **XPath Coverage Analysis**: Analyze XPath expressions and show coverage with line numbers
10. **Coverage Reports**: Generate LCOV format reports when `--coverage` flag is used
11. **AST Diagnostics**: Output PMD AST dumps when `--diag` flag is used (single file mode only)
12. **Comprehensive Results**: Report detailed test results with emoji-enhanced output, color coding, and parallel processing stats
13. **Error Handling**: Provide clear error messages for invalid arguments, missing files, and execution errors

## Coverage Reporting

When using the `--coverage` flag, the tool generates LCOV format coverage reports in `coverage/lcov.info`. This tracks which lines of your XPath expressions are covered by your test examples.

### Coverage Data

- **XPath Lines**: Tracks coverage of XPath expression lines in the XML rule files
- **Component Lines**: Tracks coverage of XPath components (node types, attributes, etc.)
- **LCOV Format**: Compatible with coverage tools like VS Code Coverage Gutters, GitHub Actions, etc.

### Example LCOV Output

```
SF:rulesets/code-style/MyRule.xml
DA:75,1
DA:76,1
DA:79,0
DA:82,1
end_of_record
```

This shows that lines 75, 76, 79, and 82 in `MyRule.xml` were executed, with line 79 having 0 coverage (uncovered XPath code).

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/test-pmd-rule.git
cd test-pmd-rule

# Install dependencies
pnpm install

# Set up git hooks
pnpm prepare
```

### Available Scripts

```bash
# Build the project
pnpm build

# Run tests
pnpm test

# Run tests with coverage (100% required)
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Linting with auto-fix
pnpm lint:fix

# Formatting
pnpm format

# Check formatting
pnpm format:check

# Pre-commit checks (format, lint, test coverage)
pnpm pre-commit

# Test with coverage reports
pnpm test:coverage
```

### Project Structure

```
src/
├── cli/                    # Command-line interface
│   ├── main.ts             # CLI entry point
│   └── args.ts             # Argument parsing
├── coverage/               # Coverage reporting
│   ├── generateLcov.ts     # LCOV report generation
│   └── trackCoverage.ts    # Coverage data collection
├── pmd/                    # PMD execution utilities
│   ├── runPMD.ts           # PMD CLI execution
│   └── parseViolations.ts  # XML violation parsing
├── parser/                 # Example parsing and processing
│   ├── parseExample.ts     # Example code parsing
│   ├── extractMarkers.ts   # Violation/valid marker extraction
│   └── createTestFile.ts   # Test file generation
├── utils/                  # Utility functions
│   └── concurrency.ts      # Parallel execution utilities
├── xpath/                  # XPath analysis and validation
│   ├── extractXPath.ts     # XPath extraction from XML
│   ├── analyzeXPath.ts     # XPath analysis orchestration
│   ├── checkCoverage.ts    # Coverage checking
│   ├── extractors/         # XPath component extractors
│   │   ├── extractNodeTypes.ts
│   │   ├── extractOperators.ts
│   │   ├── extractAttributes.ts
│   │   ├── extractConditionals.ts
│   │   ├── extractHardcodedValues.ts
│   │   └── extractLetVariables.ts
│   └── coverage/           # Coverage checking modules
│       ├── checkCoverage.ts
│       ├── checkNodeTypes.ts
│       └── conditional/    # Conditional coverage strategies
│           ├── checkComparison.ts
│           └── strategies.ts
├── tester/                 # Main testing logic
│   ├── RuleTester.ts       # Main tester class
│   ├── qualityChecks.ts    # Quality validation entry point
│   └── quality/            # Quality check modules
│       ├── checkRuleMetadata.ts
│       ├── checkExamples.ts
│       ├── checkDuplicates.ts
│       └── checkQualityChecks.ts
└── types/                  # TypeScript type definitions
    └── index.ts

tests/                      # Unit and integration tests
├── unit/                   # Unit tests (mirror src/ structure)
└── integration/            # End-to-end tests

docs/                       # Documentation (symlinked from agent-docs)
```

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory (symlinked from [agent-docs](https://github.com/starch-uk/agent-docs/)):

- PMD Quick Reference
- Code Analyzer Configuration
- XPath 3.1 Reference
- PMD Apex AST Reference
- Testing Framework Documentation (Vitest)
- Code Quality Guidelines (ESLint, Prettier)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Guidelines

- **Cyclomatic Complexity**: All functions must maintain <10 complexity (target: <7)
- **Test Coverage**: 100% coverage required (lines, functions, branches, statements)
- **Code Style**: Follow the established Prettier and ESLint configurations
- **Function Length**: Maximum 39 lines per function
- **Module Size**: Maximum 500 lines per module
- **Commits**: Use conventional commit messages
- **Pre-commit**: All commits must pass format check, linting, and 100% test coverage

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

## Security

See our [Security Policy](SECURITY.md) for more information.

## Related Projects

- [sca-extra](https://github.com/starch-uk/sca-extra) - Salesforce Code Analyzer extras
- [PMD](https://pmd.github.io/) - PMD static analysis tool
- [agent-docs](https://github.com/starch-uk/agent-docs) - Documentation for AI agents
