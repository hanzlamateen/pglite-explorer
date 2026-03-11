# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-03-09

### Added

- Initial release of PGlite Explorer
- Auto-detect PGlite databases via workspace scanning (`PG_VERSION` files)
- Source code parsing for `new PGlite('./path')` and `PGlite.create('./path')` patterns
- Manual database path configuration via settings
- Spreadsheet-like data grid with pagination, sorting, and filtering
- Inline cell editing (double-click to edit, Enter to save, Escape to cancel)
- Add new rows via form dialog
- Bulk row deletion with checkbox selection
- SQL query editor with CodeMirror 6 and PostgreSQL syntax highlighting
- Query results table with execution time
- Schema viewer showing columns, types, constraints, and indexes
- Export table data as CSV or JSON
- VS Code theme integration (light/dark mode)
- FileSystemWatcher for auto-detecting new databases
- CI/CD with GitHub Actions (VS Code Marketplace + Open VSX)
