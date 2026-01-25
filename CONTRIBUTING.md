# Contributing to ZakOps

Thank you for your interest in contributing to ZakOps.

## Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Run `make install` to install dependencies
4. Run `make doctor` to verify your environment
5. Run `make test` to ensure everything works

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Ensure all tests pass: `make test`
4. Ensure all gates pass: `make gates`
5. Submit PR with description of changes
6. Address review feedback

## Code Style

- Python: Follow PEP 8, use `ruff` for linting
- TypeScript: Follow project ESLint configuration
- Commit messages: Use conventional commits format

## Gate Checks

All PRs must pass these gates:
- `make lint` - Code style checks
- `make test` - Unit tests
- `make gates` - Full gate suite

## Questions?

Open an issue or contact the team at dev@zakops.io
