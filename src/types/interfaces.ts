// Unified types for bibliography manager plugin

export interface SourceData {
	citekey: string;
	title: string;
	author: string[];
	category: string[];
	bibtype: string;
	year?: string;

	// File and media fields
	downloadurl?: string;
	imageurl?: string;
	filelink?: string;
	filepath?: string;

	// Reading progress fields
	added?: string;
	started?: string;
	ended?: string;
	rating?: string;
	pages?: number;
	currentpage?: number;
	status?: string;

	// Bibliographic fields from citation-js
	abstract?: string;
	abstractmd?: string;
	publisher?: string;
	journal?: string;
	volume?: string;
	number?: string;
	doi?: string;
	isbn?: string;
	url?: string;

	// Additional fields
	aliases?: string[];
	keywords?: string[];
	note?: string;
	issue?: string;
}

export type SourceType =
	| "book"
	| "paper"
	| "website"
	| "thesis"
	| "report"
	| "other";
export type ImportMethod = "doi" | "isbn" | "url" | "bibtex";

export interface BibliographyConfig {
	mode: "directory" | "file";
	path: string;
}

// Extension→format mapping for API format detection
export const BIBLIOGRAPHY_FORMAT_MAPPING: Record<string, string> = {
	".bib": "bibtex",
	".bibtex": "bibtex",
	".json": "csl-json",
	".yaml": "hayagriva",
	".yml": "hayagriva",
};

// Simple format→extension mapping for UI code
export const FORMAT_EXTENSION_MAPPING: Record<string, string> = {
	bibtex: ".bib",
	"csl-json": ".json",
	hayagriva: ".yaml",
};

export interface BibliographySettings {
	sourcesFolder: string;
	bibliographyFilename: string;
	bibliographyOutputFolder: string;
	bibliographyFormat: "bibtex" | "csl-json" | "hayagriva";
	autoGenerate: boolean;
	supportedFileTypes: string[];
	crossrefEmail: string;
	sourceNoteTemplate: string;
	templateFile: string;
	fieldMappings: Record<string, string>;
}

export interface SourceData2 {
	citekey: string;
	title: string;
	author: string[];
	year: number;
	type: "book" | "article" | "inproceedings" | "website" | "misc";
	journal?: string;
	publisher?: string;
	pages?: string;
	volume?: string;
	issue?: string;
	doi?: string;
	isbn?: string;
	url?: string;
	abstract?: string;
	keywords?: string[];
	note?: string;
	filepath: string; // Path to the source file
}

export interface BibliographyConfig {
	mode: "directory" | "file";
	path: string;
}
