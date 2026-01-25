# Beta Changelog

All notable changes during the beta program will be documented here.

## Format

Each release follows this format:
- **Version**: Semantic version (MAJOR.MINOR.PATCH)
- **Date**: Release date
- **Type**: Added, Changed, Fixed, Removed, Security

---

## [Unreleased]

### Added
- Feedback submission endpoint (`POST /api/feedback`)
- Beta onboarding documentation
- Demo environment isolation

### Changed
- Improved agent response times
- Updated dashboard styling

### Fixed
- None yet

---

## [0.9.0-beta.3] - 2026-01-25

### Added
- Blue/green deployment support
- Game day chaos testing infrastructure
- Restore drill automation
- Runbook documentation

### Changed
- Enhanced observability dashboards
- Improved error messages for LLM failures

### Fixed
- Fixed approval workflow timeout issues
- Corrected dashboard API routing in Docker

---

## [0.9.0-beta.2] - 2026-01-20

### Added
- Human-in-the-loop approval workflow
- Agent visibility layer
- Audit logging for all operations

### Changed
- Upgraded to Python 3.11
- Improved database connection pooling

### Fixed
- Fixed memory leak in agent runner
- Corrected timezone handling in reports

---

## [0.9.0-beta.1] - 2026-01-15

### Added
- Initial beta release
- Core deal management
- Basic AI agent integration
- Dashboard MVP

### Known Issues
- Agent suggestions may be slow on large deals
- Report export limited to CSV
- Mobile view needs improvement

---

## Versioning

We use [Semantic Versioning](https://semver.org/):
- MAJOR: Incompatible API changes
- MINOR: New functionality (backwards compatible)
- PATCH: Bug fixes (backwards compatible)

Beta versions use the `-beta.N` suffix.

## Feedback

Found an issue? Submit feedback via:
- In-app feedback button
- `POST /api/feedback`
- Email: beta-feedback@zakops.com
