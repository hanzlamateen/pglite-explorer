# PGlite Explorer

Browse and manage [PGlite](https://pglite.dev/) databases directly inside VS Code and Cursor. A visual database GUI that auto-detects PGlite databases in your workspace and lets you perform CRUD operations, run SQL queries, and inspect schemas -- all without leaving your editor.

<!-- ![PGlite Explorer Screenshot](docs/screenshot.png) -->

## Features

- **Auto-detect databases** -- Scans your workspace for PGlite data directories (`PG_VERSION` files), parses source code for `new PGlite('./path')` patterns, and supports manual configuration
- **Create databases** -- Initialize new PGlite databases from the UI via a folder picker
- **Create tables** -- Visual form with column definitions and full constraint support (Primary Key, Foreign Key, Unique, Check, Indexes) with live SQL preview
- **Edit table structure** -- ALTER TABLE operations through a visual diff-based editor: rename tables/columns, add/drop columns, change types, toggle nullable, manage constraints and indexes
- **Drop tables** -- Remove tables with a confirmation prompt
- **Spreadsheet-like data grid** -- View rows and columns with sorting, filtering, and pagination
- **Inline editing** -- Double-click any cell to edit; Enter to save, Escape to cancel
- **Add rows** -- Click "+ Add Row" to insert new records via a form respecting constraints
- **Delete rows** -- Select rows via checkboxes and bulk-delete them
- **SQL editor** -- Write and execute raw SQL queries with syntax-highlighted CodeMirror editor and results table
- **Schema viewer** -- Inspect column types, nullability, defaults, primary keys, constraints, and indexes
- **Export** -- Export table data as CSV or JSON
- **Activity Bar** -- Dedicated sidebar icon with a tree view of databases and tables for quick navigation
- **Theme integration** -- Adapts to VS Code's light and dark themes automatically

### Supported Environments

- VS Code >= 1.75.0
- Cursor
- VS Codium (via Open VSX)

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"PGlite Explorer"**
4. Click **Install**

### From Open VSX (Cursor / VS Codium)

1. Open the Extensions view
2. Search for **"PGlite Explorer"**
3. Click **Install**

Or install from the command line:

```bash
# Cursor
cursor --install-extension EchEmLabs.pglite-explorer

# VS Codium
codium --install-extension EchEmLabs.pglite-explorer
```

### From VSIX

1. Download the `.vsix` file from the [GitHub Releases](https://github.com/hanzlamateen/pglite-explorer/releases) page
2. Open the Command Palette (`Ctrl+Shift+P`) and run **Extensions: Install from VSIX...**
3. Select the downloaded `.vsix` file

## Usage

### Opening the Explorer

**From the Activity Bar** (recommended):

1. Click the **PGlite Explorer** database icon in the left Activity Bar
2. The sidebar shows detected databases -- expand one to see its tables
3. Click a database or table to open the full explorer panel

**From the Command Palette**:

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **PGlite Explorer: Open PGlite Explorer**

The extension will automatically scan your workspace for PGlite databases. If none are found, you can:

- **PGlite Explorer: Create New Database** -- creates a fresh PGlite database in a folder you choose
- **PGlite Explorer: Add Database Path** -- opens a folder picker to add an existing database
- The Activity Bar welcome view also shows "Add Database" and "Refresh" buttons

### Database Detection

The extension uses three strategies to find PGlite databases:

1. **Auto-scan** -- Finds `PG_VERSION` files in your workspace (excluding `node_modules`, `.git`, etc.)
2. **Source parsing** -- Scans `.ts` and `.js` files for `new PGlite('./path')` and `PGlite.create('./path')` constructor patterns
3. **Manual config** -- User-specified paths via the `pgliteExplorer.databasePaths` setting

### Creating Databases

Click the **+** button next to the "Database" label in the sidebar, or run **PGlite Explorer: Create New Database** from the command palette. Select a parent folder and enter a name -- the extension initializes a new PGlite database directory automatically.

### Creating Tables

Click the **+** button next to the "Tables" label in the sidebar. The Create Table dialog lets you:

- Define columns with name, type (grouped dropdown of PostgreSQL types), Primary Key, Not Null, Unique, and Default
- Add table-level constraints: composite primary keys, foreign keys (with ON DELETE/UPDATE actions), multi-column unique, check constraints
- Create indexes (regular and unique)
- Preview the generated SQL before creating

### Editing Tables

Click the **pencil icon** next to any table in the sidebar to open the Edit Table dialog. You can:

- Rename the table or individual columns
- Add or drop columns
- Change column types, toggle nullable, modify defaults
- Add or drop constraints (Foreign Key, Unique, Check)
- Add or drop indexes
- Review all pending ALTER TABLE statements before applying

### Dropping Tables

Click the **x icon** next to a table in the sidebar. A confirmation dialog appears before the table is dropped.

### Working with Data

- Select a database from the sidebar dropdown
- Click a table name to browse its data
- **Sort**: Click column headers
- **Filter**: Use the filter bar above the grid (column, operator, value)
- **Edit**: Double-click any cell to modify its value
- **Add**: Click "+ Add Row" and fill in the form
- **Delete**: Check rows and click "Delete Selected"

### Running SQL Queries

Switch to the **SQL Editor** tab to write and execute custom queries:

```sql
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id
ORDER BY order_count DESC;
```

Results appear in a table below the editor with execution time.

### Inspecting Schema

Switch to the **Schema** tab to view:

- Column names, types, nullability, and default values
- Primary key indicators
- Constraints (PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK)
- Indexes with their definitions

## Configuration

All settings are under the `pgliteExplorer` namespace.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pgliteExplorer.databasePaths` | `string[]` | `[]` | Manually configured paths to PGlite database directories |
| `pgliteExplorer.autoDetect` | `boolean` | `true` | Automatically scan the workspace for PGlite databases |
| `pgliteExplorer.sourceDetect` | `boolean` | `true` | Parse source files for PGlite constructor paths |
| `pgliteExplorer.excludePatterns` | `string[]` | `["**/node_modules/**", ...]` | Glob patterns to exclude from scanning |
| `pgliteExplorer.pageSize` | `number` | `50` | Number of rows per page in the data grid |

### Example Settings

```json
{
  "pgliteExplorer.databasePaths": ["./my-local-db"],
  "pgliteExplorer.pageSize": 100,
  "pgliteExplorer.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**"
  ]
}
```

## Development

### Prerequisites

- Node.js >= 18
- VS Code >= 1.75.0

### Setup

```bash
git clone https://github.com/hanzlamateen/pglite-explorer.git
cd pglite-explorer
npm install
npm run build
```

### Running & Debugging

1. Open the project in VS Code
2. Seed the sample databases (first time only):
   ```bash
   npm run seed
   ```
3. Press `F5` to launch the Extension Development Host -- it opens the `test/fixtures/sample-workspace/` folder which contains two pre-built PGlite databases (`ecommerce-db` and `blog-db`) with realistic test data
4. The PGlite Explorer Activity Bar icon will appear with both databases detected

Three launch configurations are provided in `.vscode/launch.json`:

- **Run Extension** -- Opens the sample workspace with seeded databases
- **Run Extension (Current Workspace)** -- Opens with whatever workspace you have
- **Extension Tests** -- Runs the Mocha test suite

### Build Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build both extension and webview |
| `npm run compile-ext` | Build extension host only |
| `npm run build-webview` | Build webview only |
| `npm run watch-ext` | Watch and rebuild extension on changes |
| `npm run watch-webview` | Watch and rebuild webview on changes |
| `npm run lint` | Run ESLint |
| `npm run compile-tests` | Compile test files |
| `npm test` | Run tests |
| `npm run seed` | Generate sample PGlite databases in `test/fixtures/` |

### Project Structure

```
src/
  extension/              Extension host (Node.js)
    index.ts              activate() / deactivate()
    commands.ts           Command registrations
    config.ts             Configuration reader
    database/
      discovery.ts        Auto-scan, source parsing, manual config
      connection.ts       PGlite connection manager
      query.ts            Query execution service
    views/
      databaseTree.ts     Activity Bar tree view provider
    webview/
      provider.ts         Webview panel provider
  webview/                React webview (browser)
    index.tsx             Entry point
    App.tsx               Main app component
    components/           UI components (Sidebar, DataGrid, SqlEditor, CreateTableDialog, EditTableDialog, etc.)
    hooks/                React hooks
    styles/               CSS
  shared/                 Shared between extension and webview
    protocol.ts           Message types
build/                    esbuild build scripts
media/
  icon.svg                Activity Bar icon
test/
  suite/                  Mocha test suite
  fixtures/
    seed-databases.mjs    Script to generate sample databases
    sample-workspace/     Sample workspace for F5 debugging
.vscode/
  launch.json             Debug launch configurations
  tasks.json              Build tasks
```

## Publishing

This project uses GitHub Actions for automated publishing to both the **VS Code Marketplace** and the **Open VSX Registry**.

### Creating a Release

```bash
npm version patch  # or minor/major
git push origin --tags
```

The Release workflow will automatically build, test, package, and publish the extension.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `VSCE_PAT` | VS Code Marketplace Personal Access Token |
| `OVSX_PAT` | Open VSX Registry access token |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes
6. Push to the branch
7. Open a Pull Request

## Acknowledgments

- [PGlite](https://pglite.dev/) by ElectricSQL -- lightweight WASM Postgres
- [markdown-mermaid-zoom](https://github.com/hanzlamateen/markdown-mermaid-zoom) -- project template

## License

MIT
