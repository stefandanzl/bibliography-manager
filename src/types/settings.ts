import { BibliographySettings, FORMAT_EXTENSION_MAPPING } from "./interfaces";

// Default settings
export const DEFAULT_SETTINGS: BibliographySettings = {
	sourcesFolder: "sources",
	bibliographyFilename: "bibliography",
	bibliographyOutputFolder: "",
	bibliographyFormat: "bibtex" as const,
	autoGenerate: false,
	supportedFileTypes: ["pdf", "epub", "txt"],
	crossrefEmail: "",
	sourceNoteTemplate: `---
citekey: {{citekey}}
title: "{{title}}"
author: {{authorArray}}
keywords: {{keywordsArray}}
bibtype: {{bibtype}}
aliases: [{{atcitekey}}]
filename: {{filename}}
doi: {{doi}}
isbn: {{isbn}}
publisher: {{publisher}}
journal: {{journal}}
volume: {{volume}}
number: {{number}}
pages: {{pages}}
abstract: {{abstract}}
year: {{year}}
url: {{url}}
downloadurl: {{downloadurl}}
imageurl: {{imageurl}}
---

# {{title}}

{{author}}

({{year}})

## Abstract
{{abstract}}

{{abstractmd}}

**Keywords:** {{keywords}}

**File:** [{{filename}}.pdf](./{{filename}}.pdf)

DOI: {{doi}}
URL: {{url}}
`,
	templateFile: "",
	fieldMappings: {
		// CSL-JSON standard fields (bibliography field -> frontmatter key)
		id: "citekey",
		type: "bibtype",
		title: "title",
		author: "author",
		editor: "editor",
		translator: "translator",
		publisher: "publisher",
		"publisher-place": "publisher-place",
		"container-title": "journal",
		volume: "volume",
		issue: "number",
		page: "pages",
		issued: "year",
		DOI: "doi",
		ISBN: "isbn",
		ISSN: "issn",
		URL: "url",
		abstract: "abstract",
		keyword: "keywords",
		note: "note",
		language: "language",
		edition: "edition",
		series: "series",
		"chapter-number": "chapter",
		"event-title": "booktitle",
		genre: "genre",
		accessed: "accessed",
	},
};

// Standard bibliography fields for citation-js conversion
export const BIB_FIELDS = [
	"title",
	"author",
	"year",
	"publisher",
	"journal",
	"booktitle",
	"doi",
	"url",
	"isbn",
	"issn",
	"pages",
	"volume",
	"number",
	"keywords",
	"abstract",
	"note",
	"language",
	"editor",
	"series",
	"edition",
	"chapter",
	"institution",
	"organization",
	"school",
	"address",
	"month",
	"day",
];
