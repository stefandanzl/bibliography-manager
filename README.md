# Bibliography Manager

A powerful Obsidian plugin for managing academic citations and bibliographies directly within your vault. Import sources from DOIs, ISBNs, URLs, or BibTeX, organize them with customizable templates, and export bibliographies in multiple formats.

## Features

-   🔍 **Multiple Import Methods**: Import sources from DOIs, ISBNs, URLs, or BibTeX entries
-   📄 **Customizable Templates**: Use markdown templates with powerful placeholders for source notes
-   📚 **Format Support**: Export bibliographies in BibTeX, CSL-JSON, and Hayagriva formats
-   🔗 **API for Developers**: Programmatic access to bibliography generation for other plugins
-   🎯 **Deduplication**: Automatic detection and removal of duplicate sources
-   🏷️ **Citekey Generation**: Automatic citekey generation with customizable patterns

## Quick Start

1. **Set up your sources folder**: Configure a folder to store your source files
2. **Configure your template**: Set up a template for how your source notes should look
3. **Import your first source**: Use `Ctrl+P` → "Import source" and choose your import method
4. **Generate bibliography**: Use `Ctrl+P` → "Generate bibliography file" to export your bibliography

## Templating

The plugin uses customizable markdown templates to create source notes. Templates support various placeholders that get replaced with actual source data.

### Available Template Variables

#### Core Fields

-   `{{citekey}}` - Generated citation key (e.g., `smith2020`)
-   `{{title}}` - Title of the source
-   `{{author}}` - Author names as array or formatted string
-   `{{year}}` - Publication year
-   `{{type}}` - Source type (article, book, misc, etc.)

#### Bibliographic Fields

-   `{{journal}}` - Journal/conference name
-   `{{publisher}}` - Publisher name
-   `{{volume}}` - Volume number
-   `{{number}}` - Issue number
-   `{{pages}}` - Page numbers
-   `{{doi}}` - DOI identifier
-   `{{isbn}}` - ISBN number
-   `{{url}}` - URL/website address
-   `{{abstract}}` - Abstract/description text
-   `{{abstractmd}}` - Abstract with enhanced markdown formatting (JATS processing)

#### Additional Fields

-   `{{keywords}}` - Keywords/tags as array
-   `{{note}}` - Personal notes about the source

### Default Template

```markdown
---
title: "{{title}}"
author: [{ { author } }]
year: { { year } }
citekey: { { citekey } }
type: { { type } }
tags: ["source"]
journal: { { journal } }
publisher: { { publisher } }
doi: { { doi } }
isbn: { { isbn } }
url: { { url } }
---

# {{title}}

**Authors:** {{author}}
**Year:** {{year}}
**Journal:** {{journal}}
**Publisher:** {{publisher}}
**DOI:** {{doi}}
**ISBN:** {{isbn}}
**URL:** {{url}}

## Abstract

{{abstractmd}}

## Notes

{{note}}
```

### Template Examples

See [example templates](docs/templates/) for different academic disciplines and use cases.

## Settings

### General Settings

-   **Sources Folder**: Folder where source notes are stored (default: `sources`)
-   **Template File**: Path to custom template file (optional)
-   **Default Source Type**: Default type for new sources (default: `misc`)

### Bibliography Settings

-   **Bibliography Format**: Default export format (`bibtex`, `csl-json`, `hayagriva`)
-   **Bibliography Filename**: Default filename for exported bibliographies
-   **Bibliography Output Folder**: Where to save exported bibliography files

### Citekey Settings

-   **Citekey Pattern**: Template for generating citekeys (default: `{author}{year}{title}`)
-   **Title Words**: Number of words to include from title in citekey
-   **Title Separator**: Separator between title words in citekey
-   **Maximum Title Length**: Maximum characters for title part of citekey

## Import Methods

### DOI Import

-   **Command**: `Ctrl+P` → "Import source" → "DOI"
-   **Description**: Import from Digital Object Identifier
-   **Features**: Automatic metadata fetching from Crossref
-   **Use**: Perfect for journal articles, conference papers, books with DOIs

### ISBN Import

-   **Command**: `Ctrl+P` → "Import source" → "ISBN"
-   **Description**: Import from International Standard Book Number
-   **Features**: Fetches metadata from book databases
-   **Use**: Ideal for books, book chapters

### URL Import

-   **Command**: `Ctrl+P` → "Import source" → "URL"
-   **Description**: Import from webpage URL
-   **Features**: Attempts to extract metadata from web pages
-   **Use**: General websites, online articles, resources

### BibTeX Import

-   **Command**: `Ctrl+P` → "Import source" → "BibTeX"
-   **Description**: Import from BibTeX entry text
-   **Features**: Parses existing BibTeX entries
-   **Use**: Migrating existing bibliographies, manual entry

## Export Formats

### BibTeX (.bib)

Standard bibliography format used with LaTeX. Supports all standard BibTeX entry types:

-   `@article`, `@book`, `@inproceedings`, `@misc`, etc.

Example output:

```bibtex
@article{smith2020,
  author = {Smith, John and Doe, Jane},
  title = {An Example Article},
  journal = {Journal of Examples},
  year = {2020},
  volume = {15},
  number = {3},
  pages = {123--145}
}
```

### CSL-JSON (.json)

JSON format using Citation Style Language schema. Compatible with Zotero, Mendeley, and other reference managers.

Example output:

