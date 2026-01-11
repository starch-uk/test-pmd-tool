# Contributing to @your-org/test-pmd-rule

Thank you for your interest in contributing to the PMD Rule Tester! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Guidelines](#development-guidelines)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Documentation](#documentation)

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.

## Getting Started

### Prerequisites

- **Node.js**: ≥25.0.0
- **pnpm**: ≥10.0.0
- **PMD CLI**: Available in PATH

### Development Setup

1. **Fork and Clone** the repository:

    ```bash
    git clone https://github.com/your-username/test-pmd-rule.git
    cd test-pmd-rule
    ```

2. **Install Dependencies**:

    ```bash
    pnpm install
    ```

3. **Set up Git Hooks**:

    ```bash
    pnpm prepare
    ```

4. **Verify Setup**:
    ```bash
    pnpm typecheck
    pnpm lint
    pnpm test
    ```

## Development Guidelines

### Code Quality Requirements

#### Cyclomatic Complexity

- **Maximum: 9** per function
- Use early returns to reduce branching
- Extract complex conditionals into separate functions
- Use lookup tables/maps instead of long if/else chains

#### Cognitive Complexity

- **Target: Low** - functions should be easy to read
- Maximum nesting depth: 3 levels
- Single responsibility principle
- Extract complex logic into named helper functions

#### Function Length

- **Maximum: 39 lines** per function
- Break down larger functions into smaller, focused functions
- Use early returns and guard clauses

### Code Style

This project uses automated formatting and linting:

- **Prettier**: For code formatting (tabs, 80 width, XML support)
- **ESLint**: For code quality with TypeScript and JSDoc rules
- **Husky**: Pre-commit hooks ensure code quality

### Naming Conventions

- **Functions**: camelCase, descriptive names explaining intent
- **Types/Interfaces**: PascalCase
- **Files**: kebab-case for directories, camelCase for files
- **Constants**: SCREAMING_SNAKE_CASE

### TypeScript Guidelines

- Use strict TypeScript configuration
- Avoid `any` type (use proper type definitions)
- Prefer interfaces over types for object shapes
- Use union types for related variants
- Document complex types with JSDoc comments

## Testing

### Test Coverage Requirements

- **100% coverage** required for:
    - Lines
    - Functions
    - Branches
    - Statements

### Test Organization

- Unit tests in `tests/unit/` mirror source structure
- Integration tests in `tests/integration/`
- Use descriptive test names
- Test edge cases and error paths
- Mock external dependencies

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test xpath.test.ts

# Watch mode
pnpm test:watch
```

## Submitting Changes

### Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

### Pull Request Process

1. **Create a Feature Branch**:

    ```bash
    git checkout -b feature/your-feature-name
    ```

2. **Make Changes**:
    - Follow development guidelines
    - Add/update tests
    - Update documentation if needed

3. **Run Quality Checks**:

    ```bash
    pnpm format:check
    pnpm lint
    pnpm typecheck
    pnpm test:coverage
    ```

4. **Commit Changes**:

    ```bash
    git add .
    git commit -m "feat: add new feature"
    ```

5. **Push and Create PR**:
    ```bash
    git push origin feature/your-feature-name
    ```

### Pull Request Requirements

- [ ] Tests pass with 100% coverage
- [ ] Code follows style guidelines
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional format
- [ ] PR description explains changes and rationale

## Documentation

### Updating Documentation

- Keep README.md current with new features
- Update JSDoc comments for public APIs
- Add examples for new functionality
- Update type definitions as needed

### Building Documentation

The `docs/` directory is symlinked from `agent-docs`. To update:

```bash
pnpm install  # This runs the postinstall script to create symlinks
```

## Issue Reporting

- Use [GitHub Issues](https://github.com/your-org/test-pmd-rule/issues) for bugs and feature requests
- Follow the bug report template
- Include reproduction steps and environment details

## Security

For security-related issues, please see our [Security Policy](SECURITY.md).

## Recognition

Contributors will be recognized in release notes and, if desired, in a future contributors file.

Thank you for contributing to make this project better! 🚀
