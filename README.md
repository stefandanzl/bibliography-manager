# Bibliography Manager

An Obsidian plugin for managing bibliographies and sources with BibTeX export functionality.

## Features

- **Source Management**: Create and organize source files in a dedicated sources folder
- **BibTeX Export**: Generate BibTeX bibliography files from your sources
- **DOI/ISBN Lookup**: Import sources using DOI, ISBN, URL, or BibTeX
- **Citekey Generation**: Automatic generation of academic citekeys
- **API for Other Plugins**: Exposes API for other plugins to use bibliography functionality
- **Commands**: Easy-to-use commands for bibliography management

## Installation

1. Clone this repository into your Obsidian plugins folder
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. Enable the plugin in Obsidian settings

## Usage

### Manual Usage

1. Use the command palette to access bibliography commands:
   - "Import new source" - Add sources via DOI, ISBN, URL, or BibTeX
   - "Generate citekey for current source" - Generate citekey for current file
   - "Export bibliography manually" - Create bibliography file
   - "Show sources folder" - Open sources folder in explorer

### API Usage for Other Plugins

Other plugins can access the bibliography functionality through the API:

```typescript
const bibPlugin = app.plugins.plugins['bibliography-manager'];

if (bibPlugin?.api) {
  // Generate bibliography content
  const bibContent = await bibPlugin.api.generateBibliography({
    sourcesFolder: 'sources'
  });

  // Export bibliography to specific path
  const bibPath = await bibPlugin.api.exportBibliographyToPath({
    sourcesFolder: 'sources',
    outputPath: 'output/bibliography.bib'
  });

  // Get all sources
  const sources = await bibPlugin.api.getAllSources('sources');

  // Import a new source
  const filePath = await bibPlugin.api.importSource({
    title: 'Example Paper',
    author: ['Smith, John', 'Doe, Jane'],
    year: '2023',
    citekey: 'Smith2023'
  });

  // Generate citekey
  const citekey = bibPlugin.api.generateCitekey({
    title: 'Example Paper',
    author: ['Smith, John'],
    year: '2023'
  });
}
```

## Settings

- **Sources Folder**: Folder where source files are stored (default: "sources")
- **Bibliography Filename**: Default filename for generated bibliography files (default: "bibliography.bib")
- **Auto-generate on Export**: Automatically generate bibliography when requested by other plugins

## Source File Format

Source files are markdown files with structured frontmatter:

```yaml
---
title: "Example Paper Title"
author: ["Smith, John", "Doe, Jane"]
year: 2023
citekey: "Smith2023"
notetype: "source"
category: ["paper"]
bibtype: "article"
journal: "Journal Name"
doi: "10.1000/example"
abstract: "Paper abstract..."
url: "https://example.com/paper"
---
```

## Development

1. Install dependencies: `npm install`
2. Run development build: `npm run dev`
3. Run production build: `npm run build`

## Dependencies

- `@citation-js/core` - Citation processing
- `@citation-js/plugin-bibtex` - BibTeX support
- `@citation-js/plugin-doi` - DOI lookup
- `@citation-js/plugin-isbn` - ISBN lookup
- `@citation-js/plugin-wikidata` - Wikidata integration

## License

MIT License