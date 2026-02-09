# Contributing to Q Manager

Thank you for your interest in contributing to Q Manager! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Keep discussions professional and on-topic

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/Q-Manager.git`
3. Add upstream remote: `git remote add upstream https://github.com/QMahyar/Q-Manager.git`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** toolchain (1.70+)
- **Python** 3.8+ (for Telethon worker)
- **Git**

### Installation

```bash
# Install dependencies
npm ci

# Build Telethon worker (Windows)
cd telethon-worker
.\build-telethon.ps1 -Output .\dist -Clean

# Build Telethon worker (Linux)
cd telethon-worker
./build-telethon.sh --output ./dist --clean

# Start development server
npm run tauri dev
```

### Running Tests

```bash
# Frontend tests
npm test
npm run test:coverage

# Rust checks (all platforms)
cd src-tauri
cargo check

# Rust tests (Linux/macOS only)
cargo test
```

> **Note**: On Windows, GUI-linked tests may fail due to system DLL entrypoints. Use `cargo check` for validation.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/QMahyar/Q-Manager/issues)
2. Use the bug report template
3. Include:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Platform and version info

### Suggesting Features

1. Check existing feature requests
2. Use the feature request template
3. Explain the use case and benefit
4. Provide examples if possible

### Code Contributions

1. Pick an issue or propose a new feature
2. Comment on the issue to avoid duplicate work
3. Follow the development workflow below

## Coding Standards

### TypeScript/React

- Use TypeScript for type safety
- Follow existing code style (Prettier/ESLint)
- Write meaningful component and function names
- Add JSDoc comments for complex logic
- Use shadcn/ui components when possible

### Rust

- Follow Rust idioms and best practices
- Use `cargo fmt` for formatting
- Run `cargo clippy` for linting
- Add documentation comments (`///`) for public APIs
- Handle errors explicitly (no unwrap in production code)

### General

- Keep functions small and focused
- Write self-documenting code
- Add comments for complex algorithms
- Ensure accessibility (ARIA labels, keyboard navigation)

## Commit Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```
feat(accounts): add batch import for multiple accounts

fix(login): resolve 2FA timeout issue

docs(readme): update installation instructions

chore(deps): update tauri to 2.1.0
```

## Pull Request Process

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure quality**
   - All tests pass
   - No TypeScript/ESLint errors
   - `cargo check` passes
   - Code is formatted

3. **Create PR**
   - Use a clear, descriptive title
   - Reference related issues (`Fixes #123`)
   - Describe what changed and why
   - Add screenshots for UI changes

4. **Review process**
   - Address feedback promptly
   - Keep discussions respectful
   - Update your branch as needed

5. **After merge**
   - Delete your feature branch
   - Pull latest changes from upstream

## Development Workflow Example

```bash
# 1. Create feature branch
git checkout -b feat/add-export-feature

# 2. Make changes and commit
git add .
git commit -m "feat(export): add JSON export for account settings"

# 3. Keep branch updated
git fetch upstream
git rebase upstream/main

# 4. Push to your fork
git push origin feat/add-export-feature

# 5. Create pull request on GitHub
```

## Questions?

If you have questions:
- Check existing documentation
- Search [GitHub Issues](https://github.com/QMahyar/Q-Manager/issues)
- Open a new discussion issue

## Thank You!

Your contributions make Q Manager better for everyone. We appreciate your time and effort! 🙏
