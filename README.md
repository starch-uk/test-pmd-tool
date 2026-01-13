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

## Requirements

- **Node.js**: ≥25.0.0
- **PMD CLI**: Available in PATH (see [PMD Installation](https://pmd.github.io/pmd/pmd_userdocs_installation.html))
- **Package Manager**: pnpm ≥10.0.0 (recommended)

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/test-pmd-rule.git
cd test-pmd-rule

# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Usage

```bash
# Test a single rule
node dist/test-pmd-rule.js path/to/rule.xml

# Test all XML files in a directory (recursive)
node dist/test-pmd-rule.js ../sca-extra/rulesets

# Generate LCOV coverage reports
node dist/test-pmd-rule.js rulesets/code-style/AvoidMagicNumbers.xml --coverage

# Test directory with coverage reports
node dist/test-pmd-rule.js ../sca-extra/rulesets --coverage
```

**Arguments:**

- `<rule.xml|directory>`: Path to XML rule file or directory containing XML files (recursive)
- `--coverage`: Generate LCOV coverage report in `coverage/lcov.info`

The tool will:

1. **Directory Discovery**: If given a directory, recursively find all `**/*.xml` files
2. **Parallel Processing**: Test multiple files concurrently using CPU-core-based thread pools
3. **Extract Examples**: Parse examples from `<example>` tags in PMD rule XML files
4. **Parse Markers**: Identify violation (`// ❌` or `// Violation:`) and valid (`// ✅` or `// Valid:`) code sections
5. **Test File Creation**: Generate temporary Apex test files with example code
6. **Parallel PMD Execution**: Run PMD against test files with concurrent workers
7. **Validation**: Verify violations occur for violation examples and don't occur for valid examples
8. **XPath Coverage Analysis**: Analyze XPath expressions and show coverage with line numbers
9. **Coverage Reports**: Generate LCOV format reports when `--coverage` flag is used
10. **Comprehensive Results**: Report detailed test results with parallel processing stats

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
│   └── main.ts             # CLI entry point
├── coverage/               # Coverage reporting
│   ├── generateLcov.ts    # LCOV report generation
│   └── trackCoverage.ts   # Coverage data collection
├── pmd/                    # PMD execution utilities
│   ├── runPMD.ts           # PMD CLI execution
│   └── parseViolations.ts  # XML violation parsing
├── parser/                 # Example parsing and processing
│   ├── parseExample.ts     # Example code parsing
│   ├── extractMarkers.ts  # Violation/valid marker extraction
│   └── createTestFile.ts  # Test file generation
├── utils/                  # Utility functions
│   └── concurrency.ts      # Parallel execution utilities
├── xpath/                  # XPath analysis and validation
│   ├── extractXPath.ts    # XPath extraction from XML
│   ├── analyzeXPath.ts    # XPath analysis orchestration
│   ├── checkCoverage.ts   # Coverage checking
│   └── extractors/        # XPath component extractors
│       ├── extractNodeTypes.ts
│       ├── extractOperators.ts
│       ├── extractAttributes.ts
│       └── extractConditionals.ts
├── tester/                 # Main testing logic
│   ├── RuleTester.ts      # Main tester class
│   ├── qualityChecks.ts   # Quality validation
│   └── quality/           # Quality check modules
│       ├── checkRuleMetadata.ts
│       ├── checkExamples.ts
│       └── checkDuplicates.ts
└── types/                  # TypeScript type definitions
    └── index.ts

tests/                      # Unit and integration tests
├── unit/                   # Unit tests
└── integration/            # End-to-end tests

docs/                       # Documentation (symlinked from agent-docs)
```

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory (symlinked from [agent-docs](https://github.com/starch-uk/agent-docs/)):

- PMD Quick Reference
- Code Analyzer Configuration
- XPath 3.1 Reference
- PMD Apex AST Reference

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

Please report security vulnerabilities to [security@starch.uk](mailto:security@starch.uk). See our [Security Policy](SECURITY.md) for more information.

## Related Projects

- [sca-extra](https://github.com/starch-uk/sca-extra) - Salesforce Code Analyzer extras
- [PMD](https://pmd.github.io/) - PMD static analysis tool
- [agent-docs](https://github.com/starch-uk/agent-docs) - Documentation for AI agents
