# test-pmd-rule

A standalone PMD Rule Tester for Apex rules, with XPath analysis and coverage validation.

[![Node Version](https://img.shields.io/badge/node-%3E%3D25.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE.md)

## Overview

This tool validates PMD Apex rules by testing them against examples embedded in the rule XML files. It ensures rules work correctly, provide adequate test coverage, and don't contain hardcoded values that should be parameterized.

## Features

- **Rule Validation**: Tests PMD rules against their documented examples with detailed test results
- **XPath Analysis**: Analyzes XPath expressions for node types, operators, attributes, and conditionals
- **Coverage Checking**: Validates that XPath expressions are properly tested with line number references
- **Hardcoded Value Detection**: Identifies values that should be parameterized
- **Line Number Tracking**: Shows exact line numbers in XML files for missing coverage items
- **TypeScript**: Written in TypeScript for better maintainability
- **100% Test Coverage**: All code is thoroughly tested (lines, functions, branches, statements)
- **Modular Architecture**: Clean separation of concerns with low complexity functions

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

# Or after building
pnpm build
node dist/test-pmd-rule.js rulesets/code-style/AvoidMagicNumbers.xml
```

The tool will:

1. Extract examples from the PMD rule XML file
2. Parse violation and valid markers from example code
3. Create temporary Apex test files
4. Run PMD against the test files
5. Validate that violations occur for violation examples and don't occur for valid examples
6. Analyze XPath coverage and show missing items with line numbers
7. Report comprehensive test results

## Requirements

- **Node.js**: ≥25.0.0
- **PMD CLI**: Available in PATH (see [PMD Installation](https://pmd.github.io/pmd/pmd_userdocs_installation.html))
- **Package Manager**: pnpm ≥10.0.0 (recommended)

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
```

### Project Structure

```
src/
├── cli/                    # Command-line interface
│   └── main.ts             # CLI entry point
├── pmd/                    # PMD execution utilities
│   ├── runPMD.ts           # PMD CLI execution
│   └── parseViolations.ts  # XML violation parsing
├── parser/                 # Example parsing and processing
│   ├── parseExample.ts     # Example code parsing
│   ├── extractMarkers.ts  # Violation/valid marker extraction
│   └── createTestFile.ts  # Test file generation
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

## Output Format

The tool provides detailed output including:

- **Test Details**: Individual test results for each example (violation/valid tests)
- **Test Summary**: Overall statistics (examples tested, passed, total violations)
- **XPath Coverage**: Detailed coverage analysis showing:
    - Node types coverage with line numbers for missing items
    - Conditionals coverage (only missing items shown)
    - Attributes coverage with line numbers for missing items
    - Operators coverage
- **Final Status**: Overall pass/fail status

Example output:

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