```json
[
	{
		"id": "smith2020",
		"type": "article",
		"title": "An Example Article",
		"author": [
			{
				"family": "Smith",
				"given": "John"
			}
		],
		"container-title": "Journal of Examples",
		"issued": {
			"date-parts": [[2020]]
		},
		"volume": 15,
		"issue": 3,
		"page": "123-145"
	}
]
```

### Hayagriva (.yaml)

YAML format compatible with Hayagriva tool for managing bibliographies.

Example output:

```yaml
smith2020:
    title: An Example Article
    author: Smith, John and Doe, Jane
    type: article
    year: 2020
    journal: Journal of Examples
    volume: 15
    number: 3
    pages: 123--145
```

## API for Developers

The Bibliography Manager provides a comprehensive API for other plugins to generate bibliographies programmatically.

### Access the API

```typescript
// Get API from plugin instance
const bibManager = app.plugins.getPlugin("bibliography-manager");
const api = bibManager?.api;

if (api) {
	// Use API functions
}
```

### API Methods

#### `exportBibliography(sourcesFolder?, outputFilename?, format?)`

Generate bibliography content as string.

```typescript
// Export using plugin defaults
const bibContent = await api.exportBibliography();

// Auto-detect format from filename
const bibContent = await api.exportBibliography(
	undefined, // sources folder (use default)
	"my-bib.json", // filename
	null // format (auto-detect from extension)
);

// Specific format with custom folder
const bibContent = await api.exportBibliography(
	"sources", // custom sources folder
	"references.bib", // filename
	"bibtex" // format
);
```

**Parameters:**

-   `sourcesFolder` (optional): Path to folder containing source files
-   `outputFilename` (optional): Output filename, used for format auto-detection
-   `format` (optional): Export format (`bibtex`, `csl-json`, `hayagriva`), auto-detects when nullish + filename provided

**Returns:** `Promise<string>` - Generated bibliography content

#### `exportBibliographyToPath(sourcesFolder?, outputFilename?, format?)`

Export bibliography directly to a file in the vault.

```typescript
// Export using defaults to default location
const filePath = await api.exportBibliographyToPath();

// Export to specific location with format
const filePath = await api.exportBibliographyToPath(
	"literature",
	"references.bib",
	"bibtex"
);

// Auto-detect format from filename
const filePath = await api.exportBibliographyToPath(
	"exports",
	"bibliography.json",
	null
);
```

**Parameters:** Same as `exportBibliography`

**Returns:** `Promise<string>` - Path to created file

### Example: TypeScript Export Plugin

Here's a complete example of a plugin that uses the Bibliography Manager API:

```typescript
import { App, Plugin } from "obsidian";

export default class TypeScriptExportPlugin extends Plugin {
	async onload() {
		// Add command to generate TypeScript bibliography
		this.addCommand({
			id: "generate-typescript-bib",
			name: "Generate bibliography as TypeScript",
			callback: async () => {
				try {
					const bibManager = this.app.plugins.getPlugin(
						"bibliography-manager"
					);
					const api = bibManager?.api;

					if (!api) {
						console.error("Bibliography Manager plugin not found");
						return;
					}

					// Generate bibliography in CSL-JSON format
					const bibContent = await api.exportBibliography(
						"sources",
						"typescript-bib.json",
						"csl-json"
					);

					// Process the content
					const sources = JSON.parse(bibContent);

					// Generate TypeScript interfaces
					let typescriptContent = `// Auto-generated bibliography types\n\n`;
					sources.forEach((source: any) => {
						const typeName = source.id.replace(
							/[^a-zA-Z0-9_]/g,
							"_"
						);
						typescriptContent += `interface ${typeName} {\n`;
						typescriptContent += `  id: string;\n`;
						typescriptContent += `  type: string;\n`;
						if (source.title)
							typescriptContent += `  title: string;\n`;
						if (source.author)
							typescriptContent += `  author: any[];\n`;
						if (source["container-title"])
							typescriptContent += `  containerTitle: string;\n`;
						typescriptContent += `}\n\n`;
					});

					// Write to file
					const filePath = `${this.app.vault.adapter.getBasePath()}/bibliography-types.ts`;
					await this.app.vault.adapter.write(
						filePath,
						typescriptContent
					);

					console.log(
						`TypeScript bibliography generated: ${filePath}`
					);
				} catch (error) {
					console.error(
						"Failed to generate TypeScript bibliography:",
						error
					);
				}
			},
		});
	}
}
```

## Troubleshooting

### Common Issues

**Q: My bibliography export fails with "duplicate key" errors**
A: The plugin now automatically deduplicates sources with the same citekey. Check console for details about which sources are duplicates.

**Q: The DOI import doesn't find my source**
A: Ensure the DOI is correct and accessible. Some DOIs may not be in Crossref's database.

**Q: Template variables aren't being replaced**
A: Check that your template uses the correct variable names and that your source notes have the corresponding frontmatter fields.

### Debug Mode

Enable debug logging in the developer console to see detailed information about:

-   Source file processing
-   Citekey generation
-   Deduplication warnings
-   Bibliography generation

## License

MIT License - see [LICENSE](LICENSE) for details.

## Changelog

### Version 1.0.0

-   Initial release
-   Multiple import methods (DOI, ISBN, URL, BibTeX)
-   Customizable templating system
-   Bibliography export in multiple formats
-   API for other plugins
-   Automatic deduplication
-   Enhanced JATS XML processing for abstracts
