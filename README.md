# @your-org/test-pmd-rule

A standalone PMD Rule Tester for Apex rules, with XPath analysis and coverage validation.

[![CI](https://github.com/your-org/test-pmd-rule/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/test-pmd-rule/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/badge/node-%3E%3D25.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE.md)

## Overview

This tool validates PMD Apex rules by testing them against examples embedded in the rule XML files. It ensures rules work correctly, provide adequate test coverage, and don't contain hardcoded values that should be parameterized.

## Features

- **Rule Validation**: Tests PMD rules against their documented examples
- **XPath Analysis**: Analyzes XPath expressions for node types, operators, and conditionals
- **Coverage Checking**: Validates that XPath expressions are properly tested
- **Hardcoded Value Detection**: Identifies values that should be parameterized
- **TypeScript**: Written in TypeScript for better maintainability
- **100% Test Coverage**: All code is thoroughly tested
- **CI/CD Ready**: Includes GitHub Actions workflow

## Installation

```bash
# Using pnpm (recommended)
pnpm install -g @your-org/test-pmd-rule

# Using npm
npm install -g @your-org/test-pmd-rule

# Using yarn
yarn global add @your-org/test-pmd-rule
```

## Usage

```bash
# Test a single rule
test-pmd-rule path/to/rule.xml

# Example
test-pmd-rule rulesets/code-style/AvoidMagicNumbers.xml
```

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

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Formatting
pnpm format

# Check formatting
pnpm format:check
```

### Project Structure

```
src/
├── cli/                    # Command-line interface
├── pmd/                    # PMD execution utilities
├── parser/                 # Example parsing and processing
├── xpath/                  # XPath analysis and validation
├── tester/                 # Main testing logic
├── types/                  # TypeScript type definitions
└── utils/                  # Utility functions

tests/                      # Unit and integration tests
docs/                       # Documentation (symlinked from agent-docs)
```

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- [PMD Quick Reference](docs/pmd-quick-reference.md)
- [Code Analyzer Configuration](docs/code-analyzer-config.md)
- [XPath 3.1 Reference](docs/xpath-3.1-reference.md)
- [PMD Apex AST Reference](docs/pmd-apex-ast-reference.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Guidelines

- **Cyclomatic Complexity**: All functions must maintain <10 complexity
- **Test Coverage**: 100% coverage required (lines, functions, branches, statements)
- **Code Style**: Follow the established Prettier and ESLint configurations
- **Commits**: Use conventional commit messages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

## Security

Please report security vulnerabilities to [security@starch.uk](mailto:security@starch.uk). See our [Security Policy](SECURITY.md) for more information.

## Related Projects

- [sca-extra](https://github.com/starch-uk/sca-extra) - Salesforce Code Analyzer extras
- [PMD](https://pmd.github.io/) - PMD static analysis tool
- [agent-docs](https://github.com/starch-uk/agent-docs) - Documentation for AI agents
